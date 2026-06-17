-- ============================================================================
-- Migration 0025 — Auto-link client record on INSERT by email match (F-6)
--
-- Problem: migration 0024 added auto-link when a profile is CREATED (i.e.,
-- a client registers and a matching clients row already exists). But the
-- reverse flow — an admin creates a clients record AFTER the client has
-- already registered — was not handled. The newly created clients row would
-- have profile_id = NULL even though a matching profile exists.
--
-- Fix: AFTER INSERT trigger on public.clients. When a new row is inserted
-- with a non-null email and no profile_id, attempt to link it to an existing
-- client-role profile whose email matches (case-insensitive), provided that
-- profile is not already linked to a different client record.
-- ============================================================================

create or replace function public.link_client_profile_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  -- Only run when email is supplied and profile_id is not already set.
  if new.email is null or new.profile_id is not null then
    return new;
  end if;

  -- Find a client-role profile with a matching email that is not yet linked
  -- to any other client record.
  select p.id into v_profile_id
  from public.profiles p
  where lower(p.email) = lower(new.email)
    and p.role = 'client'
    and not exists (
      select 1 from public.clients c
      where c.profile_id = p.id
    )
  limit 1;

  if v_profile_id is not null then
    update public.clients
    set    profile_id = v_profile_id
    where  id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_link_client_profile_on_insert on public.clients;

create trigger trg_link_client_profile_on_insert
  after insert on public.clients
  for each row execute function public.link_client_profile_on_insert();
