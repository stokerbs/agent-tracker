-- ============================================================================
-- Migration 0004 — Storage buckets & object-level RLS
-- ============================================================================

-- Private buckets — access is brokered via signed URLs from the server.
insert into storage.buckets (id, name, public)
values
  ('avatars',  'avatars',  false),
  ('evidence', 'evidence', false),
  ('receipts', 'receipts', false),
  ('reports',  'reports',  false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- avatars — any authenticated user may read; users write their own folder
-- folder convention: avatars/{user_id}/file.png
-- ----------------------------------------------------------------------------
create policy "avatars read authed"
  on storage.objects for select
  using (bucket_id = 'avatars' and auth.uid() is not null);

create policy "avatars write own"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars update own"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- evidence — staff read/write; assigned agents write. folder: evidence/{case_id}/...
-- Reads are normally done server-side with the service role + signed URLs,
-- but we allow staff direct read for tooling.
-- ----------------------------------------------------------------------------
create policy "evidence staff read"
  on storage.objects for select
  using (bucket_id = 'evidence' and public.is_staff());

create policy "evidence authed write"
  on storage.objects for insert
  with check (bucket_id = 'evidence' and auth.uid() is not null and public.current_role() <> 'client');

-- ----------------------------------------------------------------------------
-- receipts — agents write their own; staff read. folder: receipts/{agent_profile}/...
-- ----------------------------------------------------------------------------
create policy "receipts staff read"
  on storage.objects for select
  using (bucket_id = 'receipts' and public.is_staff());

create policy "receipts own write"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts own read"
  on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- reports — staff write; generated PDFs served via signed URLs
-- ----------------------------------------------------------------------------
create policy "reports staff all"
  on storage.objects for all
  using (bucket_id = 'reports' and public.is_staff())
  with check (bucket_id = 'reports' and public.is_staff());
