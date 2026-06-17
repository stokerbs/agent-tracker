-- Migration 0021 — Report versions, editing audit trail, rich-text editing support
--
-- Adds:
--   report_versions  — full content snapshot on every save
--   reports.edited_by / edited_at — last-edited metadata
--   report_status "review" enum value  (replaces "submitted" in UI/code)
--   RLS for report_versions

BEGIN;

-- ── report_versions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.report_versions (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id      uuid        NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  version_number integer     NOT NULL DEFAULT 1,
  -- JSONB snapshot: { executive_summary, body, observations, conclusion }
  content        jsonb       NOT NULL DEFAULT '{}',
  edited_by      uuid        REFERENCES public.profiles(id),
  created_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (report_id, version_number)
);

CREATE INDEX IF NOT EXISTS report_versions_report_id_idx     ON public.report_versions (report_id);
CREATE INDEX IF NOT EXISTS report_versions_report_version_idx ON public.report_versions (report_id, version_number DESC);

-- ── reports — add editing columns ─────────────────────────────────────────────

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS edited_by  uuid        REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS edited_at  timestamptz;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_versions staff read"  ON public.report_versions;
DROP POLICY IF EXISTS "report_versions staff write" ON public.report_versions;

-- Staff (admin/supervisor/agent) can read all versions for reports they can access
CREATE POLICY "report_versions staff read" ON public.report_versions
  FOR SELECT USING (public.is_staff());

-- Only admin/supervisor can insert new versions
CREATE POLICY "report_versions staff write" ON public.report_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'supervisor')
    )
  );

-- Service-role bypass (used by notification utility / server actions)
-- NOTE: no policy needed for service_role — it bypasses RLS by default.

COMMIT;

-- ── Enum changes — must run outside transaction on older PG versions ──────────
-- Add 'review' (replaces 'submitted' in the editorial workflow)
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'review';

-- NOTE: migrating 'submitted' → 'review' must happen in a separate session
-- after this migration is committed, because PG doesn't allow using a newly
-- added enum value in the same transaction/session that added it.
-- Run manually if any existing rows have status='submitted':
--   UPDATE public.reports SET status = 'review' WHERE status = 'submitted';
