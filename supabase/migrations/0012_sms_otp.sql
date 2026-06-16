-- ============================================================================
-- Migration 0012 — SMS OTP authentication support
--
-- Phone-only users arrive via Supabase phone OTP with auth.users.email = NULL.
-- The existing handle_new_user() trigger inserts into profiles.email which has
-- a NOT NULL constraint — this would cause every new phone user's profile
-- creation to fail silently (ON CONFLICT DO NOTHING masks the error).
--
-- Changes:
--   1. Drop NOT NULL on profiles.email (NULLs are fine in UNIQUE columns —
--      Postgres treats each NULL as distinct, so uniqueness is preserved).
--   2. Update handle_new_user() to populate profiles.phone from auth.users.phone
--      and derive full_name without assuming email is present.
-- ============================================================================

-- ─── 1. Allow NULL email on profiles ─────────────────────────────────────────

alter table public.profiles alter column email drop not null;

-- ─── 2. Update trigger to handle phone-only users ────────────────────────────

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
    new.email,   -- NULL for phone-only users; that is now allowed
    new.phone,   -- populated for phone OTP users; NULL for email users
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      -- email users: use local part of email as display name fallback
      case when new.email is not null then split_part(new.email, '@', 1) else null end
    ),
    'agent',     -- role is ALWAYS 'agent' at signup; admins promote after the fact
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
