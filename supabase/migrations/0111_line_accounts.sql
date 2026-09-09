-- Migration 0111 (renumbered from 0109 — collided with 0109_creative_studio) — LINE bot account linking (Round 1: read-only case/timeline lookup)
--
-- Adds `line_accounts`, which maps a LINE Messaging API user ID to an
-- `agents` row once the agent has verified ownership of their phone number
-- via an OTP sent/checked through the LINE webhook. Round 1 is read-only
-- (case lookup + timeline view via LINE chat) — no write/add-timeline-entry
-- path exists yet; that is Round 2 and is NOT built here.
--
-- Access model — mirrors the "RLS enabled, service-role only, no
-- user-facing policies" pattern established by `gps903_credentials` (0041):
-- every request that touches this table originates from the LINE webhook
-- (an inbound HTTP call from LINE's platform, not a Supabase browser/mobile
-- session), so there is no auth.uid() to write a meaningful policy against —
-- exactly like a GPS903 device push has no Supabase session either. The
-- webhook handler therefore always uses createServiceClient() (service_role,
-- bypasses RLS by design) with authorization enforced in the application
-- layer (LINE signature verification + OTP check), never a user JWT. RLS is
-- still enabled so that if a future code path is ever added that queries
-- this table with a normal (non-service) client, the default-deny posture
-- (RLS enabled, zero matching policies) blocks it instead of silently
-- leaking OTP hashes/phone numbers.
--
-- OTP handling: only otp_code_hash (never the raw code) and otp_expires_at
-- are stored; otp_attempts guards against brute-force guessing and
-- otp_requested_at supports rate-limiting repeated OTP requests. All are
-- nullable and get cleared out by the webhook once linking succeeds/expires
-- (application-layer concern, not enforced by this migration).
--
-- Audit trail: reuses the generic public.log_audit() trigger already used
-- for other sensitive tables (0002 for cases/agents/reports/alerts; 0107/0108
-- for air_tag_trackers/air_tag_positions/air_tag_webhook_tokens) rather than
-- inventing a new audit subsystem. Every INSERT/UPDATE/DELETE (link attempt,
-- successful link, unlink, OTP retry) is captured with a full row snapshot
-- in audit_logs.metadata. Because every write to this table happens via the
-- service-role webhook (no interactive Supabase session), log_audit()'s
-- actor_id column (sourced from auth.uid()) will be NULL for these rows —
-- consistent with how any other system/service-role-originated audit row
-- behaves elsewhere in this schema (audit_logs.actor_id is nullable with
-- ON DELETE SET NULL for exactly this reason). The row itself (metadata)
-- still captures which line_user_id / agent_id / linked_at changed, which is
-- what matters for a link/unlink trail.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. line_accounts — one row per LINE user that has interacted with the bot
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.line_accounts (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  line_user_id         text        NOT NULL,
  agent_id             uuid        REFERENCES public.agents(id) ON DELETE SET NULL,
  phone_at_link_time   text,
  otp_code_hash        text,
  otp_expires_at       timestamptz,
  otp_attempts         int         NOT NULL DEFAULT 0,
  otp_requested_at     timestamptz,
  linked_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT line_accounts_pkey                PRIMARY KEY (id),
  CONSTRAINT line_accounts_line_user_id_unique UNIQUE (line_user_id),
  CONSTRAINT line_accounts_agent_id_unique     UNIQUE (agent_id),
  CONSTRAINT line_accounts_otp_attempts_nonneg CHECK (otp_attempts >= 0)
);

COMMENT ON TABLE public.line_accounts IS
  'Maps a LINE Messaging API user to an agents row once phone+OTP verification succeeds. Round 1 (read-only case/timeline lookup via LINE chat) only — no timeline-write path here yet (Round 2). Written exclusively by the LINE webhook via the service-role client; RLS is enabled with no user-facing policies (default deny), matching the gps903_credentials pattern.';

COMMENT ON COLUMN public.line_accounts.line_user_id IS
  'LINE Messaging API user ID (the "userId" from LINE webhook events). Stable per LINE account, globally unique.';

COMMENT ON COLUMN public.line_accounts.agent_id IS
  'agents.id this LINE account has been linked to. NULL until a successful OTP verification links it. Unique when set — one LINE account per agent, one agent per LINE account.';

COMMENT ON COLUMN public.line_accounts.phone_at_link_time IS
  'Phone number the agent supplied via LINE chat to start linking, matched against agents.phone (free-text, unnormalized, same convention as agents.phone itself — see 0001) to identify the candidate agent before the OTP challenge. Retained for the audit trail even after linking succeeds.';

COMMENT ON COLUMN public.line_accounts.otp_code_hash IS
  'Hash of the one-time verification code sent to the agent. The raw OTP is never stored, only this hash, checked by the webhook at verification time.';

COMMENT ON COLUMN public.line_accounts.otp_expires_at IS
  'Expiry timestamp for the currently outstanding OTP (if any). The webhook must reject verification attempts after this time.';

COMMENT ON COLUMN public.line_accounts.otp_attempts IS
  'Number of verification attempts made against the current OTP. The webhook uses this to lock out/require a fresh OTP after repeated failures (brute-force guard).';

COMMENT ON COLUMN public.line_accounts.otp_requested_at IS
  'When the current/most recent OTP was issued. Used by the webhook to rate-limit repeated OTP requests for the same LINE account.';

COMMENT ON COLUMN public.line_accounts.linked_at IS
  'Timestamp of successful linking (agent_id set + OTP verified). NULL until then; also the moment the account becomes usable for read-only case/timeline lookup via LINE chat.';

CREATE INDEX IF NOT EXISTS line_accounts_line_user_id_idx
  ON public.line_accounts (line_user_id);

CREATE INDEX IF NOT EXISTS line_accounts_agent_id_idx
  ON public.line_accounts (agent_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────
-- Reuses the canonical public.set_updated_at() (0002; consolidated in 0075)
-- rather than defining a new one-off function.

DROP TRIGGER IF EXISTS line_accounts_updated_at ON public.line_accounts;
CREATE TRIGGER line_accounts_updated_at
  BEFORE UPDATE ON public.line_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Audit trigger ─────────────────────────────────────────────────────────────
-- Link/unlink events (and OTP-verification writes leading up to them) are
-- sensitive account-linking actions; reuses the generic public.log_audit()
-- trigger (0002/0107/0108) rather than a bespoke audit mechanism.

DROP TRIGGER IF EXISTS trg_audit_line_accounts ON public.line_accounts;
CREATE TRIGGER trg_audit_line_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.line_accounts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RLS — enabled, no user-facing policies (service-role only)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.line_accounts ENABLE ROW LEVEL SECURITY;
-- No policies are defined here on purpose. A LINE-originated webhook request
-- carries no Supabase auth session, so there is no auth.uid() to write a
-- policy against — same rationale as gps903_credentials (0041). All
-- reads/writes go through the LINE webhook route using createServiceClient()
-- (service_role bypasses RLS entirely by design). With RLS enabled and zero
-- matching policies, any other (non-service-role) client is denied by
-- default, which is what we want: OTP hashes and phone numbers here must
-- never be reachable from an ordinary user session.

COMMIT;
