-- Migration 0121 — Creative Studio: autopilot (scheduled end-to-end production + posting).
-- One row per scheduled run; steps/counters only, never script or caption text.

BEGIN;

CREATE TABLE IF NOT EXISTS public.studio_autopilot_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status       text NOT NULL DEFAULT 'running',
  step         text NULL,
  progress     integer NOT NULL DEFAULT 0,
  trigger      text NOT NULL DEFAULT 'cron',
  master_id    uuid NULL REFERENCES public.studio_content_masters(id) ON DELETE SET NULL,
  idea_id      uuid NULL REFERENCES public.studio_ideas(id) ON DELETE SET NULL,
  pillar       text NULL,
  platforms    text[] NOT NULL DEFAULT '{}'::text[],
  published    boolean NOT NULL DEFAULT false,
  stopped_at   text NULL,                          -- machine-readable stop reason (privacy_blocked, claims, not_connected…)
  error        text NULL,
  stats        jsonb NOT NULL DEFAULT '{}'::jsonb, -- {images, shots, video_sec, posts}
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_ar_status_chk CHECK (status IN ('running','done','failed','skipped','review')),
  CONSTRAINT studio_ar_trigger_chk CHECK (trigger IN ('cron','manual')),
  CONSTRAINT studio_ar_progress_chk CHECK (progress BETWEEN 0 AND 100)
);
COMMENT ON TABLE public.studio_autopilot_runs IS 'Creative Studio autopilot: one row per scheduled production run. Steps/counters only — never script or caption text.';
CREATE INDEX IF NOT EXISTS studio_ar_created_idx ON public.studio_autopilot_runs (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS studio_ar_one_running_uidx ON public.studio_autopilot_runs ((status)) WHERE status = 'running';

ALTER TABLE public.studio_autopilot_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS studio_autopilot_runs_admin_all ON public.studio_autopilot_runs;
CREATE POLICY studio_autopilot_runs_admin_all ON public.studio_autopilot_runs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS studio_autopilot_runs_updated_at ON public.studio_autopilot_runs;
CREATE TRIGGER studio_autopilot_runs_updated_at BEFORE UPDATE ON public.studio_autopilot_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS autopilot jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.studio_settings.autopilot IS 'Autopilot config: enabled, days, platforms, pillar_mode/pillar, target_seconds, images_per_run, auto_publish, publish_on_review_required, allow_unsupported_claims, max_runs_per_week.';

COMMIT;
