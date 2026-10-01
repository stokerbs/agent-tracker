-- ============================================================================
-- Migration 0124 — Chinese-market lead pipeline (docs/china-market/10, 11)
-- ============================================================================
-- Extends public.marketing_leads from a 3-state contact-form inbox into a
-- qualified-lead pipeline with attribution and value tracking, and adds a
-- private bucket + table for intake attachments. Posture is unchanged: rows
-- are written ONLY by service-role route handlers; admins read/update.

-- ── marketing_leads: pipeline + qualification + attribution + value ────────
alter table public.marketing_leads
  -- Public Case Lead ID shown to the client (CN-YYMMDD-XXXX). Unique when set.
  add column if not exists lead_ref            text,
  -- Qualification fields (Chinese intake form).
  add column if not exists wechat_id           text,
  add column if not exists country             text,
  add column if not exists target_location     text,
  add column if not exists service             text,
  add column if not exists known_info          text,
  add column if not exists objective           text,
  add column if not exists preferred_start     date,
  add column if not exists estimated_duration  text,
  add column if not exists urgency             text,
  add column if not exists budget_range        text,
  -- Attribution (informational; client-supplied and bounded by the API).
  add column if not exists landing_page        text,
  add column if not exists referrer            text,
  add column if not exists utm_source          text,
  add column if not exists utm_medium          text,
  add column if not exists utm_campaign        text,
  add column if not exists utm_term            text,
  -- Pipeline.
  add column if not exists stage               text not null default 'new',
  add column if not exists stage_changed_at    timestamptz,
  -- Value (THB).
  add column if not exists estimated_value     numeric(12,2),
  add column if not exists quoted_value        numeric(12,2),
  add column if not exists final_revenue       numeric(12,2),
  add column if not exists converted_at        timestamptz,
  add column if not exists admin_notes         text;

-- The Chinese intake collects a WeChat ID instead of a phone number, so phone
-- becomes optional — but every lead must still carry at least one way to reach
-- the client.
alter table public.marketing_leads alter column phone drop not null;
alter table public.marketing_leads drop constraint if exists marketing_leads_contact_present;
alter table public.marketing_leads add constraint marketing_leads_contact_present
  check (
    nullif(btrim(phone), '')     is not null or
    nullif(btrim(wechat_id), '') is not null or
    nullif(btrim(email), '')     is not null
  );

alter table public.marketing_leads drop constraint if exists marketing_leads_stage_check;
alter table public.marketing_leads add constraint marketing_leads_stage_check
  check (stage in (
    'new','contacted','qualified','requirements_received','quotation_sent','follow_up',
    'payment_pending','paid','case_created','investigation_active','report_delivered',
    'closed','referral'
  ));

alter table public.marketing_leads drop constraint if exists marketing_leads_values_nonneg;
alter table public.marketing_leads add constraint marketing_leads_values_nonneg
  check (
    (estimated_value is null or estimated_value >= 0) and
    (quoted_value    is null or quoted_value    >= 0) and
    (final_revenue   is null or final_revenue   >= 0)
  );

-- Backfill: leads already triaged under the legacy status keep their place in
-- the pipeline instead of all reappearing as "new".
update public.marketing_leads
   set stage = status,
       stage_changed_at = coalesce(stage_changed_at, created_at)
 where status in ('contacted', 'closed');

create unique index if not exists marketing_leads_lead_ref_key
  on public.marketing_leads (lead_ref) where lead_ref is not null;
create index if not exists marketing_leads_stage_idx   on public.marketing_leads (stage);
create index if not exists marketing_leads_locale_idx  on public.marketing_leads (locale, created_at desc);

comment on column public.marketing_leads.stage is
  'CRM pipeline stage (see src/lib/marketing/zh/pipeline.ts). status is the legacy 3-state summary kept in sync by the app.';
comment on column public.marketing_leads.lead_ref is
  'Public Case Lead ID returned to the client after the Chinese intake (CN-YYMMDD-XXXX).';

-- ── Intake attachments ─────────────────────────────────────────────────────
create table if not exists public.marketing_lead_files (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.marketing_leads(id) on delete cascade,
  storage_path text not null,            -- lead-files/<lead_id>/<uuid>.<ext>
  file_name    text not null,            -- original name, sanitised
  mime_type    text not null,
  size_bytes   integer not null check (size_bytes >= 0),
  created_at   timestamptz not null default now()
);

comment on table public.marketing_lead_files is
  'Supporting files attached to a public intake submission. Uploaded by the service-role API route into the private lead-files bucket; admin-only reads.';

alter table public.marketing_lead_files enable row level security;

drop policy if exists "admin read marketing lead files" on public.marketing_lead_files;
create policy "admin read marketing lead files" on public.marketing_lead_files
  for select using (public.is_admin());

drop policy if exists "admin delete marketing lead files" on public.marketing_lead_files;
create policy "admin delete marketing lead files" on public.marketing_lead_files
  for delete using (public.is_admin());

create index if not exists marketing_lead_files_lead_idx on public.marketing_lead_files (lead_id);

-- Private bucket. No anon/authenticated insert policy: uploads happen through
-- the service-role route handler after validation (magic bytes + size + count).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lead-files', 'lead-files', false, 4194304, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "lead-files admin read" on storage.objects;
create policy "lead-files admin read"
  on storage.objects for select
  using (bucket_id = 'lead-files' and public.is_admin());

drop policy if exists "lead-files admin delete" on storage.objects;
create policy "lead-files admin delete"
  on storage.objects for delete
  using (bucket_id = 'lead-files' and public.is_admin());
