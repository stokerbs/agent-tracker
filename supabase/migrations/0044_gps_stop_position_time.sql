-- Add position time and stop duration tracking to gps_devices.
-- Populated by the GPS903 polling cron from GetTracking response fields:
--   last_position_time  ← deviceUtcDate (when the GPS device recorded the fix)
--   last_stop_minutes   ← stopTimeMinute (integer) or parsed from "3Hour20Minute" string

ALTER TABLE public.gps_devices
  ADD COLUMN IF NOT EXISTS last_position_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_stop_minutes  INTEGER;
