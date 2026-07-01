-- PDPA: record when the lead gave consent on the public contact form. The API
-- route rejects submissions without consent, so real rows always have this set;
-- nullable to keep the column additive.
alter table public.marketing_leads
  add column if not exists consent_at timestamptz;
