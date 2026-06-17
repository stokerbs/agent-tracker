-- Migration 0020 — Soft delete / archive for cases and reports
-- Adds archived_at timestamp (NULL = active, non-NULL = archived).
-- Adds 'cancelled' to case_status enum for explicit cancellation workflow.

BEGIN;

ALTER TABLE public.cases   ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS cases_archived_idx   ON public.cases   (archived_at);
CREATE INDEX IF NOT EXISTS reports_archived_idx ON public.reports (archived_at);

COMMIT;

-- ALTER TYPE ... ADD VALUE must run outside a transaction on PG < 13.
-- Supabase runs PG 15, so this is safe inside the block above, but we leave
-- it here for maximum compatibility across local dev environments.
ALTER TYPE public.case_status ADD VALUE IF NOT EXISTS 'cancelled';
