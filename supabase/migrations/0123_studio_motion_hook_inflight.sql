-- Motion hook (docs §17): one generating clip per content.
-- The application also checks, but a check-then-act cannot stop two concurrent clicks from both paying Veo
-- (~฿22 each). This partial unique index makes the guard real; the insert then fails with 23505 and the action
-- reports "already generating".
CREATE UNIQUE INDEX IF NOT EXISTS studio_ca_motion_hook_inflight_uniq
  ON public.studio_creative_assets (master_id)
  WHERE kind = 'broll' AND status = 'pending' AND (meta -> 'target' ->> 'kind') = 'hook_motion';
