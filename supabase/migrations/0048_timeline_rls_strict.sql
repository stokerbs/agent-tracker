-- ============================================================================
-- Migration 0048 — Timeline RLS hardening
--
-- Fixes an over-permissive "timeline staff all" policy from 0003 that gave
-- supervisors full read/write access to ALL timeline entries regardless of
-- case assignment. This violates the principle of least privilege and can
-- leak surveillance data across cases.
--
-- New model:
--   Admin      — full unrestricted access (no change)
--   Supervisor — SELECT / INSERT / UPDATE / DELETE only on assigned cases
--   Agent      — SELECT / INSERT only on assigned cases
-- ============================================================================

-- ── Drop old permissive policies ────────────────────────────────────────────

DROP POLICY IF EXISTS "timeline staff all"    ON public.timeline_entries;
DROP POLICY IF EXISTS "timeline agent read"   ON public.timeline_entries;
DROP POLICY IF EXISTS "timeline agent insert" ON public.timeline_entries;
-- Safety: also drop any name variants that may exist from previous migrations
DROP POLICY IF EXISTS "timeline agent read/insert" ON public.timeline_entries;

-- ── Admin: full unrestricted access ─────────────────────────────────────────

CREATE POLICY "timeline_admin_all" ON public.timeline_entries
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Case members (supervisor + agent): SELECT only assigned cases ─────────

CREATE POLICY "timeline_case_member_select" ON public.timeline_entries
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.case_agents ca
      JOIN public.agents a ON a.id = ca.agent_id
      WHERE ca.case_id = timeline_entries.case_id
        AND a.profile_id = auth.uid()
    )
  );

-- ── Case members: INSERT only on assigned cases ──────────────────────────

CREATE POLICY "timeline_case_member_insert" ON public.timeline_entries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.case_agents ca
      JOIN public.agents a ON a.id = ca.agent_id
      WHERE ca.case_id = timeline_entries.case_id
        AND a.profile_id = auth.uid()
    )
    -- Enforce self-attribution (agent_id must be own agent row or null)
    AND (agent_id IS NULL OR agent_id = public.my_agent_id())
  );

-- ── Supervisors only: UPDATE entries in assigned cases ───────────────────

CREATE POLICY "timeline_supervisor_update" ON public.timeline_entries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
    AND EXISTS (
      SELECT 1
      FROM public.case_agents ca
      JOIN public.agents a ON a.id = ca.agent_id
      WHERE ca.case_id = timeline_entries.case_id
        AND a.profile_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- ── Supervisors only: soft-DELETE entries in assigned cases ──────────────

CREATE POLICY "timeline_supervisor_delete" ON public.timeline_entries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
    AND EXISTS (
      SELECT 1
      FROM public.case_agents ca
      JOIN public.agents a ON a.id = ca.agent_id
      WHERE ca.case_id = timeline_entries.case_id
        AND a.profile_id = auth.uid()
    )
  );

-- ── Performance indexes ──────────────────────────────────────────────────

-- Composite index for the main timeline query (case + date + time, active only)
CREATE INDEX IF NOT EXISTS idx_timeline_entries_case_date_time
  ON public.timeline_entries (case_id, entry_date ASC, entry_time ASC)
  WHERE deleted_at IS NULL;

-- Date-only index for date-range filters
CREATE INDEX IF NOT EXISTS idx_timeline_entries_date
  ON public.timeline_entries (entry_date ASC)
  WHERE deleted_at IS NULL;

-- case_agents.agent_id is the join key in every RLS sub-select above
CREATE INDEX IF NOT EXISTS idx_case_agents_agent_id
  ON public.case_agents (agent_id);
