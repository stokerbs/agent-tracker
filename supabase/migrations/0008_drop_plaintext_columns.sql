-- Migration 0008: Drop plaintext PII columns.
-- All PII is now stored exclusively in the *_enc and *_bidx columns.
-- The database contains zero rows, so no backfill or fallback reads are needed.

ALTER TABLE public.cases
  DROP COLUMN IF EXISTS target_name,
  DROP COLUMN IF EXISTS target_phone,
  DROP COLUMN IF EXISTS target_vehicle,
  DROP COLUMN IF EXISTS license_plate,
  DROP COLUMN IF EXISTS target_address;
