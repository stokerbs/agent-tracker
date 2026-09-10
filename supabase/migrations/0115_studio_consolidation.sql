-- Migration 0115 — Creative Studio: consolidation of near-duplicate knowledge / questions.
-- Bulk chat import produced thousands of overlapping rows. An AI pass merges
-- near-duplicates into one canonical row; members are kept (audit trail, source
-- traceability) but marked superseded_by so lists hide them by default.

BEGIN;

ALTER TABLE public.studio_knowledge_sources
  ADD COLUMN IF NOT EXISTS superseded_by uuid NULL REFERENCES public.studio_knowledge_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS studio_ks_superseded_idx ON public.studio_knowledge_sources (superseded_by) WHERE superseded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS studio_ks_active_idx ON public.studio_knowledge_sources (category, updated_at DESC) WHERE superseded_by IS NULL;

ALTER TABLE public.studio_customer_questions
  ADD COLUMN IF NOT EXISTS superseded_by uuid NULL REFERENCES public.studio_customer_questions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS studio_cq_superseded_idx ON public.studio_customer_questions (superseded_by) WHERE superseded_by IS NOT NULL;

COMMENT ON COLUMN public.studio_knowledge_sources.superseded_by IS 'Set when this row was merged into a consolidated canonical row; hidden from default lists, kept for traceability.';
COMMENT ON COLUMN public.studio_knowledge_sources.member_count IS 'For consolidated rows: number of source rows merged into it.';

COMMIT;
