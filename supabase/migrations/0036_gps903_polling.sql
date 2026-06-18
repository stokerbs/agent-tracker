-- Migration 0036 — GPS903 Web API Polling
--
-- Adds GPS903 internal device ID to gps_devices (used by the polling cron)
-- and a singleton session table for caching the ASP.NET_SessionId cookie.

BEGIN;

-- ── gps903_device_id on gps_devices ──────────────────────────────────────────

ALTER TABLE public.gps_devices
  ADD COLUMN IF NOT EXISTS gps903_device_id integer;

COMMENT ON COLUMN public.gps_devices.gps903_device_id IS
  'GPS903 internal integer device ID used by GetTracking API. '
  'Find it in the GPS903 web platform device list URL or source.';

CREATE INDEX IF NOT EXISTS gps_devices_gps903_id_idx
  ON public.gps_devices (gps903_device_id)
  WHERE gps903_device_id IS NOT NULL AND deleted_at IS NULL;

-- ── GPS903 session cache (singleton row) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gps903_session (
  id             integer     PRIMARY KEY DEFAULT 1
                             CONSTRAINT gps903_session_singleton CHECK (id = 1),
  session_cookie text        NOT NULL,
  expires_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gps903_session ENABLE ROW LEVEL SECURITY;
-- Only service role accesses this table (no user-facing policies needed).

COMMIT;
