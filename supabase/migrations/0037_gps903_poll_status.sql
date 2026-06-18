-- Migration 0037 — GPS903 poll status columns
--
-- Tracks per-device polling health so the Device Management page
-- can surface which devices are successfully being polled.

BEGIN;

ALTER TABLE public.gps_devices
  ADD COLUMN IF NOT EXISTS last_polled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_poll_ok   boolean;

COMMIT;
