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
merged AS (
  SELECT keep_id, sum(frequency) AS extra_freq,
         array_agg(DISTINCT t) FILTER (WHERE t IS NOT NULL) AS extra_tags
  FROM dups LEFT JOIN LATERAL unnest(dups.tags) AS t ON true
  GROUP BY keep_id
)
UPDATE public.studio_customer_questions q
SET frequency = q.frequency + m.extra_freq,
    tags = (SELECT array_agg(DISTINCT x) FROM unnest(q.tags || coalesce(m.extra_tags, '{}')) AS x)
FROM merged m WHERE q.id = m.keep_id;

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
