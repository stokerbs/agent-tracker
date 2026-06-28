-- FUT-3b (product-approved): scope SUPERVISOR case access from blanket (all
-- cases) to assignment-scoped (only cases they're assigned to). Admins keep full
-- access; agents and clients are unchanged. Builds on can_access_case() (0071).
--
-- Today supervisors see/act on every case via blanket guards: a combined
-- `is_staff()` (= admin OR supervisor) on cases/evidence/invoices, and dedicated
-- supervisor policies on case_messages/target_relationships. We rewrite each so
-- the SUPERVISOR branch is gated by can_access_case(<case col>), while leaving
-- the admin branch (is_admin / can_access_case's admin short-circuit) and the
-- separate agent/client policies exactly as they were.
--
-- Surgical by design: the supervisor branch carries an explicit
-- `current_role() = 'supervisor'` guard, so rewriting these policies CANNOT
-- widen access for agents (an assigned agent does not match the supervisor
-- branch; agents keep their own assignment policies untouched).
--
-- Recreate (DROP + CREATE) each policy preserving its exact command, roles, and
-- permissive flag; only the predicate changes. Idempotent via DROP IF EXISTS.

BEGIN;

-- 1. cases — "cases staff read" (SELECT, PUBLIC): is_staff() → admin OR assigned-supervisor
DROP POLICY IF EXISTS "cases staff read" ON public.cases;
CREATE POLICY "cases staff read" ON public.cases
  AS PERMISSIVE FOR SELECT TO public
  USING (
    public.is_admin()
    OR (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(id))
  );

-- 2. invoices — "invoices staff select" (SELECT, authenticated): preserve deleted_at guard
DROP POLICY IF EXISTS "invoices staff select" ON public.invoices;
CREATE POLICY "invoices staff select" ON public.invoices
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (
      public.is_admin()
      OR (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id))
    )
    AND deleted_at IS NULL
  );

-- 3. evidence — "evidence staff all" (ALL, PUBLIC): narrow read+write to admin OR assigned-supervisor
DROP POLICY IF EXISTS "evidence staff all" ON public.evidence;
CREATE POLICY "evidence staff all" ON public.evidence
  AS PERMISSIVE FOR ALL TO public
  USING (
    public.is_admin()
    OR (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id))
  );

-- 4. case_messages — "msgs_supervisor_all" (ALL): supervisor-only → assigned-supervisor-only
DROP POLICY IF EXISTS "msgs_supervisor_all" ON public.case_messages;
CREATE POLICY "msgs_supervisor_all" ON public.case_messages
  AS PERMISSIVE FOR ALL TO public
  USING (
    public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id)
  )
  WITH CHECK (
    public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id)
  );

-- 5. target_relationships — "intel_relationships supervisor all" (ALL): same
DROP POLICY IF EXISTS "intel_relationships supervisor all" ON public.target_relationships;
CREATE POLICY "intel_relationships supervisor all" ON public.target_relationships
  AS PERMISSIVE FOR ALL TO public
  USING (
    public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id)
  )
  WITH CHECK (
    public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id)
  );

COMMIT;
