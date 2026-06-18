-- Migration 0042 — Make gps903_device_id optional on gps903_credentials
--
-- GPS903 Device ID is now auto-detected via Test Connection (parsing the tracking page
-- after IMEI login). Operators should no longer need to know or enter it manually.
-- Credentials without a device ID are skipped by the polling cron until detection succeeds.

ALTER TABLE public.gps903_credentials
  ALTER COLUMN gps903_device_id DROP NOT NULL;

-- The existing UNIQUE constraint remains and is unaffected:
-- PostgreSQL allows multiple NULL values in a UNIQUE column (NULL != NULL),
-- so devices pending detection can coexist without violating uniqueness.
