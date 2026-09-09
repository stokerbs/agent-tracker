-- Migration 0110 — Creative Studio: make AI provenance tamper-evident.
-- generation_id columns pointed at studio_ai_generations without a FK, so a
-- client could assert an arbitrary generation id. Add the FK (SET NULL on
-- delete so purging old generation logs never breaks content rows).

BEGIN;

ALTER TABLE public.studio_ideas
  DROP CONSTRAINT IF EXISTS studio_ideas_generation_fk,
  ADD CONSTRAINT studio_ideas_generation_fk
    FOREIGN KEY (generation_id) REFERENCES public.studio_ai_generations(id) ON DELETE SET NULL;

ALTER TABLE public.studio_case_insights
  DROP CONSTRAINT IF EXISTS studio_case_insights_generation_fk,
  ADD CONSTRAINT studio_case_insights_generation_fk
    FOREIGN KEY (generation_id) REFERENCES public.studio_ai_generations(id) ON DELETE SET NULL;

ALTER TABLE public.studio_content_variants
  DROP CONSTRAINT IF EXISTS studio_content_variants_generation_fk,
  ADD CONSTRAINT studio_content_variants_generation_fk
    FOREIGN KEY (generation_id) REFERENCES public.studio_ai_generations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS studio_ideas_generation_idx ON public.studio_ideas (generation_id);
CREATE INDEX IF NOT EXISTS studio_ci_generation_idx ON public.studio_case_insights (generation_id);
CREATE INDEX IF NOT EXISTS studio_cv_generation_idx ON public.studio_content_variants (generation_id);

COMMIT;
