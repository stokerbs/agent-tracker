-- ============================================================================
-- Migration 0106 — Agents may edit / soft-delete their OWN timeline entries
--
-- Extends 0048 (which limited UPDATE/DELETE to admin + supervisor). Agents can
-- now UPDATE — which covers both editing and soft-delete, since delete just sets
-- deleted_at via UPDATE — but ONLY the entries they authored (agent_id = their
-- own agent) and ONLY on cases they are assigned to. They still cannot touch
-- another agent's or a supervisor's entries. Least privilege.
-- ============================================================================

DROP POLICY IF EXISTS "timeline_agent_update_own" ON public.timeline_entries;

CREATE POLICY "timeline_agent_update_own" ON public.timeline_entries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'agent'
    )
    -- Only their own authored entries
    AND timeline_entries.agent_id = public.my_agent_id()
    -- Not a soft-deleted entry — once deleted (e.g. by a supervisor) the author
    -- cannot edit or restore it. The normal soft-delete UPDATE still passes here
    -- because the row is still live (deleted_at IS NULL) at the moment it runs.
    AND timeline_entries.deleted_at IS NULL
    -- Only on cases they are assigned to
    AND EXISTS (
      SELECT 1
      FROM public.case_agents ca
      JOIN public.agents a ON a.id = ca.agent_id
      WHERE ca.case_id = timeline_entries.case_id
        AND a.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Cannot reassign the entry to another agent or move it off an assigned case
    timeline_entries.agent_id = public.my_agent_id()
    AND EXISTS (
      SELECT 1
      FROM public.case_agents ca
      JOIN public.agents a ON a.id = ca.agent_id
      WHERE ca.case_id = timeline_entries.case_id
        AND a.profile_id = auth.uid()
    )
  );
