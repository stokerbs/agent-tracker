-- Migration 0122 — Creative Studio: attribute autopilot runs to the admin they act as.
-- The cron has no session; runAutopilot resolves an admin profile and records it,
-- so a run row is attributable like every other studio write.

BEGIN;

ALTER TABLE public.studio_autopilot_runs
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.studio_autopilot_runs.created_by IS 'Admin profile the autopilot acted as (resolved at run start; the cron has no session).';

COMMIT;
