-- ============================================================================
-- Detective Pulse Operations Command Center
-- Migration 0001 — Core schema, enums, tables, indexes
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid(), encryption
create extension if not exists "pg_trgm";     -- fuzzy text search

-- ----------------------------------------------------------------------------
-- Enumerated types
-- ----------------------------------------------------------------------------
create type user_role        as enum ('admin', 'supervisor', 'agent', 'client');
create type agent_status     as enum ('available', 'on_mission', 'traveling', 'break', 'offline');
create type case_status      as enum ('new', 'assigned', 'active', 'pending', 'closed');
create type case_priority    as enum ('low', 'medium', 'high', 'critical');
create type evidence_type    as enum ('photo', 'video', 'pdf', 'document', 'audio');
create type expense_category as enum ('fuel', 'toll', 'parking', 'food', 'hotel', 'misc');
create type alert_status     as enum ('active', 'acknowledged', 'resolved');
create type report_status    as enum ('draft', 'submitted', 'approved', 'rejected');
create type notification_type as enum ('emergency', 'case', 'report', 'assignment', 'system');

-- ----------------------------------------------------------------------------
-- profiles — mirrors auth.users, carries app-level role & metadata
-- (named "profiles" to avoid clashing with auth.users; spec "users" table)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  full_name     text,
  avatar_url    text,
  role          user_role not null default 'agent',
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is 'Application users mirroring auth.users with RBAC role.';

-- ----------------------------------------------------------------------------
-- agents — field operatives (1:1 optional with a profile login)
-- ----------------------------------------------------------------------------
create table public.agents (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid unique references public.profiles (id) on delete set null,
  agent_code     text not null unique,                 -- "Agent ID" e.g. DP-014
  full_name      text not null,
  nickname       text,
  phone          text,
  email          text,
  photo_url      text,
  position       text,                                 -- e.g. Senior Field Agent
  area           text,                                 -- operating zone / district
  status         agent_status not null default 'offline',
  last_active    timestamptz,
  current_lat    double precision,
  current_lng    double precision,
  battery_pct    smallint check (battery_pct between 0 and 100),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index agents_status_idx on public.agents (status);
create index agents_area_idx   on public.agents (area);
create index agents_name_trgm  on public.agents using gin (full_name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- clients — surveillance customers (have portal logins)
-- ----------------------------------------------------------------------------
create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid unique references public.profiles (id) on delete set null,
  name         text not null,
  company      text,
  email        text,
  phone        text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- cases — surveillance assignments
-- Sensitive target fields are stored encrypted (pgp_sym) — see helper views.
-- ----------------------------------------------------------------------------
create table public.cases (
  id               uuid primary key default gen_random_uuid(),
  case_number      text not null unique,                -- e.g. CASE-2026-0042
  client_id        uuid references public.clients (id) on delete set null,
  client_name      text,
  case_type        text,                                -- Infidelity, Insurance, etc.
  target_name      text,
  target_phone     text,
  target_vehicle   text,
  license_plate    text,
  target_address   text,
  start_date       date,
  end_date         date,
  status           case_status not null default 'new',
  priority         case_priority not null default 'medium',
  description      text,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index cases_status_idx   on public.cases (status);
create index cases_priority_idx on public.cases (priority);
create index cases_client_idx   on public.cases (client_id);

-- ----------------------------------------------------------------------------
-- case_agents — many-to-many assignment join
-- ----------------------------------------------------------------------------
create table public.case_agents (
  case_id     uuid not null references public.cases (id) on delete cascade,
  agent_id    uuid not null references public.agents (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (case_id, agent_id)
);
create index case_agents_agent_idx on public.case_agents (agent_id);

-- ----------------------------------------------------------------------------
-- timeline_entries — chronological surveillance log
-- ----------------------------------------------------------------------------
create table public.timeline_entries (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases (id) on delete cascade,
  agent_id     uuid references public.agents (id) on delete set null,
  entry_date   date not null default current_date,
  entry_time   time not null default current_time,
  entry        text not null,                            -- "Target left residence"
  location     text,
  lat          double precision,
  lng          double precision,
  photo_url    text,
  video_url    text,
  created_at   timestamptz not null default now()
);
create index timeline_case_idx on public.timeline_entries (case_id, entry_date, entry_time);

-- ----------------------------------------------------------------------------
-- evidence — files attached to cases
-- ----------------------------------------------------------------------------
create table public.evidence (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.cases (id) on delete cascade,
  type          evidence_type not null default 'photo',
  category      text,
  storage_path  text not null,                           -- path in Supabase Storage
  file_name     text,
  file_size     bigint,
  mime_type     text,
  notes         text,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  uploaded_at   timestamptz not null default now()
);
create index evidence_case_idx on public.evidence (case_id);

-- ----------------------------------------------------------------------------
-- expenses — field reimbursements
-- ----------------------------------------------------------------------------
create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid references public.agents (id) on delete set null,
  case_id       uuid references public.cases (id) on delete set null,
  category      expense_category not null default 'misc',
  amount        numeric(12, 2) not null check (amount >= 0),
  currency      text not null default 'USD',
  expense_date  date not null default current_date,
  receipt_url   text,
  notes         text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index expenses_agent_idx on public.expenses (agent_id);
create index expenses_month_idx on public.expenses (expense_date);

-- ----------------------------------------------------------------------------
-- emergency_alerts — SOS records
-- ----------------------------------------------------------------------------
create table public.emergency_alerts (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid references public.agents (id) on delete set null,
  case_id       uuid references public.cases (id) on delete set null,
  lat           double precision,
  lng           double precision,
  notes         text,
  status        alert_status not null default 'active',
  acknowledged_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz,
  created_at    timestamptz not null default now()
);
create index alerts_status_idx on public.emergency_alerts (status, created_at desc);

-- ----------------------------------------------------------------------------
-- reports — generated / approved surveillance reports
-- ----------------------------------------------------------------------------
create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.cases (id) on delete cascade,
  title           text not null,
  executive_summary text,
  body            text,                                  -- full chronological report
  observations    text,
  conclusion      text,
  status          report_status not null default 'draft',
  pdf_url         text,
  generated_by    uuid references public.profiles (id) on delete set null,
  approved_by     uuid references public.profiles (id) on delete set null,
  approved_at     timestamptz,
  is_client_visible boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index reports_case_idx on public.reports (case_id);

-- ----------------------------------------------------------------------------
-- notifications — in-app alerts per user
-- ----------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type         notification_type not null default 'system',
  title        text not null,
  body         text,
  link         text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

-- ----------------------------------------------------------------------------
-- audit_logs — immutable activity trail
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id           bigserial primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null,                            -- INSERT / UPDATE / DELETE / LOGIN ...
  entity       text not null,                            -- table or domain object
  entity_id    text,
  metadata     jsonb,
  ip_address   inet,
  created_at   timestamptz not null default now()
);
create index audit_entity_idx on public.audit_logs (entity, created_at desc);
create index audit_actor_idx  on public.audit_logs (actor_id, created_at desc);
