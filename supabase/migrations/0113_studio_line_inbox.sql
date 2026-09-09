-- Migration 0113 — Creative Studio: LINE OA customer-message inbox for FAQ mining
--
-- Inbound LINE messages from people who are NOT linked field agents (i.e. the
-- public / prospective customers writing to the Official Account) are captured
-- here so the Studio can mine recurring questions into
-- studio_customer_questions ("REAL EXPERIENCE → INSIGHT").
--
-- Privacy by design:
--   * sender_hash = HMAC(BIDX_KEY, line userId) — groups messages per sender
--     without storing the LINE id; not reversible without the server key.
--   * text_redacted has phones / emails / LINE ids / URLs / ID numbers /
--     plates replaced by tokens BEFORE insert (lib/studio/line-inbox.ts).
--   * Rows are purged 30 days after processing (cron). Nothing here is ever
--     shown as-is to content generation — only the AI-extracted, identity-free
--     canonical questions land in studio_customer_questions.
--
-- Access: the webhook writes with the service role (no auth.uid()); the owner
-- reads/deletes via the admin-only policy (same model as other studio_* tables).

BEGIN;

CREATE TABLE IF NOT EXISTS public.studio_line_inbox (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_hash   text NOT NULL,
  text_redacted text NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz NULL,
  batch_id      uuid NULL REFERENCES public.studio_ai_generations(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_line_inbox_text_len CHECK (char_length(text_redacted) BETWEEN 1 AND 4000)
);
COMMENT ON TABLE public.studio_line_inbox IS
  'Redacted inbound LINE OA messages from non-agent senders, queued for FAQ mining. Sender is an HMAC hash; text is PII-redacted; purged 30 days after processing.';

CREATE INDEX IF NOT EXISTS studio_line_inbox_unprocessed_idx
  ON public.studio_line_inbox (received_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS studio_line_inbox_processed_idx
  ON public.studio_line_inbox (processed_at) WHERE processed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS studio_line_inbox_sender_idx
  ON public.studio_line_inbox (sender_hash, received_at DESC);

ALTER TABLE public.studio_line_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS studio_line_inbox_admin_all ON public.studio_line_inbox;
CREATE POLICY studio_line_inbox_admin_all ON public.studio_line_inbox
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Track where a canonical question came from (manual vs mined) and when it was last seen.
ALTER TABLE public.studio_customer_questions
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS normalized_key text NULL;
CREATE INDEX IF NOT EXISTS studio_cq_normalized_key_idx
  ON public.studio_customer_questions (normalized_key) WHERE normalized_key IS NOT NULL;

COMMIT;
