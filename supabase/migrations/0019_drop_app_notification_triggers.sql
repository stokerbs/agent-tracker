-- Migration 0017 — Drop DB-level notification triggers that are now handled
-- at the application layer (src/lib/notifications.ts).
--
-- The emergency SOS trigger (notify_supervisors_on_alert in 0002) is kept
-- because it is purely database-driven with no server action counterpart.

BEGIN;

DROP TRIGGER IF EXISTS trg_assignment_notify   ON public.case_agents;
DROP TRIGGER IF EXISTS trg_report_status_notify ON public.reports;

DROP FUNCTION IF EXISTS public.notify_agent_on_assignment();
DROP FUNCTION IF EXISTS public.notify_on_report_status();

COMMIT;
