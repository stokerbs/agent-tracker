-- Migration 0120 — Creative Studio: video rendering phase 3.
-- Render jobs for template short videos (ffmpeg) + allow mp4 in the media bucket.

BEGIN;

CREATE TABLE IF NOT EXISTS public.studio_render_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   uuid NOT NULL REFERENCES public.studio_content_masters(id) ON DELETE CASCADE,
  variant_id  uuid NULL REFERENCES public.studio_content_variants(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'queued',
  step        text NULL,                         -- human-readable current step (Thai)
  progress    integer NOT NULL DEFAULT 0,        -- 0-100
  params      jsonb NOT NULL DEFAULT '{}'::jsonb, -- {aspect, voice_id, shots: n}
  asset_id    uuid NULL REFERENCES public.studio_creative_assets(id) ON DELETE SET NULL,
  error       text NULL,
  started_at  timestamptz NULL,
  finished_at timestamptz NULL,
  created_by  uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_rj_status_chk CHECK (status IN ('queued','running','done','failed')),
  CONSTRAINT studio_rj_progress_chk CHECK (progress BETWEEN 0 AND 100)
);
COMMENT ON TABLE public.studio_render_jobs IS 'Creative Studio: template video render jobs (ffmpeg). Params/steps only — never script text.';
CREATE INDEX IF NOT EXISTS studio_rj_master_idx ON public.studio_render_jobs (master_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS studio_rj_one_active_uidx ON public.studio_render_jobs (master_id) WHERE status IN ('queued','running');

ALTER TABLE public.studio_render_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS studio_render_jobs_admin_all ON public.studio_render_jobs;
CREATE POLICY studio_render_jobs_admin_all ON public.studio_render_jobs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS studio_render_jobs_updated_at ON public.studio_render_jobs;
CREATE TRIGGER studio_render_jobs_updated_at BEFORE UPDATE ON public.studio_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

UPDATE storage.buckets
SET file_size_limit = 209715200, -- 200 MB
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','audio/mpeg','video/mp4']
WHERE id = 'studio-media';

COMMIT;
