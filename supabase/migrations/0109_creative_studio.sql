-- Migration 0109 — Detective Pulse AI Creative Studio (V1 foundation)
--
-- Internal AI-powered content operating system. Additive: brand-new `studio_*`
-- tables only; nothing in the operations schema is modified.
--
-- Design notes (see docs/CREATIVE_STUDIO.md):
--   * Admin-only in V1 — every table is RLS-gated with public.is_admin().
--     Supervisors/agents/clients have NO policy → default deny.
--   * studio_cases is a HAND-WRITTEN, already-generalised knowledge record.
--     It is NOT the operations `cases` table and never copies target PII from
--     it. `linked_case_id` is an optional pointer only.
--   * Content generation may only read rows flagged approved_for_content.
--   * pgvector is enabled and embedding columns exist so RAG can land later;
--     V1 writes NO embeddings (columns stay NULL).
--   * Human approval is mandatory: the app refuses approve while the latest
--     privacy check is `blocked` (enforced in server actions; the DB stores the
--     evidence trail in studio_privacy_checks + studio_content_reviews).

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. studio_settings — singleton row
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.studio_settings (
  id                uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  brand_voice       jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_language  text  NOT NULL DEFAULT 'th',
  default_platforms text[] NOT NULL DEFAULT ARRAY['tiktok','instagram_reel','facebook']::text[],
  pillars           jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_provider       text  NOT NULL DEFAULT 'anthropic',
  ai_model          text  NULL,
  knowledge_prefs   jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy_rules     jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_rules    jsonb NOT NULL DEFAULT '{"require_privacy_safe": true, "allow_override": true}'::jsonb,
  social_connections jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by        uuid  NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_settings_singleton CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid),
  CONSTRAINT studio_settings_provider_chk CHECK (ai_provider IN ('anthropic','openai'))
);
COMMENT ON TABLE public.studio_settings IS 'Creative Studio singleton settings: brand voice, pillars, AI provider, privacy/approval rules.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Knowledge
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.studio_knowledge_sources (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text NOT NULL,
  content              text NOT NULL,
  summary              text NULL,
  source_type          text NOT NULL DEFAULT 'owner_experience',
  category             text NOT NULL DEFAULT 'other',
  tags                 text[] NOT NULL DEFAULT '{}'::text[],
  sensitivity          text NOT NULL DEFAULT 'internal',
  approved_for_content boolean NOT NULL DEFAULT false,
  origin_ref           text NULL,          -- e.g. "marketing/faq.ts#3", URL, doc id
  is_demo              boolean NOT NULL DEFAULT false,
  created_by           uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_ks_title_len CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT studio_ks_source_type_chk CHECK (source_type IN (
    'case','customer_question','investigator_knowledge','owner_experience','service',
    'article','technology','osint','surveillance','gps','document','external','other')),
  CONSTRAINT studio_ks_category_chk CHECK (category IN (
    'cases','customer_questions','investigator_knowledge','owner_experience','services',
    'articles','technology','osint','surveillance','gps','other')),
  CONSTRAINT studio_ks_sensitivity_chk CHECK (sensitivity IN ('public','internal','confidential','restricted'))
);
COMMENT ON TABLE public.studio_knowledge_sources IS 'Creative Studio knowledge base. Only approved_for_content=true rows may be fed to AI content generation.';
CREATE INDEX IF NOT EXISTS studio_ks_category_idx ON public.studio_knowledge_sources (category);
CREATE INDEX IF NOT EXISTS studio_ks_approved_idx ON public.studio_knowledge_sources (approved_for_content) WHERE approved_for_content;
CREATE INDEX IF NOT EXISTS studio_ks_tags_gin ON public.studio_knowledge_sources USING gin (tags);
CREATE INDEX IF NOT EXISTS studio_ks_title_trgm ON public.studio_knowledge_sources USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS studio_ks_content_trgm ON public.studio_knowledge_sources USING gin (content gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.studio_knowledge_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   uuid NOT NULL REFERENCES public.studio_knowledge_sources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content     text NOT NULL,
  token_count integer NULL,
  embedding   vector(1536) NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_kc_unique UNIQUE (source_id, chunk_index)
);
COMMENT ON TABLE public.studio_knowledge_chunks IS 'RAG-ready chunks of knowledge sources. embedding stays NULL in V1 (no embedding job yet).';
CREATE INDEX IF NOT EXISTS studio_kc_source_idx ON public.studio_knowledge_chunks (source_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Case knowledge (separate from ops cases)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.studio_cases (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code            text NOT NULL,                   -- DEMO-001, DP-K-0007 …
  case_type            text NOT NULL DEFAULT 'other',
  title                text NOT NULL,
  situation            text NULL,
  objective            text NULL,
  method               text NULL,
  observations         text NULL,
  outcome              text NULL,
  lessons              text NULL,
  interesting_insight  text NULL,
  content_potential    text NOT NULL DEFAULT 'medium',
  sensitivity          text NOT NULL DEFAULT 'confidential',
  anonymized_version   text NULL,
  approved_for_content boolean NOT NULL DEFAULT false,
  linked_case_id       uuid NULL REFERENCES public.cases(id) ON DELETE SET NULL,
  is_demo              boolean NOT NULL DEFAULT false,
  tags                 text[] NOT NULL DEFAULT '{}'::text[],
  created_by           uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_cases_code_unique UNIQUE (case_code),
  CONSTRAINT studio_cases_potential_chk CHECK (content_potential IN ('low','medium','high')),
  CONSTRAINT studio_cases_sensitivity_chk CHECK (sensitivity IN ('public','internal','confidential','restricted'))
);
COMMENT ON TABLE public.studio_cases IS 'Hand-written, generalised case knowledge for content. NOT the operations cases table; never stores target PII. linked_case_id is an optional pointer only.';
CREATE INDEX IF NOT EXISTS studio_cases_type_idx ON public.studio_cases (case_type);
CREATE INDEX IF NOT EXISTS studio_cases_approved_idx ON public.studio_cases (approved_for_content) WHERE approved_for_content;
CREATE INDEX IF NOT EXISTS studio_cases_linked_idx ON public.studio_cases (linked_case_id);
CREATE INDEX IF NOT EXISTS studio_cases_title_trgm ON public.studio_cases USING gin (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.studio_case_insights (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              uuid NOT NULL REFERENCES public.studio_cases(id) ON DELETE CASCADE,
  title                text NOT NULL,
  insight              text NOT NULL,
  lesson               text NULL,
  content_angle        text NULL,
  pillar               text NULL,
  privacy_status       text NOT NULL DEFAULT 'review_required',
  approved_for_content boolean NOT NULL DEFAULT false,
  generated_by         text NOT NULL DEFAULT 'human',
  generation_id        uuid NULL,
  created_by           uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_ci_privacy_chk CHECK (privacy_status IN ('safe','review_required','blocked')),
  CONSTRAINT studio_ci_generated_by_chk CHECK (generated_by IN ('ai','human'))
);
COMMENT ON TABLE public.studio_case_insights IS 'Anonymised, content-safe insights extracted from studio_cases. The ONLY case-derived text that reaches content generation.';
CREATE INDEX IF NOT EXISTS studio_ci_case_idx ON public.studio_case_insights (case_id);
CREATE INDEX IF NOT EXISTS studio_ci_approved_idx ON public.studio_case_insights (approved_for_content) WHERE approved_for_content;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Customer questions (FAQ mining)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.studio_customer_questions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question             text NOT NULL,
  answer_hint          text NULL,
  frequency            integer NOT NULL DEFAULT 1,
  source               text NOT NULL DEFAULT 'manual',
  tags                 text[] NOT NULL DEFAULT '{}'::text[],
  approved_for_content boolean NOT NULL DEFAULT false,
  is_demo              boolean NOT NULL DEFAULT false,
  created_by           uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_cq_source_chk CHECK (source IN ('line_oa','phone','web','manual','import')),
  CONSTRAINT studio_cq_frequency_chk CHECK (frequency >= 1)
);
COMMENT ON TABLE public.studio_customer_questions IS 'Recurring customer questions (identity-free) mined manually or imported; feed FAQ/educational content ideas.';
CREATE INDEX IF NOT EXISTS studio_cq_question_trgm ON public.studio_customer_questions USING gin (question gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Campaigns & ideas
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.studio_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  objective   text NULL,
  audience    text NULL,
  platforms   text[] NOT NULL DEFAULT '{}'::text[],
  pillar      text NULL,
  tone        text NULL,
  post_count  integer NULL,
  cta         text NULL,
  brief       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- original request + parsed interpretation
  status      text NOT NULL DEFAULT 'proposed',
  created_by  uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_campaigns_status_chk CHECK (status IN ('proposed','active','completed','archived'))
);
CREATE INDEX IF NOT EXISTS studio_campaigns_status_idx ON public.studio_campaigns (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.studio_ideas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  hook         text NULL,
  description  text NULL,
  pillar       text NOT NULL DEFAULT 'detective_knowledge',
  platforms    text[] NOT NULL DEFAULT '{}'::text[],
  format       text NULL,                           -- short_video / carousel / post / article / story
  origin       text NOT NULL DEFAULT 'owner',
  source_refs  jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{kind, id, label}]
  ai_scores    jsonb NULL,                          -- {hook, educational, conversion, originality} 1-5 — AI ESTIMATES
  status       text NOT NULL DEFAULT 'new',
  tags         text[] NOT NULL DEFAULT '{}'::text[],
  campaign_id  uuid NULL REFERENCES public.studio_campaigns(id) ON DELETE SET NULL,
  generation_id uuid NULL,
  created_by   uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_ideas_pillar_chk CHECK (pillar IN (
    'detective_knowledge','case_story','detective_pov','red_flags','behind_investigation','service')),
  CONSTRAINT studio_ideas_origin_chk CHECK (origin IN ('ai','owner','knowledge','case','question','repurpose','trend')),
  CONSTRAINT studio_ideas_status_chk CHECK (status IN ('new','saved','rejected','generated','archived'))
);
CREATE INDEX IF NOT EXISTS studio_ideas_status_idx ON public.studio_ideas (status, created_at DESC);
CREATE INDEX IF NOT EXISTS studio_ideas_pillar_idx ON public.studio_ideas (pillar);
CREATE INDEX IF NOT EXISTS studio_ideas_campaign_idx ON public.studio_ideas (campaign_id);
CREATE INDEX IF NOT EXISTS studio_ideas_tags_gin ON public.studio_ideas USING gin (tags);
CREATE INDEX IF NOT EXISTS studio_ideas_title_trgm ON public.studio_ideas USING gin (title gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Content master + variants
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.studio_content_masters (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id                uuid NULL REFERENCES public.studio_ideas(id) ON DELETE SET NULL,
  campaign_id            uuid NULL REFERENCES public.studio_campaigns(id) ON DELETE SET NULL,
  title                  text NOT NULL,
  pillar                 text NOT NULL DEFAULT 'detective_knowledge',
  status                 text NOT NULL DEFAULT 'draft',
  hook                   text NULL,
  script                 text NULL,
  caption                text NULL,
  cta                    text NULL,
  target_duration_sec    integer NULL,
  estimated_duration_sec integer NULL,
  primary_platform       text NULL,
  creative_plan          jsonb NULL,          -- {shots:[{start,end,voice,visual,text}], broll[], overlays[], thumbnail, music}
  ai_notes               text NULL,
  notes                  text NULL,
  scheduled_at           timestamptz NULL,
  published_at           timestamptz NULL,
  published_url          text NULL,
  approved_by            uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at            timestamptz NULL,
  tags                   text[] NOT NULL DEFAULT '{}'::text[],
  created_by             uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_cm_pillar_chk CHECK (pillar IN (
    'detective_knowledge','case_story','detective_pov','red_flags','behind_investigation','service')),
  CONSTRAINT studio_cm_status_chk CHECK (status IN (
    'idea','draft','review','approved','scheduled','published','archived','rejected')),
  CONSTRAINT studio_cm_duration_chk CHECK (target_duration_sec IS NULL OR target_duration_sec IN (15,30,45,60,90))
);
COMMENT ON TABLE public.studio_content_masters IS 'One row per content piece (the master). Platform copies live in studio_content_variants. Status is the approval workflow; approve requires a non-blocked privacy check (enforced in server actions).';
CREATE INDEX IF NOT EXISTS studio_cm_status_idx ON public.studio_content_masters (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS studio_cm_scheduled_idx ON public.studio_content_masters (scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS studio_cm_pillar_idx ON public.studio_content_masters (pillar);
CREATE INDEX IF NOT EXISTS studio_cm_idea_idx ON public.studio_content_masters (idea_id);
CREATE INDEX IF NOT EXISTS studio_cm_campaign_idx ON public.studio_content_masters (campaign_id);
CREATE INDEX IF NOT EXISTS studio_cm_title_trgm ON public.studio_content_masters USING gin (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.studio_content_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id     uuid NOT NULL REFERENCES public.studio_content_masters(id) ON DELETE CASCADE,
  platform      text NOT NULL,
  format        text NOT NULL DEFAULT 'short_video',
  hook          text NULL,
  script        text NULL,
  caption       text NULL,
  cta           text NULL,
  creative_plan jsonb NULL,
  char_count    integer NULL,
  generation_id uuid NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_cv_platform_chk CHECK (platform IN (
    'tiktok','instagram_reel','instagram_post','instagram_carousel','facebook','youtube_short','article','line_oa')),
  CONSTRAINT studio_cv_format_chk CHECK (format IN (
    'short_video','carousel','post','article','story','caption_short','caption_long','outline'))
);
CREATE INDEX IF NOT EXISTS studio_cv_master_idx ON public.studio_content_variants (master_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Traceability, fact claims, privacy, reviews, assets
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.studio_content_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   uuid NOT NULL REFERENCES public.studio_content_masters(id) ON DELETE CASCADE,
  source_kind text NOT NULL,
  source_id   uuid NULL,       -- FK is polymorphic (knowledge/case_insight/customer_question) — resolved in app
  label       text NOT NULL,
  note        text NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_cs_kind_chk CHECK (source_kind IN ('knowledge','case_insight','customer_question','external','ai_general'))
);
COMMENT ON TABLE public.studio_content_sources IS 'Where a content piece came from. ai_general = general AI knowledge (must be shown as ⚠ in UI).';
CREATE INDEX IF NOT EXISTS studio_cs_master_idx ON public.studio_content_sources (master_id);
CREATE INDEX IF NOT EXISTS studio_cs_source_idx ON public.studio_content_sources (source_kind, source_id);

CREATE TABLE IF NOT EXISTS public.studio_content_claims (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id      uuid NOT NULL REFERENCES public.studio_content_masters(id) ON DELETE CASCADE,
  claim          text NOT NULL,
  support_status text NOT NULL DEFAULT 'needs_review',
  source_kind    text NULL,
  source_id      uuid NULL,
  note           text NULL,
  reviewed_by    uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at    timestamptz NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_cc_status_chk CHECK (support_status IN (
    'supported','partially_supported','ai_suggestion','needs_review','unsupported'))
);
CREATE INDEX IF NOT EXISTS studio_cc_master_idx ON public.studio_content_claims (master_id);

CREATE TABLE IF NOT EXISTS public.studio_privacy_checks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id  uuid NOT NULL REFERENCES public.studio_content_masters(id) ON DELETE CASCADE,
  status     text NOT NULL,
  findings   jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{kind, excerpt, reason, severity, field}]
  checked_by text NOT NULL DEFAULT 'deterministic',
  model      text NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_pc_status_chk CHECK (status IN ('safe','review_required','blocked')),
  CONSTRAINT studio_pc_checked_by_chk CHECK (checked_by IN ('deterministic','ai','human'))
);
CREATE INDEX IF NOT EXISTS studio_pc_master_idx ON public.studio_privacy_checks (master_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.studio_content_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   uuid NOT NULL REFERENCES public.studio_content_masters(id) ON DELETE CASCADE,
  reviewer_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision    text NOT NULL,
  note        text NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_cr_decision_chk CHECK (decision IN ('approve','reject','request_changes','override_privacy'))
);
CREATE INDEX IF NOT EXISTS studio_cr_master_idx ON public.studio_content_reviews (master_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.studio_creative_assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id    uuid NOT NULL REFERENCES public.studio_content_masters(id) ON DELETE CASCADE,
  kind         text NOT NULL DEFAULT 'other',
  storage_path text NULL,
  external_url text NULL,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by   uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_ca_kind_chk CHECK (kind IN ('thumbnail','broll','image','video','audio','subtitle','other'))
);
CREATE INDEX IF NOT EXISTS studio_ca_master_idx ON public.studio_creative_assets (master_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Analytics (manual entry in V1) + AI generation history
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.studio_analytics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id       uuid NOT NULL REFERENCES public.studio_content_masters(id) ON DELETE CASCADE,
  variant_id      uuid NULL REFERENCES public.studio_content_variants(id) ON DELETE SET NULL,
  platform        text NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  views           integer NULL,
  reach           integer NULL,
  likes           integer NULL,
  comments        integer NULL,
  shares          integer NULL,
  saves           integer NULL,
  avg_watch_sec   numeric(8,2) NULL,
  completion_rate numeric(5,2) NULL,   -- percent 0-100
  profile_visits  integer NULL,
  dms             integer NULL,
  leads           integer NULL,
  qualified_leads integer NULL,
  conversions     integer NULL,
  source          text NOT NULL DEFAULT 'manual',
  note            text NULL,
  created_by      uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_an_source_chk CHECK (source IN ('manual','import','api')),
  CONSTRAINT studio_an_completion_chk CHECK (completion_rate IS NULL OR (completion_rate BETWEEN 0 AND 100))
);
CREATE INDEX IF NOT EXISTS studio_an_master_idx ON public.studio_analytics (master_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS studio_an_platform_idx ON public.studio_analytics (platform, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.studio_ai_generations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose       text NOT NULL,          -- ideas | campaign | script | rewrite | repurpose | cta | creative_plan | case_insights | faq_extract | privacy_check | content_mix | hooks
  provider      text NOT NULL,
  model         text NOT NULL,
  input_refs    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- ids + short brief only; NEVER raw case text
  output        jsonb NULL,
  input_tokens  integer NULL,
  output_tokens integer NULL,
  duration_ms   integer NULL,
  status        text NOT NULL DEFAULT 'ok',
  error         text NULL,
  user_id       uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_ag_status_chk CHECK (status IN ('ok','error','refused'))
);
COMMENT ON TABLE public.studio_ai_generations IS 'AI generation history for the Studio. Stores refs + outputs, never raw confidential prompts.';
CREATE INDEX IF NOT EXISTS studio_ag_created_idx ON public.studio_ai_generations (created_at DESC);
CREATE INDEX IF NOT EXISTS studio_ag_purpose_idx ON public.studio_ai_generations (purpose, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Triggers — updated_at (canonical set_updated_at) + audit on sensitive tables
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'studio_settings','studio_knowledge_sources','studio_knowledge_chunks','studio_cases',
    'studio_case_insights','studio_customer_questions','studio_campaigns','studio_ideas',
    'studio_content_masters','studio_content_variants','studio_content_claims','studio_creative_assets']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_updated_at', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'studio_settings','studio_knowledge_sources','studio_cases','studio_case_insights','studio_content_masters']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_audit_' || t, t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit()', 'trg_audit_' || t, t);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. RLS — admin-only for every studio table (default deny for everyone else)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'studio_settings','studio_knowledge_sources','studio_knowledge_chunks','studio_cases',
    'studio_case_insights','studio_customer_questions','studio_campaigns','studio_ideas',
    'studio_content_masters','studio_content_variants','studio_content_sources','studio_content_claims',
    'studio_privacy_checks','studio_content_reviews','studio_creative_assets','studio_analytics',
    'studio_ai_generations']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t || '_admin_all', t);
  END LOOP;
END $$;

-- Seed the settings singleton so the app never has to handle "no settings row".
INSERT INTO public.studio_settings (id, brand_voice, pillars)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '{"language":"th","style":["professional","natural","calm","experienced","observational","trustworthy"],"avoid":["over-selling","credibility-damaging clickbait","excessive emoji","fake certainty","fake investigation stories"],"cta_default":"ปรึกษาเบื้องต้นได้ทาง LINE @detectivepluse","custom_notes":""}'::jsonb,
  '[{"key":"detective_knowledge","target_pct":25},{"key":"case_story","target_pct":30},{"key":"detective_pov","target_pct":15},{"key":"red_flags","target_pct":10},{"key":"behind_investigation","target_pct":10},{"key":"service","target_pct":10}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
