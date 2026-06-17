-- ============================================================================
-- Migration 0024 — Client portal auto-link on registration
--
-- Problem: when a client self-registers via OTP/email, handle_new_user()
-- creates a profiles row (role='client') but never links it to an existing
-- clients record. The portal query eq("profile_id", profile.id) returns null
-- and shows "Account Not Connected".
--
-- Fix: after creating the profile, check whether clients.email matches the
-- new auth user's email. If so, set clients.profile_id automatically.
-- This covers the common flow: admin creates the client record first, then
-- the client registers with the same email.
--
-- The reverse flow (client registers first, admin creates record later) is
-- handled in application layer via linkClientProfile() server action.
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
    'client',   -- All self-registrations start as client. Admins promote after.
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  -- Auto-link to a matching client record when the email addresses agree.
  -- Guards: new.email must be non-null; client record must not already be linked.
  if new.email is not null then
    update public.clients
    set    profile_id = new.id
    where  lower(email) = lower(new.email)
      and  profile_id is null;
  end if;

  return new;
end;
$$;
