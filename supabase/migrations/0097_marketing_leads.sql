-- Marketing lead capture from the public site (detectivepulse.com contact form).
-- Rows are written ONLY by the service-role route handler (/api/marketing/lead)
-- which validates + rate-limits input; there is no anon insert path. Reads are
-- admin-only (customer contact data), mirroring the clients-admin-only posture.

create table if not exists public.marketing_leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  case_type   text,
  message     text,
  locale      text not null default 'th',
  source      text not null default 'website',
  user_agent  text,
  status      text not null default 'new',   -- new | contacted | closed
  created_at  timestamptz not null default now()
);

comment on table public.marketing_leads is
  'Inbound leads from the public marketing site contact form. Written by the service-role API route only; admin-only reads.';

alter table public.marketing_leads enable row level security;

-- Admins can read and triage leads. No insert/delete policy → anon and non-admin
-- roles get nothing; the API route uses the service-role key (bypasses RLS) to insert.
drop policy if exists "admin read marketing leads" on public.marketing_leads;
create policy "admin read marketing leads" on public.marketing_leads
  for select using (public.is_admin());

drop policy if exists "admin update marketing leads" on public.marketing_leads;
create policy "admin update marketing leads" on public.marketing_leads
  for update using (public.is_admin()) with check (public.is_admin());

create index if not exists marketing_leads_created_idx
  on public.marketing_leads (created_at desc);
create index if not exists marketing_leads_status_idx
  on public.marketing_leads (status);
