-- 0067_fix_profile_phone_on_signup.sql
-- Fix: phone-OTP signups create a profiles row with NULL phone / full_name /
-- avatar, showing as "—" / "??" in User Management.
--
-- Root cause: migration 0012 populated profiles.phone from auth.users.phone,
-- but 0018 rewrote handle_new_user() and dropped the phone column from the
-- INSERT; 0024 carried that omission forward. Since the OTP flow passes no
-- full_name/email metadata, phone-only users end up fully blank.
--
-- This migration:
--   1. Restores phone in handle_new_user() and adds a phone fallback for the
--      display name, while preserving 0024's client email auto-link + role=client.
--   2. Backfills existing profiles created under the broken trigger.

-- ─── 1. Trigger ──────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name, role, avatar_url)
  values (
    new.id,
    new.email,   -- NULL for phone-only users (allowed since 0012)
    new.phone,   -- populated for phone OTP users; NULL for email users
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      -- email users: local part of the email as a display fallback
      case when new.email is not null then split_part(new.email, '@', 1) end,
      -- phone-only users with no metadata: fall back to the phone number
      new.phone
    ),
    'client',   -- All self-registrations start as client. Admins promote after.
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  -- Auto-link to a matching client record when the email addresses agree (0024).
  if new.email is not null then
    update public.clients
    set    profile_id = new.id
    where  lower(email) = lower(new.email)
      and  profile_id is null;
  end if;

  return new;
end;
$$;

-- ─── 2. Backfill existing rows created under the broken trigger ───────────────
-- Restore phone wherever auth.users has one but the profile does not.
update public.profiles p
set    phone = u.phone
from   auth.users u
where  p.id = u.id
  and  p.phone is null
  and  u.phone is not null;

-- Give fully-blank, phone-only profiles a display name (their phone number).
update public.profiles p
set    full_name = u.phone
from   auth.users u
where  p.id = u.id
  and  p.full_name is null
  and  u.phone is not null;
