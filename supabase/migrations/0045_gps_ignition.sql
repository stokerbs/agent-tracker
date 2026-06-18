-- Store the ACC (ignition) state from GPS903's dataContext[0] field.
-- true = ACC on (engine running), false = ACC off, null = no data yet.
ALTER TABLE public.gps_devices
  ADD COLUMN IF NOT EXISTS last_ignition BOOLEAN;
