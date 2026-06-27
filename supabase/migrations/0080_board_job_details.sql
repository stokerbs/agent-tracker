-- 0080_board_job_details.sql
-- Extra job details shown on the Job Board card, entered by the admin when
-- posting a case to the board. These are deliberately separate, non-sensitive
-- fields (NOT the encrypted target intel) so they are safe to show every agent
-- browsing the board.

alter table public.cases
  add column if not exists board_start_at timestamptz, -- when the job starts
  add column if not exists board_duration text,         -- e.g. "8 ชม." / "3 วัน"
  add column if not exists board_pay      numeric,       -- pay the agent will earn
  add column if not exists board_location text;          -- where to start (meet point)

alter table public.cases
  add constraint cases_board_pay_nonneg check (board_pay is null or board_pay >= 0);
