-- Add last_locate_mode to gps_devices.
-- Populated by the GPS903 polling cron; tells the map popup whether
-- the device has a GPS satellite fix, is using cell-tower LBS fallback,
-- is offline (polling returned no position), or has an unknown fix type.
-- Allowed values: 'gps' | 'lbs' | 'offline' | 'unknown'

ALTER TABLE public.gps_devices
  ADD COLUMN IF NOT EXISTS last_locate_mode TEXT
    CHECK (last_locate_mode IN ('gps', 'lbs', 'offline', 'unknown'));
