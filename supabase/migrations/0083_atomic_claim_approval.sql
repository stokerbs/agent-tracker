-- 0083_atomic_claim_approval.sql
-- Fix: slot-quota TOCTOU race in the Job Board approval flow.
--
-- decideClaim() (src/app/(dashboard)/cases/board-actions.ts, approve branch)
-- read the approved-claim count, checked it against cases.board_slots, and then
-- flipped the claim to 'approved' as SEPARATE statements. Two near-simultaneous
-- admin approvals on the last slot could both pass the check and over-fill the
-- quota — there was no DB-level guard (case_claims has no constraint tying the
-- approved count to board_slots).
--
-- This migration adds an atomic, transactional approval RPC. It takes a row
-- lock on the case (SELECT ... FOR UPDATE) so concurrent approvals for the same
-- case serialize; counts approved claims and flips the target claim to approved
-- in ONE transaction. The second concurrent approval blocks on the lock, then
-- sees the first one's now-approved claim and is rejected with 'quota_met'.
--
-- The function returns a discriminated outcome rather than raising for the
-- expected business cases (not_found / already_decided / quota_met) so the
-- server action can map each to the existing user-facing message. The action
-- still does its own requireRole() check and still reuses assignAgent() for the
-- actual case_agents assignment + notification AFTER a slot is reserved here.
--
-- SECURITY: SECURITY DEFINER so the lock + writes run with a stable, owner
-- privilege set independent of RLS. Execute is granted to service_role only
-- (the Job Board flow is service-client-only by design — agents have no RLS
-- read on board cases), matching every other board-actions server action.

create or replace function public.approve_case_claim(
  p_claim_id   uuid,
  p_decided_by uuid
)
returns table (
  outcome      text,
  case_id      uuid,
  agent_id     uuid,
  case_number  text,
  quota_filled boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id     uuid;
  v_agent_id    uuid;
  v_status      claim_status;
  v_slots       integer;
  v_case_number text;
  v_approved    integer;
begin
  outcome      := 'approved';
  quota_filled := false;

  -- Load + lock the claim row.
  select cc.case_id, cc.agent_id, cc.status
    into v_case_id, v_agent_id, v_status
    from public.case_claims cc
   where cc.id = p_claim_id
   for update;

  if not found then
    outcome := 'not_found';
    return next;
    return;
  end if;

  if v_status <> 'pending' then
    outcome := 'already_decided';
    return next;
    return;
  end if;

  -- Serialize concurrent approvals for the SAME case on the case row lock. The
  -- approved-count check + the claim flip below now happen under this lock, so
  -- a second approval cannot slip past a stale count.
  select c.board_slots, c.case_number
    into v_slots, v_case_number
    from public.cases c
   where c.id = v_case_id
   for update;

  select count(*)
    into v_approved
    from public.case_claims
   where case_id = v_case_id
     and status  = 'approved';

  if v_approved >= coalesce(v_slots, 0) then
    outcome := 'quota_met';
    return next;
    return;
  end if;

  -- Reserve the slot atomically.
  update public.case_claims
     set status     = 'approved',
         decided_by = p_decided_by,
         decided_at = now()
   where id = p_claim_id;

  -- Close the board for this case once the quota is met.
  quota_filled := (v_approved + 1) >= coalesce(v_slots, 0);
  if quota_filled then
    update public.cases set on_board = false where id = v_case_id;
  end if;

  case_id     := v_case_id;
  agent_id    := v_agent_id;
  case_number := v_case_number;
  return next;
end;
$$;

-- Lock down execution: this is a privileged, RLS-bypassing approval path. Only
-- the service-role client (used by the Job Board server actions, which gate on
-- requireRole) may call it.
revoke all     on function public.approve_case_claim(uuid, uuid) from public;
revoke execute on function public.approve_case_claim(uuid, uuid) from anon, authenticated;
grant  execute on function public.approve_case_claim(uuid, uuid) to   service_role;
