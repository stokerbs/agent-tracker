-- Drop the emergency SOS notify trigger again — the app-layer pipeline now owns
-- emergency notifications.
--
-- Resolution of the 0076/0077 saga: 0076 dropped this trigger believing the app
-- replaced it; emergency notifications then stopped, so 0077 restored it as an
-- interim. Instrumentation (DBG_notifyRole) then proved the app path DOES work:
-- triggerSos -> notifyRole resolves the admin/supervisor recipients and
-- notifyUsers inserts the rows (verified independently by geofence notifications,
-- which have no trigger). With the trigger present, emergency rows were being
-- created twice (trigger + app). Dropping it makes the app the single source —
-- rows AND native push — with no duplicates.
--
-- (The remaining "no banner on a dev build" is an APNs sandbox-vs-production
-- token mismatch, not a pipeline issue — production/TestFlight builds deliver.)

BEGIN;

DROP TRIGGER IF EXISTS trg_alert_notify ON public.emergency_alerts;
DROP FUNCTION IF EXISTS public.notify_supervisors_on_alert();

COMMIT;
