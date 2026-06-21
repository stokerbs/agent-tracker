-- 0064_drop_traccar.sql
-- Remove the dead Traccar integration. The Traccar webhook
-- (/api/webhooks/traccar) is deleted in the same change; GPS903 (migrations
-- 0036–0047) is the live tracker integration.
--
-- Drops only the Traccar-specific column. The other artifacts from 0035
-- (gps_devices.agent_id and gps_devices_imei_idx) are RETAINED — GPS903 uses
-- agent linking and IMEI lookup. traccar_id is confirmed all-NULL in prod.

ALTER TABLE public.gps_devices
  DROP COLUMN IF EXISTS traccar_id;
