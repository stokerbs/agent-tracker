-- Migration 0118 — Creative Studio: publishing phase 2 (Ayrshare auto-posting).
-- One row per content master × platform. Provider ids/refs are kept so the
-- sync cron can reconcile status and the owner can delete a post remotely.

BEGIN;

CREATE TABLE IF NOT EXISTS public.studio_social_posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id        uuid NOT NULL REFERENCES public.studio_content_masters(id) ON DELETE CASCADE,
  variant_id       uuid NULL REFERENCES public.studio_content_variants(id) ON DELETE SET NULL,
  platform         text NOT NULL,
  provider         text NOT NULL DEFAULT 'ayrshare',
  provider_post_id text NULL,                         -- aggregator post id (shared by the platforms of one request)
  provider_ref     jsonb NOT NULL DEFAULT '{}'::jsonb, -- refId + per-platform ids as returned
  status           text NOT NULL DEFAULT 'queued',
  scheduled_at     timestamptz NULL,
  published_at     timestamptz NULL,
  post_url         text NULL,
  error            text NULL,
  caption_chars    integer NULL,
  media_asset_ids  uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_by       uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_sp_platform_chk CHECK (platform IN ('facebook','instagram','tiktok','youtube','line_oa')),
  CONSTRAINT studio_sp_status_chk CHECK (status IN ('queued','scheduled','published','failed','deleted'))
);
COMMENT ON TABLE public.studio_social_posts IS 'Creative Studio: posts sent to social platforms through the publishing provider (Ayrshare). Never stores captions — only ids, status, urls and counts.';
CREATE INDEX IF NOT EXISTS studio_sp_master_idx ON public.studio_social_posts (master_id, created_at DESC);
CREATE INDEX IF NOT EXISTS studio_sp_pending_idx ON public.studio_social_posts (status, scheduled_at) WHERE status IN ('queued','scheduled');
CREATE INDEX IF NOT EXISTS studio_sp_provider_idx ON public.studio_social_posts (provider, provider_post_id) WHERE provider_post_id IS NOT NULL;

ALTER TABLE public.studio_social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS studio_social_posts_admin_all ON public.studio_social_posts;
CREATE POLICY studio_social_posts_admin_all ON public.studio_social_posts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS studio_social_posts_updated_at ON public.studio_social_posts;
CREATE TRIGGER studio_social_posts_updated_at BEFORE UPDATE ON public.studio_social_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.studio_settings.social_connections IS 'Publishing provider snapshot: {ayrshare:{checked_at, active:[platform], display_names:{}}, defaults:{youtube_visibility, tiktok_privacy}}.';

COMMIT;
