-- 0059_vehicle_photos.sql
-- Multi-photo gallery for target vehicles.
-- Reuses the existing intelligence storage bucket and its policies.
-- target_vehicles.photo_url is kept as a denormalized primary photo path
-- so the field intel view stays fast (no join needed for the hero shot).

CREATE TABLE IF NOT EXISTS public.vehicle_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID        NOT NULL REFERENCES public.target_vehicles(id) ON DELETE CASCADE,
  case_id      UUID        NOT NULL REFERENCES public.cases(id)           ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  is_primary   BOOLEAN     NOT NULL DEFAULT FALSE,
  uploaded_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle
  ON public.vehicle_photos (vehicle_id, created_at);

CREATE INDEX IF NOT EXISTS idx_vehicle_photos_case
  ON public.vehicle_photos (case_id);

ALTER TABLE public.vehicle_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vph_admin_all" ON public.vehicle_photos
  FOR ALL USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "vph_supervisor_all" ON public.vehicle_photos
  FOR ALL USING  (public.current_role() = 'supervisor')
  WITH CHECK (public.current_role() = 'supervisor');

-- Agents: read-only, scoped to assigned cases
CREATE POLICY "vph_agent_select" ON public.vehicle_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.case_agents ca
      JOIN   public.agents a ON a.id = ca.agent_id
      WHERE  ca.case_id = vehicle_photos.case_id
        AND  a.profile_id = auth.uid()
    )
  );
-- Note: intelligence bucket storage policies from 0057 already cover
-- paths under {case_id}/vehicles/... for both staff and assigned agents.
