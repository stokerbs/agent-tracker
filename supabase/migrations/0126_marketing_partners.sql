-- ============================================================================
-- Migration 0126 — B2B partner pipeline (docs/china-market/13, Phase 3 B-1/B-2)
-- ============================================================================
-- Partner applications from /zh/partners (law firms, consultants, accounting
-- firms, relocation/investment advisors …). Same posture as marketing_leads:
-- rows are written ONLY by the service-role route handler (validated,
-- rate-limited, consent required); admins read/update. Each partner gets a
-- referral slug used as ?utm_source=<slug> on links they share, so leads
-- they send are attributed in marketing_leads.utm_source.

create table if not exists public.marketing_partners (
  id               uuid primary key default gen_random_uuid(),
  org_name         text not null,
  partner_type     text not null,                 -- law_firm | chinese_company | consultant | accounting | advisory | relocation | investment | risk | lawyer | other
  contact_name     text not null,
  wechat_id        text,
  email            text,
  phone            text,
  city             text,
  country          text,
  org_website      text,
  services         text[] not null default '{}',  -- service keys the partner wants to refer
  expected_volume  text,                          -- occasional | monthly_1_3 | monthly_4_10 | over_10
  message          text,
  locale           text not null default 'zh',
  source           text not null default 'website',
  referral_slug    text not null unique,          -- partner-<org>-<xxxx>; used as utm_source
  stage            text not null default 'new',
  stage_changed_at timestamptz,
  admin_notes      text,
  user_agent       text,
  consent_at       timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.marketing_partners drop constraint if exists marketing_partners_contact_present;
alter table public.marketing_partners add constraint marketing_partners_contact_present
  check (
    nullif(btrim(wechat_id), '') is not null or
    nullif(btrim(email), '')     is not null or
    nullif(btrim(phone), '')     is not null
  );

-- org_website is rendered as a link in the admin UI: http(s) only, enforced here too.
alter table public.marketing_partners drop constraint if exists marketing_partners_website_scheme;
alter table public.marketing_partners add constraint marketing_partners_website_scheme
  check (org_website is null or org_website ~* '^https?://');

alter table public.marketing_partners drop constraint if exists marketing_partners_stage_check;
alter table public.marketing_partners add constraint marketing_partners_stage_check
  check (stage in ('new','contacted','call_scheduled','agreement','active','inactive'));

alter table public.marketing_partners drop constraint if exists marketing_partners_type_check;
alter table public.marketing_partners add constraint marketing_partners_type_check
  check (partner_type in ('law_firm','chinese_company','consultant','accounting','advisory','relocation','investment','risk','lawyer','other'));

comment on table public.marketing_partners is
  'B2B partner applications from /zh/partners. Written by the service-role API route only; admin-only reads. referral_slug = utm_source for attributed leads.';

alter table public.marketing_partners enable row level security;

drop policy if exists "admin read marketing partners" on public.marketing_partners;
create policy "admin read marketing partners" on public.marketing_partners
  for select using (public.is_admin());

drop policy if exists "admin update marketing partners" on public.marketing_partners;
create policy "admin update marketing partners" on public.marketing_partners
  for update using (public.is_admin()) with check (public.is_admin());

create index if not exists marketing_partners_created_idx on public.marketing_partners (created_at desc);
create index if not exists marketing_partners_stage_idx   on public.marketing_partners (stage);
-- Attribution join: leads carry utm_source = referral_slug.
create index if not exists marketing_leads_utm_source_idx on public.marketing_leads (utm_source) where utm_source is not null;
