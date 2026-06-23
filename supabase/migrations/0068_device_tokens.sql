-- 0068_device_tokens.sql
-- Stores native push tokens (FCM/APNs) per user/device for the Field Agent app.
-- Phase A registers + stores tokens; Phase B reads them (service role) to send
-- push via FCM. One row per token; a token is globally unique (re-registering
-- the same device upserts and re-points it at the current user).

CREATE TABLE public.device_tokens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform     text        NOT NULL,            -- 'ios' | 'android' | 'web'
  token        text        NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX device_tokens_profile_idx ON public.device_tokens (profile_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- A user manages only their own device tokens. The push sender uses the service
-- role (bypasses RLS), so no broad read policy is needed.
CREATE POLICY "device_tokens self select"
  ON public.device_tokens FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "device_tokens self insert"
  ON public.device_tokens FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "device_tokens self update"
  ON public.device_tokens FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "device_tokens self delete"
  ON public.device_tokens FOR DELETE
  USING (profile_id = auth.uid());
