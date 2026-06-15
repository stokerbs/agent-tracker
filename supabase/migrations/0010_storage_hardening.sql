-- ============================================================================
-- Migration 0010 — Storage security hardening
--
-- Fixes:
--   S-1 (HIGH)   file_size_limit was null on all buckets — direct Storage API
--                calls bypassed application-layer size validation.
--
--   S-2 (HIGH)   allowed_mime_types was null on all buckets — any MIME type
--                (SVG/JS/EXE) could be uploaded via direct API call.
--
--   S-3 (HIGH)   getEvidenceUrl() server action (fixed in app code, 0010).
--
--   S-4 (MEDIUM) No agent SELECT policy on evidence storage — agents could not
--                generate signed URLs for evidence they uploaded/are assigned to.
--
--   S-5 (MEDIUM) No staff DELETE policy on evidence storage — deleting an
--                evidence table row left an orphaned storage object.
--
--   S-6 (MEDIUM) No staff write policy on receipts storage — staff could not
--                delete incorrectly uploaded receipt files.
--
--   S-8 (LOW)    avatars UPDATE policy had no WITH CHECK clause.
-- ============================================================================

-- ─── S-1 + S-2: Bucket-level MIME type and size enforcement ─────────────────

-- avatars: profile photos only, max 2 MB
UPDATE storage.buckets
SET
  file_size_limit    = 2097152,  -- 2 MB
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'avatars';

-- evidence: images and PDF only at bucket layer (matches server-side validation).
-- Video/audio evidence requires a future migration once magic-number validation
-- is extended. Max 20 MB matches validateDocumentUpload ceiling.
UPDATE storage.buckets
SET
  file_size_limit    = 20971520,  -- 20 MB
  allowed_mime_types = ARRAY[
    'image/jpeg','image/png','image/webp',
    'application/pdf'
  ]
WHERE id = 'evidence';

-- receipts: images and PDFs, max 20 MB
UPDATE storage.buckets
SET
  file_size_limit    = 20971520,  -- 20 MB
  allowed_mime_types = ARRAY[
    'image/jpeg','image/png','image/webp',
    'application/pdf'
  ]
WHERE id = 'receipts';

-- reports: PDF only, max 20 MB
UPDATE storage.buckets
SET
  file_size_limit    = 20971520,  -- 20 MB
  allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'reports';

-- ─── S-4: Agent evidence read — scoped to assigned cases ─────────────────────

-- Agents can generate signed URLs only for files in cases they are assigned to.
-- Path convention: evidence/{case_id}/{uuid}.ext — foldername(name)[1] = case_id.
create policy "evidence agent read"
  on storage.objects for select
  using (
    bucket_id = 'evidence'
    and exists (
      select 1
      from public.case_agents ca
      join public.agents a on a.id = ca.agent_id
      where ca.case_id::text = (storage.foldername(name))[1]
        and a.profile_id = auth.uid()
    )
  );

-- ─── S-5: Staff evidence delete — prevent orphaned objects ───────────────────

create policy "evidence staff delete"
  on storage.objects for delete
  using (bucket_id = 'evidence' and public.is_staff());

-- ─── S-6: Staff receipts management ─────────────────────────────────────────

create policy "receipts staff all"
  on storage.objects for all
  using  (bucket_id = 'receipts' and public.is_staff())
  with check (bucket_id = 'receipts' and public.is_staff());

-- ─── S-8: avatars UPDATE — add explicit WITH CHECK ───────────────────────────

drop policy if exists "avatars update own" on storage.objects;

create policy "avatars update own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
