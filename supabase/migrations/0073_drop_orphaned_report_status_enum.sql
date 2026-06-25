-- Migration 0073 — Drop orphaned report_status enum type
--
-- The report_status enum (created in 0001 as ('draft','submitted','approved',
-- 'rejected'), with the 'review' value added in 0021) was used by exactly one
-- column: reports.status. The reports (and report_versions) tables were dropped
-- in 0051 when reports moved to on-demand generation, leaving this enum type
-- orphaned. The related notify function/trigger (notify_on_report_status /
-- trg_report_status_notify) were already dropped in 0019. Independent
-- verification confirms NO surviving table column, function, cast, trigger,
-- view, or later-migration dependency references the type. The only remaining
-- mention is a stale entry in the generated src/lib/database.types.ts, which is
-- a static string-literal union (harmless, non-breaking) and will be cleared on
-- the next `supabase gen types` regeneration (separate follow-up).
--
-- TD-9 / Register #19.
--
-- IF EXISTS for idempotency. Schema-qualified public. No CASCADE: the type is
-- proven orphaned, so nothing depends on it; CASCADE would be unsafe (it would
-- silently drop any unexpected dependent) and is deliberately omitted.

BEGIN;

DROP TYPE IF EXISTS public.report_status;

COMMIT;
