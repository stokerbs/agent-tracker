-- 0079_job_board.sql
-- Job Board: admins post a case to a shared board with a slot quota; agents
-- request to claim it; admins approve/reject. Approving assigns the agent
-- (public.case_agents) exactly like a direct assignment, so the rest of the app
-- (case visibility, notifications) keeps working unchanged.
--
-- SECURITY: agents must NOT gain RLS read on board cases — that would leak the
-- encrypted target intel of every unassigned case to the whole agent roster.
-- The board listing is therefore served by a service-role server action that
-- returns only safe, non-sensitive fields. An agent gains full case read only
-- AFTER an admin approves their claim (the existing "cases agent read" policy
-- via case_agents). No broad cases RLS is added here.

-- ── 1. Board fields on cases ────────────────────────────────────────────────
alter table public.cases
  add column if not exists on_board        boolean     not null default false,
  add column if not exists board_slots     integer,
  add column if not exists board_posted_by uuid references public.profiles (id) on delete set null,
  add column if not exists board_posted_at timestamptz;

-- A slot quota, when present, is positive; a case on the board must have one.
alter table public.cases
  add constraint cases_board_slots_positive check (board_slots is null or board_slots > 0),
  add constraint cases_board_requires_slots check (not on_board or board_slots is not null);

-- Partial index — the board query only ever filters on_board = true.
create index if not exists cases_on_board_idx on public.cases (on_board) where on_board;

-- ── 2. Claim requests ───────────────────────────────────────────────────────
create type claim_status as enum ('pending', 'approved', 'rejected');

create table public.case_claims (
  id           uuid         primary key default gen_random_uuid(),
  case_id      uuid         not null references public.cases (id)  on delete cascade,
  agent_id     uuid         not null references public.agents (id) on delete cascade,
  status       claim_status not null default 'pending',
  note         text,
  requested_at timestamptz  not null default now(),
  decided_by   uuid         references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  unique (case_id, agent_id)
);

create index case_claims_case_idx   on public.case_claims (case_id);
create index case_claims_agent_idx  on public.case_claims (agent_id);
create index case_claims_status_idx on public.case_claims (status);

alter table public.case_claims enable row level security;

-- Staff (admin/supervisor) read and manage every claim (approve/reject).
create policy "case_claims staff manage" on public.case_claims
  for all using (public.is_staff()) with check (public.is_staff());

-- An agent reads only their own claims …
create policy "case_claims agent read" on public.case_claims
  for select using (
    exists (
      select 1 from public.agents a
      where a.id = case_claims.agent_id and a.profile_id = auth.uid()
    )
  );

-- … and may file a claim only as themselves (the action validates on_board).
create policy "case_claims agent insert" on public.case_claims
  for insert with check (
    exists (
      select 1 from public.agents a
      where a.id = case_claims.agent_id and a.profile_id = auth.uid()
    )
  );
