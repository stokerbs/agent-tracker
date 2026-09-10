-- Migration 0119 — Creative Studio: one live/queued social post per master × platform.
-- Guards the race between two concurrent publish requests (the action layer
-- also checks); failed/deleted rows may repeat.

BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS studio_sp_active_uidx
  ON public.studio_social_posts (master_id, platform)
  WHERE status IN ('queued','scheduled','published');
COMMIT;
