-- ============================================================================
-- Migration 0005 — Harden registration: always assign role = 'agent'
--
-- Closes C-1: the previous handle_new_user trigger trusted raw_user_meta_data
-- ->> 'role', allowing any self-registering user to claim admin or supervisor
-- by manipulating the sign-up payload. Role promotion is now exclusively
-- performed by administrators via the /users management page.
-- ============================================================================

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
    'agent',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
