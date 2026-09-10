-- Migration 0116 — Creative Studio: normalized_key uniqueness applies to ACTIVE rows only.
-- Consolidation (0115) keeps superseded members with their original normalized_key.
-- With 0114's index a new canonical question whose key equals a superseded member
-- could not be inserted (23505) and the fallback would merge into the hidden row.
-- Scope the unique index to superseded_by IS NULL; all lookups filter the same way.

BEGIN;

DROP INDEX IF EXISTS public.studio_cq_normalized_key_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS studio_cq_normalized_key_uidx
  ON public.studio_customer_questions (normalized_key)
  WHERE normalized_key IS NOT NULL AND superseded_by IS NULL;

COMMENT ON COLUMN public.studio_customer_questions.superseded_by IS 'Set when this question was merged into a consolidated canonical question; hidden from default lists, kept for traceability. Deleting the canonical row re-activates members (ON DELETE SET NULL).';
COMMENT ON COLUMN public.studio_customer_questions.member_count IS 'For consolidated rows: number of source questions merged into it (summed across passes).';

COMMIT;
