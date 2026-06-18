-- Migration 0041 — GPS903 multi-device credential storage
--
-- Adds per-device IMEI/password credential storage, replacing the single-device
-- GPS903_IMEI + GPS903_DEVICE_PASSWORD + GPS903_DEVICE_ID environment variables.
-- Supports unlimited GPS903 devices, each with its own IMEI login session.
--
-- No existing data is modified. gps903_session remains intact but is no longer used
-- by new code (which uses gps903_credential_sessions keyed per device).

BEGIN;

-- ── GPS903 per-device credentials ────────────────────────────────────────────
-- Admin/supervisor managed via UI. device_password stored server-side only;
-- never exposed to browser (all access via service client + requireRole).

CREATE TABLE IF NOT EXISTS public.gps903_credentials (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  device_name      text        NOT NULL,
  imei             text        NOT NULL,
  device_password  text        NOT NULL,
  gps903_device_id integer     NOT NULL,
  is_active        boolean     NOT NULL DEFAULT true,
  last_synced_at   timestamptz,
  last_sync_ok     boolean,
  created_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gps903_credentials_pkey             PRIMARY KEY (id),
  CONSTRAINT gps903_credentials_imei_unique      UNIQUE (imei),
  CONSTRAINT gps903_credentials_device_id_unique UNIQUE (gps903_device_id),
  CONSTRAINT gps903_credentials_imei_format      CHECK (imei ~ '^\d{15}$')
);

ALTER TABLE public.gps903_credentials ENABLE ROW LEVEL SECURITY;
-- No user-facing RLS policies. All reads/writes go through server actions that
-- call createServiceClient() with requireRole() enforced at the application layer.
-- Passwords never leave the server environment.

-- ── Per-credential session cache ─────────────────────────────────────────────
-- One row per credential. Replaces the gps903_session singleton (id=1).
-- Each IMEI login produces a distinct ASP.NET session cookie.

CREATE TABLE IF NOT EXISTS public.gps903_credential_sessions (
  credential_id  uuid        NOT NULL PRIMARY KEY
                             REFERENCES public.gps903_credentials(id) ON DELETE CASCADE,
  session_cookie text        NOT NULL,
  expires_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gps903_credential_sessions ENABLE ROW LEVEL SECURITY;
-- Service role only — no user-facing policies.

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_gps903_credentials_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gps903_credentials_updated_at ON public.gps903_credentials;
CREATE TRIGGER gps903_credentials_updated_at
  BEFORE UPDATE ON public.gps903_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_gps903_credentials_updated_at();

COMMIT;
