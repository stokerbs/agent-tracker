-- Track when a GPS device last became stationary, so we can show a "stop time"
-- (parked duration) on the monitor. The GPS903 GetTracking endpoint only
-- returns an isStop boolean, not a duration, so we derive it: stopped_since is
-- set on the first stationary fix and cleared on movement; last_stop_minutes is
-- computed from it on each poll.

BEGIN;

ALTER TABLE public.gps_devices ADD COLUMN IF NOT EXISTS stopped_since timestamptz;

COMMIT;
