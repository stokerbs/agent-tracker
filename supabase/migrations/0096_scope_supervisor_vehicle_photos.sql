-- 0096 — Close the last supervisor cross-case gap: vehicle_photos.
--
-- 0095 re-scoped target_photos/target_vehicles/target_locations + the
-- intelligence/evidence storage reads, but missed a fourth sibling intel table
-- that Case Chat (vision) also reads: vehicle_photos (0059), whose
-- "vph_supervisor_all" policy is still blanket current_role()='supervisor'.
-- The storage object read is already locked by 0095, so the residual exposure is
-- row metadata (storage_path/vehicle_id/case_id) — but it's the same defect, so
-- scope it to assigned cases for consistency.

DROP POLICY IF EXISTS "vph_supervisor_all" ON public.vehicle_photos;
CREATE POLICY "vph_supervisor_all" ON public.vehicle_photos FOR ALL
  USING      (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id))
  WITH CHECK (public."current_role"() = 'supervisor'::public.user_role AND public.can_access_case(case_id));
