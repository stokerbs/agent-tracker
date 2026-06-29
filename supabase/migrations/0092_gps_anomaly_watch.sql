-- 0092 — AI Anomaly Watch dedup state.
--
-- The anomaly-watch cron (/api/cron/anomaly-watch) scans each tracked device's
-- recent GPS behaviour against its 2-week baseline and notifies staff when it
-- detects something surveillance-relevant (new location, unusual night
-- movement, a normally-reporting device going dark).
--
-- To avoid re-notifying the same ongoing anomaly every run, we persist a
-- "signature" of the last-alerted anomaly set per device. The cron only fires a
-- new notification when the freshly computed signature differs from this one.
-- No data backfill needed: NULL signature means "never alerted", which always
-- differs from any real anomaly signature.

alter table public.gps_devices
  add column if not exists anomaly_signature  text,
  add column if not exists anomaly_notified_at timestamptz;

comment on column public.gps_devices.anomaly_signature is
  'Signature of the most recently notified anomaly set (set by anomaly-watch cron). Re-notification fires only when the computed signature changes.';
comment on column public.gps_devices.anomaly_notified_at is
  'When the last anomaly notification for this device was sent.';
