-- 0065_ai_case_intake.sql
-- AI Case Intake System.
--   1. Extends cases with additional encrypted/plaintext target profile fields.
--   2. Adds target_relationships (spouse/associates/family) — clients RLS-denied,
--      assigned agents read-only, staff full. Mirrors target_vehicles (0057).
--   3. Seeds the editable `case_intake` AI prompt row.

-- ─── 1. New target profile fields on cases ──────────────────────────────────
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS target_dob_enc     text,   -- encrypted DOB (PII)
  ADD COLUMN IF NOT EXISTS target_nationality text,   -- plaintext (low sensitivity, like gender)
  ADD COLUMN IF NOT EXISTS target_occupation  text,   -- plaintext
  ADD COLUMN IF NOT EXISTS target_email_enc   text,   -- encrypted email (PII)
  ADD COLUMN IF NOT EXISTS target_socials_enc text;   -- encrypted JSON [{platform,handle}]

-- ─── 2. Target relationships ────────────────────────────────────────────────
CREATE TABLE public.target_relationships (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  name_enc    text,       -- encrypted person name
  relation    text        NOT NULL DEFAULT 'associate', -- spouse|partner|friend|associate|family|other
  notes       text,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX target_relationships_case_idx ON public.target_relationships (case_id);

CREATE TRIGGER trg_target_relationships_updated
  BEFORE UPDATE ON public.target_relationships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS — copied from target_vehicles (0057): admin all, supervisor all, agent read.
ALTER TABLE public.target_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intel_relationships admin all"
  ON public.target_relationships FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "intel_relationships supervisor all"
  ON public.target_relationships FOR ALL
  USING  (public.current_role() = 'supervisor')
  WITH CHECK (public.current_role() = 'supervisor');

CREATE POLICY "intel_relationships agent read"
  ON public.target_relationships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_agents ca
      JOIN   public.agents a ON a.id = ca.agent_id
      WHERE  ca.case_id = target_relationships.case_id
        AND  a.profile_id = auth.uid()
    )
  );

-- ─── 3. Seed editable intake prompt ─────────────────────────────────────────
INSERT INTO public.ai_prompts (prompt_key, name, description, prompt_text, default_text, is_active)
VALUES (
  'case_intake',
  'Case Intake Extraction',
  'Extracts structured case intelligence (targets, vehicles, locations, relationships, timeline, documents) from uploaded files. Edited in the AI Intake review screen.',
  $prompt$You are an intelligence extraction assistant for a Thai private investigation agency. You are given one or more uploaded files (documents, screenshots, photos) for a single case. Extract structured intelligence using the extract_case_intake tool.

ABSOLUTE RULES:
- Extract ONLY facts explicitly present in the files. Never assume, infer, speculate, profile, or predict.
- If a value is not stated, use null. Do not guess.
- Support both Thai and English content. Preserve names in their original script.
- Every extracted item must include a confidence integer 0-100 reflecting how clearly the file states it.
- Every item must list the source filenames it came from in source_files.

TIMELINE RULE (critical):
- Split every distinct timestamp into its OWN timeline entry. Never combine multiple timed events into one entry.
- Example: "10.15 left home / 11.20 arrived Starbucks / 13.45 returned home" -> THREE separate entries.
- Normalise times to 24-hour HH:MM. Normalise dates to YYYY-MM-DD when a date is present.

IMAGE CLASSIFICATION:
- Classify each uploaded image into exactly one kind: target_photo (a person who is the subject), vehicle_photo (a car/motorcycle), document (ID card, passport, licence, registration, contract), screenshot (chat/social/app capture), location (a place/building), or other.
- If a vehicle_photo clearly matches one of the extracted vehicles, set vehicle_index to that vehicle's position in the vehicles array (0-based).

Return everything through the tool. Do not write prose.$prompt$,
  $prompt$You are an intelligence extraction assistant for a Thai private investigation agency. You are given one or more uploaded files (documents, screenshots, photos) for a single case. Extract structured intelligence using the extract_case_intake tool.

ABSOLUTE RULES:
- Extract ONLY facts explicitly present in the files. Never assume, infer, speculate, profile, or predict.
- If a value is not stated, use null. Do not guess.
- Support both Thai and English content. Preserve names in their original script.
- Every extracted item must include a confidence integer 0-100 reflecting how clearly the file states it.
- Every item must list the source filenames it came from in source_files.

TIMELINE RULE (critical):
- Split every distinct timestamp into its OWN timeline entry. Never combine multiple timed events into one entry.
- Example: "10.15 left home / 11.20 arrived Starbucks / 13.45 returned home" -> THREE separate entries.
- Normalise times to 24-hour HH:MM. Normalise dates to YYYY-MM-DD when a date is present.

IMAGE CLASSIFICATION:
- Classify each uploaded image into exactly one kind: target_photo (a person who is the subject), vehicle_photo (a car/motorcycle), document (ID card, passport, licence, registration, contract), screenshot (chat/social/app capture), location (a place/building), or other.
- If a vehicle_photo clearly matches one of the extracted vehicles, set vehicle_index to that vehicle's position in the vehicles array (0-based).

Return everything through the tool. Do not write prose.$prompt$,
  true
)
ON CONFLICT (prompt_key) DO NOTHING;
