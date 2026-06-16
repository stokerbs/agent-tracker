-- ============================================================================
-- Migration 0018 — Customer-first onboarding: new signups default to 'client'
--
-- Prior migrations (0005, 0011) hardcoded 'agent' as the default role for
-- all new registrations. This was appropriate for an internal-only tool, but
-- the product now supports self-registration by clients via OTP/SMS.
--
-- Changes:
--   1. handle_new_user() trigger: default role -> 'client'
--   2. profiles.role column default -> 'client'
--
-- Role promotion path:
--   client -> agent | supervisor | admin: admin-only via /users page
--   (enforced by server action requireRole(['admin']) + profiles RLS admin all)
-- ============================================================================

-- ─── 1. Update handle_new_user trigger ──────────────────────────────────────

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
  return new;
end;
$$;

-- ─── 2. Update column default ────────────────────────────────────────────────

alter table public.profiles
  alter column role set default 'client';
