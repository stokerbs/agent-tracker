-- Migration 0040 — Production schema sync
--
-- Consolidates 0038 and 0039 for production deployment.
-- Idempotent: IF NOT EXISTS on all CREATE; DROP IF EXISTS before every CREATE POLICY.
--
-- Execution order is critical:
--   Phase 1: Create tables (dependencies satisfied before policies that cross-reference them)
--   Phase 2: Add columns
--   Phase 3: Indexes
--   Phase 4: Enable RLS
--   Phase 5–8: Create policies (all referenced tables now exist)
--
-- BREAKING: gps_devices supervisor read policy is DROPPED.
-- After running, grant access to supervisors/agents via GPS Device → Permissions tab.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1: Tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- GPS903 device catalog (discovery sync writes here, not to gps_devices)
CREATE TABLE IF NOT EXISTS public.gps903_devices (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  gps903_device_id integer     NOT NULL,
  device_name      text,
  imei             text,
  model            text,
  last_seen        timestamptz,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gps903_devices_pkey          PRIMARY KEY (id),
  CONSTRAINT gps903_devices_gps903_id_key UNIQUE (gps903_device_id)
);

-- Per-device position history (cron polling writes here, not to agents)
CREATE TABLE IF NOT EXISTS public.gps_device_positions (
  id             uuid          NOT NULL DEFAULT gen_random_uuid(),
  gps_device_id  uuid          NOT NULL REFERENCES public.gps_devices(id) ON DELETE CASCADE,
  lat            numeric(10,6) NOT NULL,
  lng            numeric(10,6) NOT NULL,
  speed_kmh      numeric(6,2)  NOT NULL DEFAULT 0,
  heading        integer       NOT NULL DEFAULT 0,
  battery_pct    integer       CHECK (battery_pct BETWEEN 0 AND 100),
  recorded_at    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT gps_device_positions_pkey PRIMARY KEY (id)
);

-- Profile-based access control: which profiles may view which GPS devices.
-- Must be created before policies on gps_device_positions and gps_devices that reference it.
CREATE TABLE IF NOT EXISTS public.gps_device_access (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  gps_device_id  uuid        NOT NULL REFERENCES public.gps_devices(id) ON DELETE CASCADE,
  profile_id     uuid        NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  granted_by     uuid        REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gps_device_access_pkey   PRIMARY KEY (id),
  CONSTRAINT gps_device_access_unique UNIQUE (gps_device_id, profile_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 2: Columns
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.gps_devices
  ADD COLUMN IF NOT EXISTS last_lat         numeric(10,6),
  ADD COLUMN IF NOT EXISTS last_lng         numeric(10,6),
  ADD COLUMN IF NOT EXISTS last_speed_kmh   numeric(6,2),
  ADD COLUMN IF NOT EXISTS last_heading     integer,
  ADD COLUMN IF NOT EXISTS last_battery_pct integer CHECK (last_battery_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS last_seen_at     timestamptz;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 3: Indexes
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS gps903_devices_imei_idx
  ON public.gps903_devices (imei)
  WHERE imei IS NOT NULL;

CREATE INDEX IF NOT EXISTS gps_device_positions_device_time_idx
  ON public.gps_device_positions (gps_device_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS gps_device_positions_recorded_idx
  ON public.gps_device_positions (recorded_at DESC);

CREATE INDEX IF NOT EXISTS gps_device_access_device_idx
  ON public.gps_device_access (gps_device_id);

CREATE INDEX IF NOT EXISTS gps_device_access_profile_idx
  ON public.gps_device_access (profile_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 4: Enable RLS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.gps903_devices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_device_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_device_access    ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 5: gps903_devices policies
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "staff_read_gps903_devices" ON public.gps903_devices;
CREATE POLICY "staff_read_gps903_devices" ON public.gps903_devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 6: gps_device_positions policies
-- gdp_access_read references gps_device_access which now exists (Phase 1).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "gdp_admin_all"      ON public.gps_device_positions;
DROP POLICY IF EXISTS "gdp_access_read"    ON public.gps_device_positions;
DROP POLICY IF EXISTS "gdp_service_insert" ON public.gps_device_positions;

CREATE POLICY "gdp_admin_all" ON public.gps_device_positions
  FOR ALL USING (public.is_admin());

CREATE POLICY "gdp_access_read" ON public.gps_device_positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.gps_device_access gda
      WHERE gda.gps_device_id = gps_device_positions.gps_device_id
        AND gda.profile_id = auth.uid()
    )
  );

CREATE POLICY "gdp_service_insert" ON public.gps_device_positions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 7: gps_device_access policies
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "gda_admin_all"         ON public.gps_device_access;
DROP POLICY IF EXISTS "gda_supervisor_read"   ON public.gps_device_access;
DROP POLICY IF EXISTS "gda_supervisor_write"  ON public.gps_device_access;
DROP POLICY IF EXISTS "gda_supervisor_delete" ON public.gps_device_access;
DROP POLICY IF EXISTS "gda_self_read"         ON public.gps_device_access;

CREATE POLICY "gda_admin_all" ON public.gps_device_access
  FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

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

CREATE POLICY "gda_self_read" ON public.gps_device_access
  FOR SELECT USING (profile_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 8: gps_devices RLS — replace broad policies with access-grant-based ones
--
-- WARNING: After this block, supervisors and agents will see NO GPS devices
-- until the admin explicitly grants access via the DevicePermissionsPanel.
-- The admin "gps_devices admin all" policy is untouched and still grants full access.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop old broad-access policies
DROP POLICY IF EXISTS "gps_devices supervisor read" ON public.gps_devices;
DROP POLICY IF EXISTS "gps_devices supervisor edit" ON public.gps_devices;
DROP POLICY IF EXISTS "gps_devices agent read"      ON public.gps_devices;

-- Drop new policy names in case this migration was partially applied before
DROP POLICY IF EXISTS "gps_devices access read"     ON public.gps_devices;

-- Non-admin read: requires explicit access grant
CREATE POLICY "gps_devices access read" ON public.gps_devices
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.gps_device_access gda
      WHERE gda.gps_device_id = gps_devices.id
        AND gda.profile_id = auth.uid()
    )
  );

-- Supervisor update: must have an access grant for this specific device
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

COMMIT;
