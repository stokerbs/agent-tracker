-- =============================================================
-- 0028_map_upgrade.sql
-- Live Map module upgrade: speed, heading, vehicle type,
-- location history (trails), geofences, geofence events
-- =============================================================

-- ── Agents: new telemetry columns ──────────────────────────
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS speed_kmh    real      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heading      smallint  DEFAULT 0
    CONSTRAINT agents_heading_range CHECK (heading >= 0 AND heading < 360),
  ADD COLUMN IF NOT EXISTS vehicle_type text
    CONSTRAINT agents_vehicle_type_values
      CHECK (vehicle_type IN ('car', 'motorcycle', 'foot', 'supervisor', 'emergency'));

-- ── Agent location history (trail feature) ─────────────────
CREATE TABLE IF NOT EXISTS public.agent_location_history (
  id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid             NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  speed_kmh   real,
  heading     smallint,
  recorded_at timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loc_hist_agent_time
  ON public.agent_location_history(agent_id, recorded_at DESC);

-- Only staff can read; inserts are done server-side via service role key
ALTER TABLE public.agent_location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loc_hist staff read" ON public.agent_location_history
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- ── Geofences (surveillance zones) ────────────────────────
CREATE TABLE IF NOT EXISTS public.geofences (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  coordinates jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- [{lat,lng}, ...]
  color       text        NOT NULL DEFAULT '#3B82F6',
  active      boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geofences staff read" ON public.geofences
  FOR SELECT TO authenticated
  USING (public.is_staff() AND deleted_at IS NULL);

-- Writes are via service role (requireRole admin enforced at app layer)

-- ── Geofence events (enter / exit) ────────────────────────
CREATE TABLE IF NOT EXISTS public.geofence_events (
  id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_id uuid             NOT NULL REFERENCES public.geofences(id) ON DELETE CASCADE,
  agent_id    uuid             NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  event_type  text             NOT NULL CHECK (event_type IN ('enter', 'exit')),
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  occurred_at timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_events_fence_time
  ON public.geofence_events(geofence_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_geo_events_agent_time
  ON public.geofence_events(agent_id, occurred_at DESC);

ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_events staff read" ON public.geofence_events
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- Inserts are via service role from the location API
