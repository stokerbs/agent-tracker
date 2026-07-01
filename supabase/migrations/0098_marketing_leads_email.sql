-- Add an optional email field to marketing lead captures (the public contact
-- form now collects email alongside phone/LINE). Nullable — email is optional.
alter table public.marketing_leads
  add column if not exists email text;
