-- Recruitment / "join us" applications from the public marketing site
-- (detectivepulse.com/careers). Same posture as public.marketing_leads: rows are
-- written ONLY by the service-role route handler (/api/marketing/careers) which
-- validates + rate-limits + requires PDPA consent; there is no anon insert path.
-- Reads are admin-only (applicant personal data).

create table if not exists public.recruitment_applications (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  email       text,
  position    text,                          -- role the applicant is interested in
  experience  text,                          -- free-text background / years
  message     text,
  locale      text not null default 'th',
  source      text not null default 'website',
  user_agent  text,
  consent_at  timestamptz,                   -- PDPA: when consent was given
  status      text not null default 'new',   -- new | reviewing | contacted | closed
  created_at  timestamptz not null default now()
);

comment on table public.recruitment_applications is
  'Inbound job/recruitment applications from the public marketing site careers form. Written by the service-role API route only; admin-only reads.';

alter table public.recruitment_applications enable row level security;

-- Admins can read and triage applications. No insert/delete policy → anon and
-- non-admin roles get nothing; the API route uses the service-role key
-- (bypasses RLS) to insert.
drop policy if exists "admin read recruitment applications" on public.recruitment_applications;
create policy "admin read recruitment applications" on public.recruitment_applications
  for select using (public.is_admin());

drop policy if exists "admin update recruitment applications" on public.recruitment_applications;
create policy "admin update recruitment applications" on public.recruitment_applications
  for update using (public.is_admin()) with check (public.is_admin());

create index if not exists recruitment_applications_created_idx
  on public.recruitment_applications (created_at desc);
create index if not exists recruitment_applications_status_idx
  on public.recruitment_applications (status);
