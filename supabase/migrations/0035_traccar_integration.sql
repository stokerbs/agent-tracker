-- Migration 0035 — Traccar/GPS903 Integration
--
-- Adds GPS903 as a provider option and links gps_devices to agents so that
-- the Traccar webhook can resolve IMEI → agent and update the Live Map.

BEGIN;

-- ── Extend provider enum ──────────────────────────────────────────────────────

ALTER TYPE public.gps_provider ADD VALUE IF NOT EXISTS 'GPS903';

-- ── Add Traccar columns to gps_devices ───────────────────────────────────────

ALTER TABLE public.gps_devices
  ADD COLUMN IF NOT EXISTS agent_id   uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS traccar_id integer;

-- Fast IMEI lookup for the webhook handler
CREATE INDEX IF NOT EXISTS gps_devices_imei_idx
  ON public.gps_devices (imei)
  WHERE imei IS NOT NULL AND deleted_at IS NULL;

COMMIT;
