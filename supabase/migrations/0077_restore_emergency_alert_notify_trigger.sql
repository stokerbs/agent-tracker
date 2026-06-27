-- Restore the emergency SOS notification trigger that 0076 dropped.
--
-- Incident finding (2026-06-26): the app-layer replacement added in the unified
-- notification work (triggerSos -> notifyRole) does NOT create notification rows
-- in production — emergency notifications were being created by this trigger all
-- along. Dropping it in 0076 caused a total emergency-notification outage.
--
-- This restores the original trg_alert_notify + notify_supervisors_on_alert()
-- verbatim from 0002 (SECURITY DEFINER, so it bypasses RLS to see all
-- admin/supervisor profiles — the very property the app path appears to lack).
--
-- INTERIM: once the app-layer notifyRole path is instrumented, fixed, and
-- verified to create rows AND deliver push, this trigger should be dropped again
-- to avoid duplicate notification rows.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_supervisors_on_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select
    p.id,
    'emergency',
    'SOS Emergency Alert',
    coalesce((select full_name from public.agents where id = new.agent_id), 'An agent')
      || ' triggered an emergency alert.',
    '/emergency/' || new.id
  from public.profiles p
  where p.role in ('admin', 'supervisor') and p.is_active;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_alert_notify ON public.emergency_alerts;
CREATE TRIGGER trg_alert_notify
  AFTER INSERT ON public.emergency_alerts
  FOR EACH ROW EXECUTE FUNCTION public.notify_supervisors_on_alert();

COMMIT;
