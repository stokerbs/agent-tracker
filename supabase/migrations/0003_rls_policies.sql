-- ============================================================================
-- Migration 0003 — Row Level Security policies (RBAC enforcement)
-- ============================================================================

-- Enable RLS on every table -------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.agents           enable row level security;
alter table public.clients          enable row level security;
alter table public.cases            enable row level security;
alter table public.case_agents      enable row level security;
alter table public.timeline_entries enable row level security;
alter table public.evidence         enable row level security;
alter table public.expenses         enable row level security;
alter table public.emergency_alerts enable row level security;
alter table public.reports          enable row level security;
alter table public.notifications    enable row level security;
alter table public.audit_logs       enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create policy "profiles self read"        on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "profiles self update"      on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin all"        on public.profiles for all    using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- agents — staff manage; agents read all (needed for the live map), update self
-- ----------------------------------------------------------------------------
create policy "agents read authed"        on public.agents for select using (auth.uid() is not null and public.current_role() <> 'client');
create policy "agents staff write"        on public.agents for all    using (public.is_staff()) with check (public.is_staff());
create policy "agents self update"        on public.agents for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- clients — admin/supervisor manage; client reads own row
-- ----------------------------------------------------------------------------
create policy "clients staff read"        on public.clients for select using (public.is_staff() or profile_id = auth.uid());
create policy "clients staff write"       on public.clients for all    using (public.is_staff()) with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- cases — admin: all; supervisor: all; agent: only assigned; client: own
-- ----------------------------------------------------------------------------
create policy "cases staff read"          on public.cases for select using (public.is_staff());
create policy "cases agent read"          on public.cases for select using (
  exists (
    select 1 from public.case_agents ca
    join public.agents a on a.id = ca.agent_id
    where ca.case_id = cases.id and a.profile_id = auth.uid()
  )
);
create policy "cases client read"         on public.cases for select using (
  exists (select 1 from public.clients c where c.id = cases.client_id and c.profile_id = auth.uid())
);
create policy "cases staff write"         on public.cases for all using (public.is_staff()) with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- case_agents — staff manage; agents read their own assignments
-- ----------------------------------------------------------------------------
create policy "case_agents staff write"   on public.case_agents for all using (public.is_staff()) with check (public.is_staff());
create policy "case_agents read"          on public.case_agents for select using (
  public.is_staff()
  or exists (select 1 from public.agents a where a.id = case_agents.agent_id and a.profile_id = auth.uid())
);

-- ----------------------------------------------------------------------------
-- timeline_entries — staff full; assigned agents insert/read on their cases
-- ----------------------------------------------------------------------------
create policy "timeline staff all"        on public.timeline_entries for all using (public.is_staff()) with check (public.is_staff());
create policy "timeline agent read"       on public.timeline_entries for select using (
  exists (
    select 1 from public.case_agents ca join public.agents a on a.id = ca.agent_id
    where ca.case_id = timeline_entries.case_id and a.profile_id = auth.uid()
  )
);
create policy "timeline agent insert"     on public.timeline_entries for insert with check (
  exists (
    select 1 from public.case_agents ca join public.agents a on a.id = ca.agent_id
    where ca.case_id = timeline_entries.case_id and a.profile_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- evidence — staff full; assigned agents insert/read on their cases
-- ----------------------------------------------------------------------------
create policy "evidence staff all"        on public.evidence for all using (public.is_staff()) with check (public.is_staff());
create policy "evidence agent read"       on public.evidence for select using (
  exists (
    select 1 from public.case_agents ca join public.agents a on a.id = ca.agent_id
    where ca.case_id = evidence.case_id and a.profile_id = auth.uid()
  )
);
create policy "evidence agent insert"     on public.evidence for insert with check (
  exists (
    select 1 from public.case_agents ca join public.agents a on a.id = ca.agent_id
    where ca.case_id = evidence.case_id and a.profile_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- expenses — staff full; agents manage their own
-- ----------------------------------------------------------------------------
create policy "expenses staff all"        on public.expenses for all using (public.is_staff()) with check (public.is_staff());
create policy "expenses agent own"        on public.expenses for all using (
  exists (select 1 from public.agents a where a.id = expenses.agent_id and a.profile_id = auth.uid())
) with check (
  exists (select 1 from public.agents a where a.id = expenses.agent_id and a.profile_id = auth.uid())
);

-- ----------------------------------------------------------------------------
-- emergency_alerts — staff read/manage; agents insert + read own
-- ----------------------------------------------------------------------------
create policy "alerts staff all"          on public.emergency_alerts for all using (public.is_staff()) with check (public.is_staff());
create policy "alerts agent insert"       on public.emergency_alerts for insert with check (
  exists (select 1 from public.agents a where a.id = emergency_alerts.agent_id and a.profile_id = auth.uid())
);
create policy "alerts agent read own"     on public.emergency_alerts for select using (
  exists (select 1 from public.agents a where a.id = emergency_alerts.agent_id and a.profile_id = auth.uid())
);

-- ----------------------------------------------------------------------------
-- reports — staff full; agents read on assigned cases; clients read approved+visible
-- ----------------------------------------------------------------------------
create policy "reports staff all"         on public.reports for all using (public.is_staff()) with check (public.is_staff());
create policy "reports agent read"        on public.reports for select using (
  exists (
    select 1 from public.case_agents ca join public.agents a on a.id = ca.agent_id
    where ca.case_id = reports.case_id and a.profile_id = auth.uid()
  )
);
create policy "reports client read"       on public.reports for select using (
  is_client_visible and status = 'approved'
  and exists (
    select 1 from public.cases c join public.clients cl on cl.id = c.client_id
    where c.id = reports.case_id and cl.profile_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- notifications — each user sees/updates only their own
-- ----------------------------------------------------------------------------
create policy "notifications own"         on public.notifications for select using (user_id = auth.uid());
create policy "notifications own update"  on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- audit_logs — admins read; nobody updates/deletes (immutable)
-- ----------------------------------------------------------------------------
create policy "audit admin read"          on public.audit_logs for select using (public.is_admin());
