-- Migration 0110 — LINE bot pending-attachment state (Round 3: photo/location
-- follow-up on a just-added timeline entry)
--
-- Round 2 (src/lib/line/commands/add-timeline.ts, already shipped) lets a
-- linked agent add a text timeline entry via LINE chat. LINE's Messaging API
-- cannot deliver a single message with text + photo + location together, so
-- Round 3 lets the agent send a photo and/or a shared LINE location as
-- separate follow-up messages that attach to the entry they just created:
--   - photo    -> a new evidence row, linked via evidence.timeline_entry_id
--                 (FK already exists, added in 0049)
--   - location -> updates that same timeline_entries row's location text
--                 field in place
--
-- To know "attach this photo/location to entry X on case Y" when the
-- follow-up message arrives, we need short-lived state remembered between
-- the add-timeline-entry message and the next one or two messages. That
-- state lives directly on line_accounts (0109) rather than a new table,
-- since it is 1:1 with a linked LINE account and always superseded by the
-- next add-timeline-entry call — there is at most one "pending attachment
-- window" open per LINE account at a time.
--
-- These three columns are written/read exclusively by the LINE webhook via
-- createServiceClient(), exactly like every other column on this table (see
-- 0109's access-model note) — nothing new for RLS to cover here.
--
-- Expiry model: pending_attachment_expires_at is set by the application
-- layer (not this migration) to a few minutes after the entry is created.
-- The webhook must check it is still in the future before honoring a
-- photo/location follow-up as an attachment; once expired (or once the
-- window is consumed/superseded), a bare photo/location message is treated
-- as unattached input instead of silently attaching to a stale entry.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. line_accounts — add pending-attachment window columns
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.line_accounts
  ADD COLUMN IF NOT EXISTS pending_attachment_entry_id  uuid
    REFERENCES public.timeline_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_attachment_case_id   uuid
    REFERENCES public.cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_attachment_expires_at timestamptz;

COMMENT ON COLUMN public.line_accounts.pending_attachment_entry_id IS
  'timeline_entries.id the agent just created via LINE chat and may follow up with a photo/location attachment for. NULL when no attachment window is open. ON DELETE SET NULL rather than blocking the delete: if the entry is later removed (e.g. soft-deleted then hard-purged), this pointer should simply go stale/null, not prevent the entry from being deleted.';

COMMENT ON COLUMN public.line_accounts.pending_attachment_case_id IS
  'cases.id the pending entry belongs to, captured at the moment the entry was created. Deliberately redundant with what could be derived by joining pending_attachment_entry_id -> timeline_entries.case_id: storing it directly means the attach-time authorization re-check does not need an extra join, and pins the case_id used for that re-check to entry-creation time rather than implicitly following timeline_entries.case_id if it were ever changed later. ON DELETE SET NULL for the same "go stale, do not block the delete" reason as pending_attachment_entry_id.';

COMMENT ON COLUMN public.line_accounts.pending_attachment_expires_at IS
  'Deadline for honoring a photo/location follow-up message as an attachment to pending_attachment_entry_id. Set by the application layer to a few minutes after entry creation; the webhook must verify this is still in the future (and the window has not already been consumed) before attaching. NULL when no window is open.';

-- ─────────────────────────────────────────────────────────────────────────
-- Index: supports a future cleanup job scanning for expired-but-still-set
-- pending-attachment windows (mirrors the retention-cleanup pattern already
-- used by the daily /api/cron/cleanup-positions job, which sweeps old rows
-- out of gps_device_positions / agent_location_history on a schedule — a
-- similar cron here would do `UPDATE line_accounts SET
-- pending_attachment_entry_id = NULL, pending_attachment_case_id = NULL,
-- pending_attachment_expires_at = NULL WHERE pending_attachment_expires_at <
-- now()`). No such job exists yet (out of scope for this migration); the
-- partial index keeps that query efficient once one is added, at near-zero
-- cost today since almost every row has this column NULL (no window open).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS line_accounts_pending_attachment_expires_at_idx
  ON public.line_accounts (pending_attachment_expires_at)
  WHERE pending_attachment_expires_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Triggers / RLS — nothing new needed
-- ═══════════════════════════════════════════════════════════════════════════
-- updated_at (line_accounts_updated_at, 0109) and audit (trg_audit_line_accounts,
-- 0109) are both row-level triggers firing on INSERT/UPDATE/DELETE of
-- public.line_accounts as a whole; they already cover every column,
-- including these three, with no redefinition required.
--
-- RLS: line_accounts already has ROW LEVEL SECURITY enabled with zero
-- user-facing policies (service-role only — see 0109). RLS policies apply
-- per-row, not per-column, so that default-deny posture already protects
-- these new columns too; no new policy is needed or added here.

COMMIT;
