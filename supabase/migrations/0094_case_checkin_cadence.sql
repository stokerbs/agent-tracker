-- 0094 — Per-case agent check-in cadence.
--
-- Lets staff require that a case receives a timeline entry at least every N
-- minutes. A cron (/api/cron/checkin-monitor) reminds the assigned agents when a
-- case is overdue and escalates to supervisors/admins if it stays overdue past a
-- grace window. Any timeline entry on the case resets the clock.
--
--   checkin_interval_minutes  NULL = cadence off (default). > 0 = required gap.
--   checkin_stage             dedup state for the cron's notifications:
--                             'ok' → on track, 'reminded' → agents pinged,
--                             'escalated' → supervisors alerted. Resets to 'ok'
--                             automatically once a fresh report lands.

alter table public.cases
  add column if not exists checkin_interval_minutes int,
  add column if not exists checkin_stage text not null default 'ok';

alter table public.cases
  drop constraint if exists cases_checkin_interval_positive,
  add  constraint cases_checkin_interval_positive
    check (checkin_interval_minutes is null or checkin_interval_minutes > 0);

alter table public.cases
  drop constraint if exists cases_checkin_stage_valid,
  add  constraint cases_checkin_stage_valid
    check (checkin_stage in ('ok', 'reminded', 'escalated'));

comment on column public.cases.checkin_interval_minutes is
  'Required max gap (minutes) between timeline entries for this case. NULL = off.';
comment on column public.cases.checkin_stage is
  'Check-in cron dedup state: ok | reminded | escalated.';
