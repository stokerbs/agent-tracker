-- 0063_can_access_case_align.sql
-- Align the can_access_case() helper with the assignment-scoped model that
-- migration 0048 established for timeline_entries.
--
-- Context: 0048 deliberately removed blanket supervisor access to surveillance
-- data ("can leak surveillance data across cases"). However can_access_case()
-- (from 0002) still granted EVERY supervisor access to EVERY case via an
-- unconditional `current_role() = 'supervisor'` clause. That helper is currently
-- unused, but leaving the contradiction in place is a latent footgun: wiring it
-- into a future RLS policy would silently re-open the cross-case leak 0048 closed.
--
-- New definition: admin (all) OR explicitly assigned via case_agents (agent or
-- supervisor). This is a no-op for current behavior (no caller) and makes the
-- helper safe to adopt going forward.
--
-- NOTE: This intentionally does NOT change the live cases / evidence /
-- case_messages policies, which still use is_staff() (blanket supervisor read).
-- Unifying those onto one supervisor model is a separate product decision with
-- broader blast radius and is tracked as a later roadmap phase.

CREATE OR REPLACE FUNCTION public.can_access_case(target_case uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.case_agents ca
      JOIN public.agents a ON a.id = ca.agent_id
      WHERE ca.case_id = target_case
        AND a.profile_id = auth.uid()
    );
$$;
