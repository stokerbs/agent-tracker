-- 0057_target_intelligence.sql
-- Target Intelligence module: photos, vehicles, locations.
-- Clients have NO access to any of these tables (RLS default-deny).
-- Agents can only read records for cases they are assigned to.

-- ─── 1. Target photos ────────────────────────────────────────────────────────
CREATE TABLE public.target_photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      uuid        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  is_primary   boolean     NOT NULL DEFAULT false,
  caption      text,
  uploaded_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX target_photos_case_idx ON public.target_photos (case_id);

-- ─── 2. Target vehicles ───────────────────────────────────────────────────────
CREATE TABLE public.target_vehicles (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            uuid        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  make               text,
  model              text,
  color              text,
  license_plate_enc  text,
  license_plate_bidx text,
  notes              text,
  is_primary         boolean     NOT NULL DEFAULT false,
  photo_url          text,       -- path in intelligence bucket
  created_by         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX target_vehicles_case_idx  ON public.target_vehicles (case_id);
CREATE INDEX target_vehicles_plate_idx ON public.target_vehicles (license_plate_bidx)
  WHERE license_plate_bidx IS NOT NULL;

CREATE TRIGGER trg_target_vehicles_updated
  BEFORE UPDATE ON public.target_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. Target locations ──────────────────────────────────────────────────────
CREATE TABLE public.target_locations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       uuid        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  location_type text        NOT NULL DEFAULT 'other', -- 'home' | 'workplace' | 'other'
  label         text,       -- custom label when type = 'other'
  address_enc   text,       -- encrypted street address
  lat           double precision,
  lng           double precision,
  notes         text,
  photo_url     text,       -- path in intelligence bucket
  created_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX target_locations_case_idx ON public.target_locations (case_id);

CREATE TRIGGER trg_target_locations_updated
  BEFORE UPDATE ON public.target_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. RLS — target_photos ───────────────────────────────────────────────────
ALTER TABLE public.target_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intel_photos admin all"
  ON public.target_photos FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "intel_photos supervisor all"
  ON public.target_photos FOR ALL
  USING  (public.current_role() = 'supervisor')
  WITH CHECK (public.current_role() = 'supervisor');

CREATE POLICY "intel_photos agent read"
  ON public.target_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_agents ca
      JOIN   public.agents a ON a.id = ca.agent_id
      WHERE  ca.case_id = target_photos.case_id
        AND  a.profile_id = auth.uid()
    )
  );

-- ─── 5. RLS — target_vehicles ─────────────────────────────────────────────────
ALTER TABLE public.target_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intel_vehicles admin all"
  ON public.target_vehicles FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "intel_vehicles supervisor all"
  ON public.target_vehicles FOR ALL
  USING  (public.current_role() = 'supervisor')
  WITH CHECK (public.current_role() = 'supervisor');

CREATE POLICY "intel_vehicles agent read"
  ON public.target_vehicles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_agents ca
      JOIN   public.agents a ON a.id = ca.agent_id
      WHERE  ca.case_id = target_vehicles.case_id
        AND  a.profile_id = auth.uid()
    )
  );

-- ─── 6. RLS — target_locations ────────────────────────────────────────────────
ALTER TABLE public.target_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intel_locations admin all"
  ON public.target_locations FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "intel_locations supervisor all"
  ON public.target_locations FOR ALL
  USING  (public.current_role() = 'supervisor')
  WITH CHECK (public.current_role() = 'supervisor');

CREATE POLICY "intel_locations agent read"
  ON public.target_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_agents ca
      JOIN   public.agents a ON a.id = ca.agent_id
      WHERE  ca.case_id = target_locations.case_id
        AND  a.profile_id = auth.uid()
    )
  );

-- ─── 7. Intelligence storage bucket ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('intelligence', 'intelligence', false)
ON CONFLICT (id) DO NOTHING;

-- Staff: full write
CREATE POLICY "intel bucket staff insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'intelligence' AND public.is_staff());

CREATE POLICY "intel bucket staff update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'intelligence' AND public.is_staff());

CREATE POLICY "intel bucket staff delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'intelligence' AND public.is_staff());

-- Staff read (for server-side signed URL generation)
CREATE POLICY "intel bucket staff read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'intelligence' AND public.is_staff());

-- Assigned agents: read-only (server generates signed URLs)
CREATE POLICY "intel bucket agent read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'intelligence'
    AND public.current_role() = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.case_agents ca
      JOIN   public.agents a ON a.id = ca.agent_id
      WHERE  a.profile_id = auth.uid()
        AND  (storage.foldername(name))[1] = ca.case_id::text
    )
  );
