-- ============================================================================
-- Migration 0016 — Notification triggers: case assignment + report status
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- Case assignment → notify the assigned agent
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_agent_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_case_number text;
BEGIN
  SELECT profile_id INTO v_profile_id FROM public.agents WHERE id = NEW.agent_id;
  SELECT case_number INTO v_case_number FROM public.cases  WHERE id = NEW.case_id;

  IF v_profile_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_profile_id,
      'assignment',
      'New case assignment',
      'You have been assigned to case ' || COALESCE(v_case_number, 'unknown') || '.',
      '/cases/' || NEW.case_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignment_notify ON public.case_agents;
CREATE TRIGGER trg_assignment_notify
  AFTER INSERT ON public.case_agents
  FOR EACH ROW EXECUTE FUNCTION public.notify_agent_on_assignment();

-- ----------------------------------------------------------------------------
-- Report status change → notify relevant users
-- Submitted  → all active staff (except the author)
-- Approved   → the report generator
-- Rejected   → the report generator
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_report_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_number text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT case_number INTO v_case_number FROM public.cases WHERE id = NEW.case_id;

  IF NEW.status = 'submitted' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT
      p.id,
      'report',
      'Report ready for review',
      'A surveillance report for case ' || COALESCE(v_case_number, 'unknown') || ' is awaiting approval.',
      '/reports'
    FROM public.profiles p
    WHERE p.role IN ('admin', 'supervisor')
      AND p.is_active
      AND (NEW.generated_by IS NULL OR p.id != NEW.generated_by);
  END IF;

  IF NEW.status = 'approved' AND NEW.generated_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.generated_by,
      'report',
      'Report approved',
      'Your report for case ' || COALESCE(v_case_number, 'unknown') || ' has been approved and published to the client.',
      '/cases/' || NEW.case_id
    );
  END IF;

  IF NEW.status = 'rejected' AND NEW.generated_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.generated_by,
      'report',
      'Report rejected',
      'Your report for case ' || COALESCE(v_case_number, 'unknown') || ' was rejected. Please revise and resubmit.',
      '/cases/' || NEW.case_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_status_notify ON public.reports;
CREATE TRIGGER trg_report_status_notify
  AFTER UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_report_status();

COMMIT;
