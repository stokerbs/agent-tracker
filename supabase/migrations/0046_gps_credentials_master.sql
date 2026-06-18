-- gps903_credentials becomes the single source of truth for GPS device metadata.
-- Adds phone_number and provider columns to credentials, and adds credential_id FK to gps_devices.

-- Step 1: Add metadata columns to gps903_credentials
ALTER TABLE public.gps903_credentials
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS provider     TEXT;

-- Step 2: Link gps_devices rows to their source credential
ALTER TABLE public.gps_devices
  ADD COLUMN IF NOT EXISTS credential_id UUID
    REFERENCES public.gps903_credentials(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS gps_devices_credential_id_idx
  ON public.gps_devices (credential_id);

-- Step 3: Backfill credential_id using gps903_device_id match (primary path)
UPDATE public.gps_devices d
SET credential_id = c.id
FROM public.gps903_credentials c
WHERE d.gps903_device_id IS NOT NULL
  AND d.gps903_device_id = c.gps903_device_id
  AND d.credential_id IS NULL
  AND d.deleted_at IS NULL;

-- Step 4: Backfill remaining unlinked rows using IMEI match
UPDATE public.gps_devices d
SET credential_id = c.id
FROM public.gps903_credentials c
WHERE d.imei IS NOT NULL
  AND d.imei = c.imei
  AND d.credential_id IS NULL
  AND d.deleted_at IS NULL;

-- Step 5: Copy phone_number + provider from gps_devices to credentials where still empty
--         Uses the first linked device row per credential (DISTINCT ON)
UPDATE public.gps903_credentials c
SET
  phone_number = COALESCE(c.phone_number, d.phone_number),
  provider     = COALESCE(c.provider,     d.provider)
FROM (
  SELECT DISTINCT ON (credential_id)
    credential_id, phone_number, provider
  FROM public.gps_devices
  WHERE deleted_at IS NULL
    AND credential_id IS NOT NULL
  ORDER BY credential_id, created_at ASC
) d
WHERE d.credential_id = c.id
  AND (c.phone_number IS NULL OR c.provider IS NULL);
