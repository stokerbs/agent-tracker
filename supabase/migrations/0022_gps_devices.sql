-- Migration 0022 — GPS devices per case
--
-- Adds:
--   gps_provider enum   (AIS | TRUE | DTAC)
--   gps_devices table   — multiple trackers per case, soft-deleted

BEGIN;

-- ── Enum ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gps_provider') THEN
    CREATE TYPE public.gps_provider AS ENUM ('AIS', 'TRUE', 'DTAC');
  END IF;
END;
$$;

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gps_devices (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id      uuid        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  imei         varchar(15) NULL,
  phone_number text        NULL,
  provider     public.gps_provider NULL,
  notes        text        NULL,
  created_by   uuid        REFERENCES public.profiles(id),
  deleted_at   timestamptz NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL,
  -- IMEI: 15 digits when provided
  CONSTRAINT gps_devices_imei_format CHECK (imei IS NULL OR (imei ~ '^\d{15}$'))
);

CREATE INDEX IF NOT EXISTS gps_devices_case_id_idx ON public.gps_devices (case_id);
CREATE INDEX IF NOT EXISTS gps_devices_active_idx  ON public.gps_devices (case_id) WHERE deleted_at IS NULL;

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_gps_devices_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gps_devices_updated_at ON public.gps_devices;
CREATE TRIGGER gps_devices_updated_at
  BEFORE UPDATE ON public.gps_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_gps_devices_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.gps_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gps_devices admin all"       ON public.gps_devices;
DROP POLICY IF EXISTS "gps_devices supervisor read" ON public.gps_devices;
DROP POLICY IF EXISTS "gps_devices supervisor edit" ON public.gps_devices;
DROP POLICY IF EXISTS "gps_devices agent read"      ON public.gps_devices;

-- Admin: full CRUD
CREATE POLICY "gps_devices admin all" ON public.gps_devices
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Supervisor: read all + update (no delete)
CREATE POLICY "gps_devices supervisor read" ON public.gps_devices
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'supervisor')
  ));

CREATE POLICY "gps_devices supervisor edit" ON public.gps_devices
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'supervisor'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'supervisor'
  ));

-- Agent: read only for cases they are assigned to
CREATE POLICY "gps_devices agent read" ON public.gps_devices
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.case_agents ca
    JOIN public.agents a ON a.id = ca.agent_id
    WHERE ca.case_id = gps_devices.case_id
      AND a.profile_id = auth.uid()
      AND gps_devices.deleted_at IS NULL
  ));

-- Clients: no access (no policy = deny)

COMMIT;
