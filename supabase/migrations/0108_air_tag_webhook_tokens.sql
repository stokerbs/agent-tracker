-- Migration 0108 — AirTag webhook tokens for automated (iOS Shortcuts) position ingestion
--
-- Extends the manual/CSV AirTag location-history feature (0107) with a third
-- ingestion path: a per-tracker, long-lived bearer token that an iOS
-- Shortcuts automation can present to a webhook endpoint to POST the
-- tracker's current location on a schedule. Find My/Hocco expose no public
-- API, so this is the only practical way to get periodic fixes without a
-- human re-entering coordinates by hand.
--
-- Because a Shortcuts automation has no interactive Supabase session, it
-- cannot satisfy auth.uid()-based RLS. The webhook endpoint therefore uses
-- the service-role client to look up the presented token by its SHA-256
-- hash and, once validated, performs the resulting air_tag_positions insert
-- itself (attributed to token.created_by as entered_by) — this is the one
-- deliberate, narrow service-role usage in this feature. The token is never
-- stored in plaintext; only its hash (for lookup) and an 8-char prefix (for
-- display) are persisted.
--
-- Adds:
--   air_tag_webhook_tokens — one row per issued webhook token, scoped to a
--                            single air_tag_trackers row.
--
-- Alters:
--   air_tag_positions.source CHECK constraint — widened from
--   ('manual', 'csv_import') to also allow 'shortcuts_webhook', via
--   DROP/ADD CONSTRAINT (no table recreation).
--
-- Access model for air_tag_webhook_tokens (mirrors the can_access_case()-scoped
-- pattern from 0107, applied via the parent tracker's case_id):
--   Admin      — ALL, unconditional.
--   Supervisor — SELECT only, scoped to assigned cases via can_access_case().
--                No INSERT/UPDATE — supervisors don't create trackers or
--                positions in this feature either (0107), so they don't
--                mint or revoke tokens either. Consistent with that model.
--   Agent      — SELECT + INSERT + UPDATE, scoped to assigned cases via
--                can_access_case(). INSERT WITH CHECK pins
--                created_by = auth.uid() — the client can never assert
--                authorship of someone else's token. UPDATE is how the app
--                implements "revoke" (set revoked_at); there is no DELETE
--                policy for anyone but admin, so revocation history is kept.
--   Client     — no policy at all → default deny (RLS enabled, zero
--                matching policies), matching gps_devices/0107.
--
-- token_hash is a SHA-256 hex digest and is never reversible; token_prefix
-- is only the first ~8 chars of the plaintext and is far too short to
-- reconstruct or brute-force the full token. Because of that, no column is
-- hidden from the SELECT policies above — the token-management UI needs to
-- list existing tokens by label/prefix/last-used/revoked state, and the
-- security property here comes from what's stored, not from restricting
-- which columns a policy returns. The only thing that ever needs token_hash
-- for a live lookup (matching an inbound webhook request against a stored
-- hash) is the webhook endpoint itself, running as service_role, which
-- bypasses RLS entirely by design — no policy grants it that access.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. air_tag_webhook_tokens — one row per issued webhook token
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.air_tag_webhook_tokens (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  air_tag_id    uuid        NOT NULL REFERENCES public.air_tag_trackers(id) ON DELETE CASCADE,
  token_hash    text        NOT NULL,
  token_prefix  text        NOT NULL,
  created_by    uuid        NOT NULL REFERENCES public.profiles(id),
  label         text        NULL,
  last_used_at  timestamptz NULL,
  revoked_at    timestamptz NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT air_tag_webhook_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT air_tag_webhook_tokens_token_hash_key UNIQUE (token_hash),
  CONSTRAINT air_tag_webhook_tokens_label_len CHECK (label IS NULL OR char_length(label) <= 120)
);

COMMENT ON TABLE public.air_tag_webhook_tokens IS
  'Per-tracker bearer tokens authenticating automated (e.g. iOS Shortcuts) position-ingestion webhook calls. Only a SHA-256 hash + short display prefix are stored — the plaintext token is never persisted anywhere. Looked up by the webhook endpoint via service-role client (an unauthenticated Shortcuts call has no auth.uid() to satisfy RLS).';

COMMENT ON COLUMN public.air_tag_webhook_tokens.token_hash IS
  'SHA-256 hex digest of the plaintext token. Never the plaintext itself. Unique-indexed for fast webhook lookup by the service-role client.';

COMMENT ON COLUMN public.air_tag_webhook_tokens.token_prefix IS
  'First ~8 chars of the plaintext token, retained only so the UI can show a masked identifier (e.g. abcd1234••••••). Too short to reconstruct or brute-force the full token.';

COMMENT ON COLUMN public.air_tag_webhook_tokens.created_by IS
  'Token creator. Because Shortcuts webhook calls have no interactive user, this is also the profile that automated position inserts made with this token are attributed to as air_tag_positions.entered_by.';

-- token_hash already has a fast unique index via the UNIQUE constraint above
-- (air_tag_webhook_tokens_token_hash_key) — no separate index needed for
-- webhook lookup by hash.

CREATE INDEX IF NOT EXISTS air_tag_webhook_tokens_active_idx
  ON public.air_tag_webhook_tokens (air_tag_id)
  WHERE revoked_at IS NULL;

-- ── Audit trigger ─────────────────────────────────────────────────────────────
-- Sensitive: these tokens grant an unattended write path into evidentiary
-- position data, so their full lifecycle (issue/revoke) is audit-logged the
-- same way air_tag_trackers/air_tag_positions already are (0107).

DROP TRIGGER IF EXISTS trg_audit_air_tag_webhook_tokens ON public.air_tag_webhook_tokens;
CREATE TRIGGER trg_audit_air_tag_webhook_tokens
  AFTER INSERT OR UPDATE OR DELETE ON public.air_tag_webhook_tokens
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. air_tag_positions.source — widen CHECK to allow 'shortcuts_webhook'
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.air_tag_positions
  DROP CONSTRAINT air_tag_positions_source_check;

ALTER TABLE public.air_tag_positions
  ADD CONSTRAINT air_tag_positions_source_check
  CHECK (source IN ('manual', 'csv_import', 'shortcuts_webhook'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RLS — enable
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.air_tag_webhook_tokens ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RLS — air_tag_webhook_tokens
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "air_tag_webhook_tokens_admin_all"        ON public.air_tag_webhook_tokens;
DROP POLICY IF EXISTS "air_tag_webhook_tokens_supervisor_select" ON public.air_tag_webhook_tokens;
DROP POLICY IF EXISTS "air_tag_webhook_tokens_agent_select"       ON public.air_tag_webhook_tokens;
DROP POLICY IF EXISTS "air_tag_webhook_tokens_agent_insert"       ON public.air_tag_webhook_tokens;
DROP POLICY IF EXISTS "air_tag_webhook_tokens_agent_update"       ON public.air_tag_webhook_tokens;

-- Admin: unrestricted full CRUD
CREATE POLICY "air_tag_webhook_tokens_admin_all" ON public.air_tag_webhook_tokens
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Supervisor: read only, scoped to assigned cases via the parent tracker's
-- case_id. No INSERT/UPDATE — supervisors don't mint or revoke tokens,
-- consistent with them not creating trackers/positions either (0107).
CREATE POLICY "air_tag_webhook_tokens_supervisor_select" ON public.air_tag_webhook_tokens
  FOR SELECT
  USING (
    public."current_role"() = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM public.air_tag_trackers t
      WHERE t.id = air_tag_webhook_tokens.air_tag_id
        AND public.can_access_case(t.case_id)
    )
  );

-- Agent: read tokens for trackers on assigned cases only
CREATE POLICY "air_tag_webhook_tokens_agent_select" ON public.air_tag_webhook_tokens
  FOR SELECT
  USING (
    public."current_role"() = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.air_tag_trackers t
      WHERE t.id = air_tag_webhook_tokens.air_tag_id
        AND public.can_access_case(t.case_id)
    )
  );

-- Agent: create tokens for trackers on assigned cases only. created_by is
-- never trusted from the client — it must match the inserting user.
CREATE POLICY "air_tag_webhook_tokens_agent_insert" ON public.air_tag_webhook_tokens
  FOR INSERT
  WITH CHECK (
    public."current_role"() = 'agent'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.air_tag_trackers t
      WHERE t.id = air_tag_webhook_tokens.air_tag_id
        AND public.can_access_case(t.case_id)
    )
  );

-- Agent: update tokens for trackers on assigned cases only — used by the app
-- to revoke a token (set revoked_at). No DELETE policy for agents: revoke,
-- never hard-delete, so token history/audit trail is preserved.
CREATE POLICY "air_tag_webhook_tokens_agent_update" ON public.air_tag_webhook_tokens
  FOR UPDATE
  USING (
    public."current_role"() = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.air_tag_trackers t
      WHERE t.id = air_tag_webhook_tokens.air_tag_id
        AND public.can_access_case(t.case_id)
    )
  )
  WITH CHECK (
    public."current_role"() = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.air_tag_trackers t
      WHERE t.id = air_tag_webhook_tokens.air_tag_id
        AND public.can_access_case(t.case_id)
    )
  );

-- No client policy → default deny.
-- No DELETE policy for supervisor or agent → revoke via revoked_at only,
-- history is kept (mirrors air_tag_trackers soft-delete-only pattern).
-- No service_role policy needed → service_role bypasses RLS entirely, which
-- is how the webhook endpoint performs its hash lookup and last_used_at
-- bump without an auth.uid().

COMMIT;
