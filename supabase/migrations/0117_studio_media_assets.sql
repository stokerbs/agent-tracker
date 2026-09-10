-- Migration 0117 — Creative Studio: media generation phase 1 (images + voice-over).
-- Extends studio_creative_assets (0109) with generation metadata, adds the
-- private `studio-media` bucket (admin-only, server issues signed URLs) and
-- owner media preferences on the settings singleton.

BEGIN;

ALTER TABLE public.studio_creative_assets
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS label         text NULL,
  ADD COLUMN IF NOT EXISTS mime          text NULL,
  ADD COLUMN IF NOT EXISTS bytes         integer NULL,
  ADD COLUMN IF NOT EXISTS width         integer NULL,
  ADD COLUMN IF NOT EXISTS height        integer NULL,
  ADD COLUMN IF NOT EXISTS duration_ms   integer NULL,
  ADD COLUMN IF NOT EXISTS prompt        text NULL,
  ADD COLUMN IF NOT EXISTS provider      text NULL,
  ADD COLUMN IF NOT EXISTS model         text NULL,
  ADD COLUMN IF NOT EXISTS generation_id uuid NULL REFERENCES public.studio_ai_generations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_id    uuid NULL REFERENCES public.studio_content_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error         text NULL;

ALTER TABLE public.studio_creative_assets DROP CONSTRAINT IF EXISTS studio_ca_status_chk;
ALTER TABLE public.studio_creative_assets
  ADD CONSTRAINT studio_ca_status_chk CHECK (status IN ('pending','ready','failed'));

CREATE INDEX IF NOT EXISTS studio_ca_master_created_idx ON public.studio_creative_assets (master_id, created_at DESC);

COMMENT ON COLUMN public.studio_creative_assets.prompt IS 'Scrubbed prompt actually sent to the media provider (reproducibility). Never raw case text.';
COMMENT ON COLUMN public.studio_creative_assets.status IS 'pending while the provider call runs, ready when the object is in storage, failed with error text.';

ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS media_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.studio_settings.media_prefs IS 'Owner media preferences: image_style, default_aspect, image_model, tts_voice_id, tts_model.';

-- Private bucket; only admins touch objects, and the app hands out short signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('studio-media', 'studio-media', false, 26214400, ARRAY['image/png','image/jpeg','image/webp','audio/mpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "studio media admin select" ON storage.objects;
DROP POLICY IF EXISTS "studio media admin insert" ON storage.objects;
DROP POLICY IF EXISTS "studio media admin update" ON storage.objects;
DROP POLICY IF EXISTS "studio media admin delete" ON storage.objects;
CREATE POLICY "studio media admin select" ON storage.objects FOR SELECT USING (bucket_id = 'studio-media' AND public.is_admin());
CREATE POLICY "studio media admin insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'studio-media' AND public.is_admin());
CREATE POLICY "studio media admin update" ON storage.objects FOR UPDATE USING (bucket_id = 'studio-media' AND public.is_admin());
CREATE POLICY "studio media admin delete" ON storage.objects FOR DELETE USING (bucket_id = 'studio-media' AND public.is_admin());

COMMIT;
