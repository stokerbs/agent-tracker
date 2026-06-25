-- ============================================================================
-- Migration 0071 — Adopt public.can_access_case() in timeline_entries RLS
--
-- Task:   FUT-3 (adopt the "dead but live" can_access_case helper)
-- Refs:   SEC-3 audit (.claude/audits/SEC-3-can-access-case-dead-but-live-audit.md)
--         0048_timeline_rls_strict.sql (origin of the two policies edited here)
--         0063_can_access_case_align.sql (current assignment-scoped helper body)
--
-- SCOPE (deliberately narrow):
--   Rewrite EXACTLY TWO timeline_entries policies — timeline_case_member_select
--   and timeline_case_member_insert — to call public.can_access_case(case_id)
--   in place of their inline "assigned via case_agents" EXISTS sub-select.
--   This is a BEHAVIOR-PRESERVING refactor, NOT an access-model change.
--
--   NOT touched (out of scope; adopting the helper there WOULD change behavior):
--     - timeline_admin_all / timeline_supervisor_update / timeline_supervisor_delete
--     - the 0048 indexes (idx_case_agents_agent_id still covers the helper's subquery)
--     - every policy on cases / evidence / case_messages / case_agents / gps_devices /
--       target_relationships / invoices (blanket is_staff()/supervisor — see FUT-3
--       readiness artifact for the full inventory and the deferred "central adoption").
--
-- ----------------------------------------------------------------------------
-- BEHAVIOR-IDENTITY PROOF (why this swap changes no access decision)
--
--   public.can_access_case(c) (per 0063) =
--       public.is_admin()
--       OR EXISTS (SELECT 1 FROM case_agents ca JOIN agents a ON a.id = ca.agent_id
--                  WHERE ca.case_id = c AND a.profile_id = auth.uid())
--
--   (1) ADDED is_admin() DISJUNCT IS REDUNDANT HERE.
--       timeline_admin_all is FOR ALL USING/ WITH CHECK is_admin(), so an admin
--       already has SELECT and INSERT on every timeline row. RLS combines
--       permissive policies with OR, so adding an is_admin() term to these two
--       member policies cannot widen (admin already true) nor narrow the result
--       set. Union of granted rows is unchanged for every role.
--
--   (2) SECURITY DEFINER VS INLINE RLS-SUBJECT SUBQUERY COINCIDE.
--       can_access_case is SECURITY DEFINER (runs as owner, bypassing RLS on
--       case_agents/agents), whereas the old inline EXISTS ran AS THE SUBJECT
--       (RLS applied to case_agents/agents). For the evaluating user these are
--       identical because the user can always see their OWN rows:
--         - policy "case_agents read" (0003) = is_staff() OR own assignment, so the
--           user's own (case_id, agent_id) rows are always visible to them;
--         - policy "agents self read" exposes the user's own agents row
--           (a.profile_id = auth.uid()).
--       The helper only ever inspects rows WHERE a.profile_id = auth.uid() — i.e.
--       precisely the rows already visible to the subject. No additional or fewer
--       matching rows are reachable via the definer path. Same predicate result.
--
--   (3) CONSEQUENCES (unchanged for every principal):
--         - Assigned agents / assigned supervisors: still granted (own case_agents
--           assignment → EXISTS true). UNCHANGED.
--         - Non-assigned supervisors: is_admin() false AND no own assignment →
--           false. Still BLOCKED — the 0048 cross-case least-privilege model holds.
--         - Admins: still full access via timeline_admin_all (and now redundantly
--           via the helper). UNCHANGED.
--         - SELECT: the deleted_at IS NULL guard is RETAINED verbatim, so
--           soft-deleted rows stay hidden from members.
--         - INSERT: the self-attribution guard (agent_id IS NULL OR agent_id =
--           my_agent_id()) is RETAINED verbatim.
--
--   The helper's body is NOT modified by this migration. No new EXECUTE grant is
--   required: can_access_case is a SECURITY DEFINER SQL function already callable
--   in the RLS evaluation context (it was created/redefined in 0002/0063).
-- ============================================================================

BEGIN;

-- ── Case members (supervisor + agent): SELECT only on assigned cases ─────────
DROP POLICY IF EXISTS "timeline_case_member_select" ON public.timeline_entries;

CREATE POLICY "timeline_case_member_select" ON public.timeline_entries
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.can_access_case(timeline_entries.case_id)
  );

-- ── Case members: INSERT only on assigned cases (self-attribution enforced) ──
DROP POLICY IF EXISTS "timeline_case_member_insert" ON public.timeline_entries;

CREATE POLICY "timeline_case_member_insert" ON public.timeline_entries
  FOR INSERT
  WITH CHECK (
    public.can_access_case(timeline_entries.case_id)
    AND (agent_id IS NULL OR agent_id = public.my_agent_id())
  );

COMMIT;
