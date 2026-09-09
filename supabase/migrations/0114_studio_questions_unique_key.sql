-- Migration 0114 — Creative Studio: make customer-question dedupe race-safe.
-- Concurrent importers (scripts/studio-import-line-history.ts --concurrency N)
-- could insert the same normalized_key twice. Merge any existing duplicates
-- (sum frequency, union tags, keep the oldest row) then enforce uniqueness.

BEGIN;

WITH ranked AS (
  SELECT id, normalized_key, frequency, tags,
         first_value(id) OVER (PARTITION BY normalized_key ORDER BY created_at, id) AS keep_id
  FROM public.studio_customer_questions
  WHERE normalized_key IS NOT NULL
),
dups AS (SELECT * FROM ranked WHERE id <> keep_id),
freq AS (SELECT keep_id, sum(frequency) AS extra_freq FROM dups GROUP BY keep_id),
tagset AS (
  SELECT d.keep_id, array_agg(DISTINCT t) AS extra_tags
  FROM dups d CROSS JOIN LATERAL unnest(d.tags) AS t
  GROUP BY d.keep_id
)
UPDATE public.studio_customer_questions q
SET frequency = q.frequency + f.extra_freq,
    tags = (SELECT array_agg(DISTINCT x) FROM unnest(q.tags || coalesce(ts.extra_tags, '{}')) AS x)
FROM freq f LEFT JOIN tagset ts ON ts.keep_id = f.keep_id
WHERE q.id = f.keep_id;

DELETE FROM public.studio_customer_questions
WHERE id IN (
  SELECT id FROM (
    SELECT id, first_value(id) OVER (PARTITION BY normalized_key ORDER BY created_at, id) AS keep_id
    FROM public.studio_customer_questions WHERE normalized_key IS NOT NULL
  ) r WHERE id <> keep_id
);

DROP INDEX IF EXISTS public.studio_cq_normalized_key_idx;
CREATE UNIQUE INDEX IF NOT EXISTS studio_cq_normalized_key_uidx
  ON public.studio_customer_questions (normalized_key) WHERE normalized_key IS NOT NULL;

COMMIT;
