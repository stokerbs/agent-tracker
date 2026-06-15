-- ============================================================================
-- Migration 0002 — Helper functions, triggers, RBAC helpers, audit, new-user hook
-- ============================================================================

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated  before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_agents_updated     before update on public.agents    for each row execute function public.set_updated_at();
create trigger trg_clients_updated    before update on public.clients   for each row execute function public.set_updated_at();
create trigger trg_cases_updated      before update on public.cases     for each row execute function public.set_updated_at();
create trigger trg_reports_updated    before update on public.reports   for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RBAC helper functions (SECURITY DEFINER so RLS policies can call safely)
-- ----------------------------------------------------------------------------
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'supervisor')
  );
$$;

-- Returns the agent row id linked to the calling user (or null)
create or replace function public.my_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.agents where profile_id = auth.uid();
$$;

-- True if the calling user is assigned to a given case (supervisor/agent path)
create or replace function public.can_access_case(target_case uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.case_agents ca
      join public.agents a on a.id = ca.agent_id
      where ca.case_id = target_case and a.profile_id = auth.uid()
    )
    or (
      public.current_role() = 'supervisor'
    );
$$;

-- ----------------------------------------------------------------------------
-- New auth user -> profile row
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'agent'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Generic audit logging trigger
-- ----------------------------------------------------------------------------
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id text;
begin
  v_entity_id := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'));
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    v_entity_id,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_audit_cases    after insert or update or delete on public.cases            for each row execute function public.log_audit();
create trigger trg_audit_agents   after insert or update or delete on public.agents           for each row execute function public.log_audit();
create trigger trg_audit_reports  after insert or update or delete on public.reports          for each row execute function public.log_audit();
create trigger trg_audit_alerts   after insert or update            on public.emergency_alerts for each row execute function public.log_audit();

-- ----------------------------------------------------------------------------
-- Emergency alert -> notify all supervisors & admins
-- ----------------------------------------------------------------------------
create or replace function public.notify_supervisors_on_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select
    p.id,
    'emergency',
    'SOS Emergency Alert',
    coalesce((select full_name from public.agents where id = new.agent_id), 'An agent')
      || ' triggered an emergency alert.',
    '/emergency/' || new.id
  from public.profiles p
  where p.role in ('admin', 'supervisor') and p.is_active;
  return new;
end;
$$;

create trigger trg_alert_notify
  after insert on public.emergency_alerts
  for each row execute function public.notify_supervisors_on_alert();

-- ----------------------------------------------------------------------------
-- Monthly expense summary (per agent)
-- ----------------------------------------------------------------------------
create or replace function public.monthly_expense_summary(p_month date default date_trunc('month', current_date)::date)
returns table (
  agent_id uuid,
  agent_name text,
  category expense_category,
  total numeric,
  entries bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.agent_id,
    a.full_name,
    e.category,
    sum(e.amount) as total,
    count(*) as entries
  from public.expenses e
  left join public.agents a on a.id = e.agent_id
  where date_trunc('month', e.expense_date) = date_trunc('month', p_month)
  group by e.agent_id, a.full_name, e.category
  order by a.full_name, e.category;
$$;
