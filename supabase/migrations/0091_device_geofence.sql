-- Smart-geofence follow-ups for GPS devices:
--  • hysteresis: track the device's current fence membership + last-alert time
--    so boundary jitter can't spam alerts (a confirmed change past a cooldown
--    is required).
--  • audit log: let geofence_events record device crossings (the table was
--    agent-only).

BEGIN;

-- Device fence state for hysteresis.
ALTER TABLE public.gps_devices ADD COLUMN IF NOT EXISTS geofence_id uuid
  REFERENCES public.geofences(id) ON DELETE SET NULL;
ALTER TABLE public.gps_devices ADD COLUMN IF NOT EXISTS geofence_alerted_at timestamptz;

-- geofence_events: allow device crossings (was agent-only).
ALTER TABLE public.geofence_events ADD COLUMN IF NOT EXISTS gps_device_id uuid
  REFERENCES public.gps_devices(id) ON DELETE CASCADE;
ALTER TABLE public.geofence_events ALTER COLUMN agent_id DROP NOT NULL;

-- Exactly one subject (agent or device) must be set.
ALTER TABLE public.geofence_events DROP CONSTRAINT IF EXISTS geofence_events_subject_chk;
ALTER TABLE public.geofence_events ADD CONSTRAINT geofence_events_subject_chk
  CHECK (agent_id IS NOT NULL OR gps_device_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_geo_events_device_time
  ON public.geofence_events(gps_device_id, occurred_at DESC);

COMMIT;
