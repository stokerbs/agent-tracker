-- 0093 — Anomaly Watch controls & accuracy.
--
-- 1. Per-device opt-out: anomaly_watch_enabled lets staff turn proactive
--    anomaly alerts on/off for an individual tracked device (default on, so
--    existing devices keep current behaviour).
--
-- 2. Per-fix locate mode: gps_device_positions.locate_mode records whether each
--    stored fix came from real GPS or cell-tower LBS (which can be off by 1–2km).
--    The anomaly-watch "new-location" check ignores LBS fixes so a fuzzy LBS
--    position can't masquerade as the subject visiting somewhere new.
--    NULL = unknown (legacy rows / pre-classification) → treated as usable.

alter table public.gps_devices
  add column if not exists anomaly_watch_enabled boolean not null default true;

alter table public.gps_device_positions
  add column if not exists locate_mode text;

comment on column public.gps_devices.anomaly_watch_enabled is
  'When false, the anomaly-watch cron skips this device (no proactive alerts).';
comment on column public.gps_device_positions.locate_mode is
  'Positioning source for this fix: gps | lbs | unknown. Used to exclude fuzzy LBS fixes from new-location detection.';
