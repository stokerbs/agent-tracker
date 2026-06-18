-- Migration 0039 — GPS device position telemetry + access control
--
-- Separates GPS device telemetry from agent data:
--   1. gps_device_positions — per-device position history (lat/lng/speed/heading/battery)
--   2. last_* columns on gps_devices — denormalized for fast map display
--   3. gps_device_access — which agents/supervisors may view which GPS devices
--
-- GPS903 polling now writes to gps_device_positions, NOT to agents.

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

-- Partition-friendly retention index (for future pruning of old rows)
CREATE INDEX IF NOT EXISTS gps_device_positions_recorded_idx
  ON public.gps_device_positions (recorded_at DESC);

ALTER TABLE public.gps_device_positions ENABLE ROW LEVEL SECURITY;

-- Staff read
CREATE POLICY "gdp_staff_read" ON public.gps_device_positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'supervisor')
    )
  );

-- Agent read — only for devices explicitly shared with them via gps_device_access
CREATE POLICY "gdp_agent_read" ON public.gps_device_positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.gps_device_access gda
      JOIN public.agents a ON a.id = gda.agent_id
      WHERE gda.gps_device_id = gps_device_positions.gps_device_id
        AND a.profile_id = auth.uid()
    )
  );

-- ── 2. Denormalized last-known position on gps_devices ────────────────────────
-- Updated on every successful poll; avoids MAX(recorded_at) aggregation for map.

ALTER TABLE public.gps_devices
  ADD COLUMN IF NOT EXISTS last_lat         numeric(10,6),
  ADD COLUMN IF NOT EXISTS last_lng         numeric(10,6),
  ADD COLUMN IF NOT EXISTS last_speed_kmh   numeric(6,2),
  ADD COLUMN IF NOT EXISTS last_heading     integer,
  ADD COLUMN IF NOT EXISTS last_battery_pct integer CHECK (last_battery_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS last_seen_at     timestamptz;

-- ── 3. Access control ─────────────────────────────────────────────────────────
-- Many-to-many: multiple agents (or supervisors) may view a single GPS device.

CREATE TABLE IF NOT EXISTS public.gps_device_access (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  gps_device_id  uuid        NOT NULL REFERENCES public.gps_devices(id) ON DELETE CASCADE,
  agent_id       uuid        NOT NULL REFERENCES public.agents(id)      ON DELETE CASCADE,
  granted_by     uuid        REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gps_device_access_pkey   PRIMARY KEY (id),
  CONSTRAINT gps_device_access_unique UNIQUE (gps_device_id, agent_id)
);

CREATE INDEX IF NOT EXISTS gps_device_access_device_idx ON public.gps_device_access (gps_device_id);
CREATE INDEX IF NOT EXISTS gps_device_access_agent_idx  ON public.gps_device_access (agent_id);

ALTER TABLE public.gps_device_access ENABLE ROW LEVEL SECURITY;

-- Staff: full control over access grants
CREATE POLICY "gda_staff_all" ON public.gps_device_access
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
  );

-- Agent: read their own access records
CREATE POLICY "gda_agent_read_own" ON public.gps_device_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = gps_device_access.agent_id AND a.profile_id = auth.uid()
    )
  );

COMMIT;
