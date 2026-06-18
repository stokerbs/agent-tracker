-- Migration 0039 — GPS device position telemetry + profile-based access control
--
-- Separates GPS device telemetry from agent data:
--   1. gps_device_positions — per-device position history (lat/lng/speed/heading/battery)
--   2. last_* columns on gps_devices — denormalized for fast map display
--   3. gps_device_access — profiles (not agents) that may view a GPS device
--
-- Permissions are profile-based (auth.uid() = profiles.id).
-- Admins bypass all restrictions.
-- GPS903 polling writes to gps_device_positions, NOT to agents.

BEGIN;

-- ── 1. Position history ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gps_device_positions (
  id             uuid         NOT NULL DEFAULT gen_random_uuid(),
  gps_device_id  uuid         NOT NULL REFERENCES public.gps_devices(id) ON DELETE CASCADE,
  lat            numeric(10,6) NOT NULL,
  lng            numeric(10,6) NOT NULL,
  speed_kmh      numeric(6,2) NOT NULL DEFAULT 0,
  heading        integer      NOT NULL DEFAULT 0,
  battery_pct    integer      CHECK (battery_pct BETWEEN 0 AND 100),
  recorded_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT gps_device_positions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS gps_device_positions_device_time_idx
  ON public.gps_device_positions (gps_device_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS gps_device_positions_recorded_idx
  ON public.gps_device_positions (recorded_at DESC);

ALTER TABLE public.gps_device_positions ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "gdp_admin_all" ON public.gps_device_positions
  FOR ALL USING (public.is_admin());

-- Non-admin: read positions only for devices they have explicit access to
CREATE POLICY "gdp_access_read" ON public.gps_device_positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.gps_device_access gda
      WHERE gda.gps_device_id = gps_device_positions.gps_device_id
        AND gda.profile_id = auth.uid()
    )
  );

-- Service role write (cron / polling — bypasses RLS)
CREATE POLICY "gdp_service_insert" ON public.gps_device_positions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ── 2. Denormalized last-known position on gps_devices ────────────────────────

ALTER TABLE public.gps_devices
  ADD COLUMN IF NOT EXISTS last_lat         numeric(10,6),
  ADD COLUMN IF NOT EXISTS last_lng         numeric(10,6),
  ADD COLUMN IF NOT EXISTS last_speed_kmh   numeric(6,2),
  ADD COLUMN IF NOT EXISTS last_heading     integer,
  ADD COLUMN IF NOT EXISTS last_battery_pct integer CHECK (last_battery_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS last_seen_at     timestamptz;

-- ── 3. Update gps_devices RLS ─────────────────────────────────────────────────
-- Replace the old "supervisor read all" and "agent case-based read" policies
-- with a single profile-based access policy backed by gps_device_access.

DROP POLICY IF EXISTS "gps_devices supervisor read" ON public.gps_devices;
DROP POLICY IF EXISTS "gps_devices supervisor edit" ON public.gps_devices;
DROP POLICY IF EXISTS "gps_devices agent read"      ON public.gps_devices;

-- Non-admin read: only devices with an explicit access grant for this profile
CREATE POLICY "gps_devices access read" ON public.gps_devices
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.gps_device_access gda
      WHERE gda.gps_device_id = gps_devices.id
        AND gda.profile_id = auth.uid()
    )
  );

-- Supervisor update: must have explicit access to the device
CREATE POLICY "gps_devices supervisor edit" ON public.gps_devices
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'supervisor')
    AND EXISTS (
      SELECT 1 FROM public.gps_device_access gda
      WHERE gda.gps_device_id = gps_devices.id AND gda.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'supervisor')
  );

-- ── 4. Access control table ───────────────────────────────────────────────────
-- Many-to-many: which profiles may view which GPS devices.
-- Uses profiles.id (= auth.uid()) directly — no indirection through agents.

CREATE TABLE IF NOT EXISTS public.gps_device_access (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  gps_device_id  uuid        NOT NULL REFERENCES public.gps_devices(id) ON DELETE CASCADE,
  profile_id     uuid        NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  granted_by     uuid        REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gps_device_access_pkey   PRIMARY KEY (id),
  CONSTRAINT gps_device_access_unique UNIQUE (gps_device_id, profile_id)
);

CREATE INDEX IF NOT EXISTS gps_device_access_device_idx  ON public.gps_device_access (gps_device_id);
CREATE INDEX IF NOT EXISTS gps_device_access_profile_idx ON public.gps_device_access (profile_id);

ALTER TABLE public.gps_device_access ENABLE ROW LEVEL SECURITY;

-- Admin: full control
CREATE POLICY "gda_admin_all" ON public.gps_device_access
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Supervisor: read all grants for devices they have access to; write new grants
CREATE POLICY "gda_supervisor_read" ON public.gps_device_access
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'supervisor')
  );

CREATE POLICY "gda_supervisor_write" ON public.gps_device_access
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'supervisor')
  );

CREATE POLICY "gda_supervisor_delete" ON public.gps_device_access
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'supervisor')
  );

-- Any profile: read their own access records (to know which devices they can see)
CREATE POLICY "gda_self_read" ON public.gps_device_access
  FOR SELECT USING (profile_id = auth.uid());

COMMIT;
