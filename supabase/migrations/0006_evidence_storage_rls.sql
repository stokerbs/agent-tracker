-- ============================================================================
-- Migration 0006 — Tighten evidence Storage RLS
--
-- Closes H-1: the previous "evidence authed write" policy allowed any
-- authenticated non-client user to write to any path in the evidence bucket,
-- regardless of case assignment. This had two consequences:
--   1. An agent not assigned to a case could upload files into that case's
--      Storage folder.
--   2. If the subsequent evidence table INSERT was blocked by table RLS,
--      the already-uploaded Storage object became an orphan.
--
-- Replacement policies:
--   • Staff (admin/supervisor) may write to any evidence path.
--   • Agents may write only to paths whose first folder segment matches a
--     case they are assigned to (path convention: {case_id}/{uuid}.ext).
-- ============================================================================

drop policy if exists "evidence authed write" on storage.objects;

-- Admins and supervisors can upload to any case folder.
create policy "evidence staff write"
  on storage.objects for insert
  with check (
    bucket_id = 'evidence'
    and public.is_staff()
  );

-- Agents can upload only to a folder whose name matches a case they are
-- assigned to. (storage.foldername(name))[1] extracts the first path segment,
-- which by convention is the case UUID.
create policy "evidence assigned agent write"
  on storage.objects for insert
  with check (
    bucket_id = 'evidence'
    and public.current_role() = 'agent'
    and exists (
      select 1
      from public.case_agents ca
      join public.agents a on a.id = ca.agent_id
      where ca.case_id::text = (storage.foldername(name))[1]
        and a.profile_id = auth.uid()
    )
  );
