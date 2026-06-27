-- 0083_user_pins.sql
-- App-lock PIN: a per-user PIN hash for unlocking the app on a device without a
-- fresh OTP (the session is now persistent). Stored in its own table — NOT on
-- profiles — so the hash never rides along in `profiles.select('*')` to the
-- client. RLS is enabled with NO policies, so the table is reachable only via
-- the service role (server actions); even the owner can't read their own hash.

create table public.user_pins (
  profile_id uuid        primary key references public.profiles (id) on delete cascade,
  pin_hash   text        not null,
  updated_at timestamptz not null default now()
);

alter table public.user_pins enable row level security;
-- Intentionally no policies: service-role only.
