-- 0082_board_claim_reminder.sql
-- Tracks whether the "your board job starts soon" reminder has been sent for an
-- approved claim, so the reminder cron (/api/cron/board-reminders) sends it once.

alter table public.case_claims
  add column if not exists reminded_at timestamptz;
