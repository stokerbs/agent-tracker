-- TD-5 (Register #12): the gps903_devices discovery catalog had NO foreign key —
-- it was matched to credentials only in application code, by IMEI. The main
-- working link (gps_devices.credential_id -> gps903_credentials.id) is already
-- enforced; this closes the remaining gap on the catalog table.
--
-- A catalog row is derived from a credential's account during discovery, so its
-- IMEI must reference an existing gps903_credentials row. Target column qualifies:
-- gps903_credentials.imei is NOT NULL and carries a UNIQUE constraint. Verified
-- live before authoring: 0 orphan rows (every non-null gps903_devices.imei matches
-- a credential), so the constraint applies cleanly.
--
-- ON DELETE CASCADE: the discovered-device record is meaningless once its
-- credential is removed, so it is deleted alongside it. gps903_devices.imei is
-- nullable — NULL rows are exempt from the FK check (standard SQL). A covering
-- index on the referencing column speeds the cascade lookup (also addresses the
-- PERF-1 "FK column without a covering index" pattern for this new FK).
--
-- Idempotent via a guarded DO block (Postgres has no ADD CONSTRAINT IF NOT EXISTS).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_gps903_devices_imei
  ON public.gps903_devices (imei);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gps903_devices_imei_fkey'
      AND conrelid = 'public.gps903_devices'::regclass
  ) THEN
    ALTER TABLE public.gps903_devices
      ADD CONSTRAINT gps903_devices_imei_fkey
      FOREIGN KEY (imei)
      REFERENCES public.gps903_credentials (imei)
      ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
