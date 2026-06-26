-- Unify the notification pipeline: emergency SOS alerts now fan out from the
-- application layer (emergency/actions.ts → notifyRole), which also delivers
-- native push (APNs/FCM) — something the DB trigger could never do.
--
-- This mirrors migration 0xxx, which earlier moved assignment + report-status
-- notifications off DB triggers and into the app for the same reason. Dropping
-- this trigger prevents duplicate notification rows now that the action inserts
-- them via notifyUsers(). `emergency_alerts` is inserted from exactly one path
-- (triggerSos), so no alert loses its notification.
--
-- Reversible: re-create public.notify_supervisors_on_alert() + trg_alert_notify
-- from migration 0002 to restore the previous behaviour.

BEGIN;

DROP TRIGGER IF EXISTS trg_alert_notify ON public.emergency_alerts;
DROP FUNCTION IF EXISTS public.notify_supervisors_on_alert();

COMMIT;
