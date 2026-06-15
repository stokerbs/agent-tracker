-- ============================================================================
-- Migration 0009 — RLS hardening (security audit findings)
--
-- Fixes:
--   V-1 (HIGH)   cases staff write FOR ALL gave supervisors DELETE access.
--                Split into per-operation policies; DELETE is now admin-only.
--
--   V-2 (HIGH)   expenses agent own FOR ALL gave agents UPDATE+DELETE access.
--                Agents can only INSERT and SELECT their own expenses.
--                Added audit trigger on expenses (was unaudited).
--
--   V-3 (MEDIUM) timeline agent insert had no agent_id self-ownership check.
--                An assigned agent could submit entries attributed to any
--                other agent. Now enforces agent_id = my_agent_id().
--
--   V-4 (MEDIUM) profiles self read used is_staff(), giving supervisors read
--                access to admin profiles (email, phone, role). Supervisors
--                now see only non-admin profiles; admins see all.
--
--   V-5 (LOW)    alerts agent insert had no case_id assignment check. Agents
--                could link an alert to any case. Now requires case assignment
--                when case_id is supplied.
-- ============================================================================

-- ─── V-1: cases — supervisor DELETE removed ──────────────────────────────────

drop policy "cases staff write" on public.cases;

create policy "cases staff insert"
  on public.cases for insert
  with check (public.is_staff());

create policy "cases staff update"
  on public.cases for update
  using  (public.is_staff())
  with check (public.is_staff());

-- Only admins may delete a case (irreversible destruction of surveillance record).
create policy "cases admin delete"
  on public.cases for delete
  using (public.is_admin());

-- ─── V-2: expenses — agents restricted to INSERT + SELECT ────────────────────

drop policy "expenses agent own" on public.expenses;

create policy "expenses agent insert"
  on public.expenses for insert
  with check (
    exists (
      select 1 from public.agents a
      where a.id = expenses.agent_id and a.profile_id = auth.uid()
    )
  );

create policy "expenses agent select"
  on public.expenses for select
  using (
    exists (
      select 1 from public.agents a
      where a.id = expenses.agent_id and a.profile_id = auth.uid()
    )
  );

-- Audit trigger on expenses (was missing; agents could previously delete
-- records without any log entry).
create trigger trg_audit_expenses
  after insert or update or delete on public.expenses
  for each row execute function public.log_audit();

-- ─── V-3: timeline — enforce agent_id self-ownership on insert ───────────────

drop policy "timeline agent insert" on public.timeline_entries;

create policy "timeline agent insert"
  on public.timeline_entries for insert
  with check (
    -- Submitter must be assigned to the case.
    exists (
      select 1
      from public.case_agents ca
      join public.agents a on a.id = ca.agent_id
      where ca.case_id = timeline_entries.case_id
        and a.profile_id = auth.uid()
    )
    -- Entry must be attributed to the submitting agent (or left null).
    and (agent_id is null or agent_id = public.my_agent_id())
  );

-- ─── V-4: profiles — supervisors cannot enumerate admin accounts ─────────────

drop policy "profiles self read" on public.profiles;

-- Admins: all profiles (via profiles admin all FOR ALL, already covers SELECT).
-- Supervisors: their own profile + any non-admin profile.
-- Agents / clients: their own profile only.
create policy "profiles self read"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_admin()
    or (public.current_role() = 'supervisor' and role <> 'admin')
  );

-- ─── V-5: alerts — restrict case_id to assigned cases ───────────────────────

drop policy "alerts agent insert" on public.emergency_alerts;

create policy "alerts agent insert"
  on public.emergency_alerts for insert
  with check (
    -- Alert must belong to the submitting agent.
    exists (
      select 1 from public.agents a
      where a.id = emergency_alerts.agent_id and a.profile_id = auth.uid()
    )
    -- If a case_id is supplied it must be a case the agent is assigned to.
    and (
      emergency_alerts.case_id is null
      or exists (
        select 1
        from public.case_agents ca
        join public.agents a on a.id = ca.agent_id
        where ca.case_id = emergency_alerts.case_id
          and a.profile_id = auth.uid()
      )
    )
  );
