-- Migration 0007: add encrypted PII columns to public.cases
--
-- Additive only. Existing plaintext columns are preserved unchanged.
-- Application code will dual-write during the transition period (Phase 3).
-- Plaintext columns will be dropped in a future migration once backfill
-- is complete and all reads have been moved to the _enc columns.

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS target_name_enc    TEXT,
  ADD COLUMN IF NOT EXISTS target_name_bidx   TEXT,
  ADD COLUMN IF NOT EXISTS target_phone_enc   TEXT,
  ADD COLUMN IF NOT EXISTS target_phone_bidx  TEXT,
  ADD COLUMN IF NOT EXISTS target_vehicle_enc TEXT,
  ADD COLUMN IF NOT EXISTS license_plate_enc  TEXT,
  ADD COLUMN IF NOT EXISTS license_plate_bidx TEXT,
  ADD COLUMN IF NOT EXISTS target_address_enc TEXT;

-- Blind-index columns are the search surface for encrypted PII.
-- Indexes on them restore the lookup performance that a plaintext index
-- would have provided.
CREATE INDEX IF NOT EXISTS cases_target_name_bidx_idx
  ON public.cases (target_name_bidx);

CREATE INDEX IF NOT EXISTS cases_target_phone_bidx_idx
  ON public.cases (target_phone_bidx);

CREATE INDEX IF NOT EXISTS cases_license_plate_bidx_idx
  ON public.cases (license_plate_bidx);

-- Column documentation
COMMENT ON COLUMN public.cases.target_name_enc
  IS 'AES-256-GCM encrypted target name (application-layer, key never touches DB)';
COMMENT ON COLUMN public.cases.target_name_bidx
  IS 'HMAC-SHA256 blind index for exact-match target name search';

COMMENT ON COLUMN public.cases.target_phone_enc
  IS 'AES-256-GCM encrypted target phone number';
COMMENT ON COLUMN public.cases.target_phone_bidx
  IS 'HMAC-SHA256 blind index for exact-match phone search (digits-only normalised)';

COMMENT ON COLUMN public.cases.target_vehicle_enc
  IS 'AES-256-GCM encrypted target vehicle description';

COMMENT ON COLUMN public.cases.license_plate_enc
  IS 'AES-256-GCM encrypted license plate number';
COMMENT ON COLUMN public.cases.license_plate_bidx
  IS 'HMAC-SHA256 blind index for exact-match license plate search (uppercased, no spaces/dashes)';

COMMENT ON COLUMN public.cases.target_address_enc
  IS 'AES-256-GCM encrypted target address';
