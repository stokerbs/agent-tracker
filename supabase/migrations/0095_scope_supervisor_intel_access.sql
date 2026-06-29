-- 0095 — Close the supervisor cross-case gap on target intelligence.
--
-- Migration 0087 scoped the SUPERVISOR branch of cases / evidence / invoices /
-- case_messages / target_relationships to can_access_case(), but MISSED three
-- sibling intel tables and the two storage buckets they live in. They still grant
-- EVERY supervisor access to EVERY case's data:
--   • target_photos / target_vehicles / target_locations  — blanket
--     `current_role() = 'supervisor'` (0057)
--   • storage 'intelligence' + 'evidence' read              — blanket is_staff()
--     (0057 / 0004) → signed URLs for any case's objects
--
-- Case Chat (vision) reads exactly these, which would turn the latent gap into an
-- active cross-case exfil channel over decrypted plates/addresses + imagery. We
-- re-scope the supervisor branch to can_access_case (mirroring 0087 §5) and split
-- the blanket staff storage-read into admin-all + assigned-supervisor, reusing the
-- existing agent folder-match pattern (text compare on case_id → no uuid cast, so
-- non-case folders simply don't match). Admin and agent access are unchanged.

-- ── 1. target_photos ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "intel_photos supervisor all" ON public.target_photos;
CREATE POLICY "intel_photos supervisor all" ON public.target_photos FOR ALL
  USING      (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id))
  WITH CHECK (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id));

-- ── 2. target_vehicles ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "intel_vehicles supervisor all" ON public.target_vehicles;
CREATE POLICY "intel_vehicles supervisor all" ON public.target_vehicles FOR ALL
  USING      (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id))
  WITH CHECK (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id));

-- ── 3. target_locations ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "intel_locations supervisor all" ON public.target_locations;
CREATE POLICY "intel_locations supervisor all" ON public.target_locations FOR ALL
  USING      (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id))
  WITH CHECK (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id));

-- ── 4. storage: intelligence bucket read ─────────────────────────────────────
-- Split blanket is_staff read → admin (all) + supervisor (assigned cases only).
DROP POLICY IF EXISTS "intel bucket staff read" ON storage.objects;

CREATE POLICY "intel bucket admin read" ON storage.objects FOR SELECT
  USING (bucket_id = 'intelligence' AND public.is_admin());

CREATE POLICY "intel bucket supervisor read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'intelligence'
    AND public."current_role"() = 'supervisor'::public.user_role
    AND EXISTS (
      SELECT 1 FROM public.case_agents ca
      JOIN   public.agents a ON a.id = ca.agent_id
      WHERE  a.profile_id = auth.uid()
        AND  (storage.foldername(name))[1] = ca.case_id::text
    )
  );

-- ── 5. storage: evidence bucket read ─────────────────────────────────────────
DROP POLICY IF EXISTS "evidence staff read" ON storage.objects;

CREATE POLICY "evidence admin read" ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence' AND public.is_admin());

CREATE POLICY "evidence supervisor read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'evidence'
    AND public."current_role"() = 'supervisor'::public.user_role
    AND EXISTS (
      SELECT 1 FROM public.case_agents ca
      JOIN   public.agents a ON a.id = ca.agent_id
      WHERE  a.profile_id = auth.uid()
        AND  (storage.foldername(name))[1] = ca.case_id::text
    )
  );
