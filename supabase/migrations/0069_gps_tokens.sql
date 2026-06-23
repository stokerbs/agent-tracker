-- 0069_gps_tokens.sql
-- Long-lived per-user token for background GPS reporting from the native app.
--
-- Why: background location fires while the app is suspended/relaunched by the OS,
-- where the WebView's Supabase session cookies are not reliably available. The
-- native background-geolocation watcher posts to /api/agents/location with
-- `Authorization: Bearer <gps_token>` instead. The route resolves the token to a
-- profile via the service role. One active token per user (re-issued on demand).

CREATE TABLE public.gps_tokens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token        text        NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

CREATE INDEX gps_tokens_profile_idx ON public.gps_tokens (profile_id);

ALTER TABLE public.gps_tokens ENABLE ROW LEVEL SECURITY;

-- A user manages only their own GPS tokens. The location route validates tokens
-- with the service role (bypasses RLS), so no broad read policy is needed.
CREATE POLICY "gps_tokens self select"
  ON public.gps_tokens FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "gps_tokens self insert"
  ON public.gps_tokens FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "gps_tokens self delete"
  ON public.gps_tokens FOR DELETE
  USING (profile_id = auth.uid());
