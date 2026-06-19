-- Drop report versioning and persistent report storage.
-- Reports are now generated on-demand from timeline entries and never persisted.

DROP TABLE IF EXISTS public.report_versions CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
