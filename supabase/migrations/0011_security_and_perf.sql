-- ============================================================================
-- Migration 0011 — Security hardening and performance improvements
--
-- Fixes:
--   SEC-1 (CRITICAL) handle_new_user allowed privilege escalation — any signup
--                    payload with {"role": "admin"} in user_metadata was cast
--                    directly to user_role, granting admin access.
--                    Fix: always default new users to 'agent'; role can only be
--                    changed by an admin after the fact.
--
--   SEC-2 (HIGH)     evidence storage INSERT policy "evidence authed write" was
--                    too broad — any authenticated non-client user could upload
--                    to any case's folder via direct Storage API, bypassing the
--                    application-layer case-assignment check.
--                    Fix: staff may insert freely; agents are scoped to their
--                    assigned cases (via folder path case_id).
--
--   DB-1  (MEDIUM)   No audit trigger on profiles — role/active-status changes
--                    by admins were untracked.
--                    Fix: add audit trigger on profiles.
--
--   PERF-1 (LOW)     Added partial index on emergency_alerts for the common
--                    query pattern (active + recent alerts dashboard widget).
--
--   DB-2  (LOW)      Added check constraint on expenses.currency to prevent
--                    arbitrary strings.
-- ============================================================================

-- ─── SEC-1: Remove role from new-user trigger ────────────────────────────────

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
    'agent',   -- Role is ALWAYS 'agent' at signup. Admins promote after the fact.
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─── SEC-2: Tighten evidence storage write policy ────────────────────────────

drop policy if exists "evidence authed write" on storage.objects;
drop policy if exists "evidence staff write"  on storage.objects;
drop policy if exists "evidence agent write"  on storage.objects;

-- Staff (admin/supervisor) may insert anywhere in the evidence bucket.
create policy "evidence staff write"
  on storage.objects for insert
  with check (
    bucket_id = 'evidence'
    and public.is_staff()
  );

-- Agents may only insert into the folder matching a case they are assigned to.
-- Folder convention: evidence/{case_id}/{uuid}.ext → foldername[1] = case_id.
create policy "evidence agent write"
  on storage.objects for insert
  with check (
    bucket_id = 'evidence'
    and public.current_role() = 'agent'
    and exists (
      select 1
      from public.case_agents ca
      join public.agents a on a.id = ca.agent_id
      where ca.case_id::text = (storage.foldername(name))[1]
        and a.profile_id = auth.uid()
    )
  );

-- ─── DB-1: Audit trigger on profiles ─────────────────────────────────────────

drop trigger if exists trg_audit_profiles on public.profiles;

create trigger trg_audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.log_audit();

-- ─── PERF-1: Partial index for active alert queries ──────────────────────────

create index if not exists alerts_active_idx
  on public.emergency_alerts (created_at desc)
  where status = 'active';

-- ─── DB-2: Currency constraint ────────────────────────────────────────────────

do $$ begin
  alter table public.expenses
    add constraint expenses_currency_check
    check (currency ~ '^[A-Z]{3}$');
exception when duplicate_object then null;
end $$;
