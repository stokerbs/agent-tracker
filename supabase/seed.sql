-- ============================================================================
-- Seed data for local development / demos.
-- NOTE: profiles are normally created by the auth trigger. For a pure SQL demo
-- you can insert auth.users via the Supabase dashboard, then run this to attach
-- agents, cases and timeline data. The UUIDs below are placeholders — replace
-- them with real auth user ids, or use the in-app "Seed demo data" admin action.
-- ============================================================================

-- Demo clients --------------------------------------------------------------
insert into public.clients (id, name, company, email, phone) values
  ('11111111-1111-1111-1111-111111111111', 'Eleanor Vance', 'Vance Holdings', 'eleanor@example.com', '+1-202-555-0181'),
  ('22222222-2222-2222-2222-222222222222', 'Marcus Reid',   'Reid Logistics', 'marcus@example.com',  '+1-202-555-0142')
on conflict (id) do nothing;

-- Demo agents (no login required) -------------------------------------------
insert into public.agents (id, agent_code, full_name, nickname, phone, email, position, area, status, last_active, current_lat, current_lng, battery_pct) values
  ('a1111111-1111-1111-1111-111111111111', 'DP-001', 'James Holloway', 'Falcon', '+1-202-555-0101', 'falcon@dp.local', 'Senior Field Agent', 'Downtown',   'on_mission', now(),                  40.7128, -74.0060, 82),
  ('a2222222-2222-2222-2222-222222222222', 'DP-002', 'Sofia Martinez', 'Hawk',   '+1-202-555-0102', 'hawk@dp.local',   'Field Agent',        'Midtown',    'available',  now() - interval '4 min', 40.7549, -73.9840, 67),
  ('a3333333-3333-3333-3333-333333333333', 'DP-003', 'Liam Chen',      'Owl',    '+1-202-555-0103', 'owl@dp.local',    'Surveillance Tech',  'Brooklyn',   'traveling',  now() - interval '1 min', 40.6782, -73.9442, 45),
  ('a4444444-4444-4444-4444-444444444444', 'DP-004', 'Nadia Petrov',   'Lynx',   '+1-202-555-0104', 'lynx@dp.local',   'Field Agent',        'Queens',     'break',      now() - interval '20 min', 40.7282, -73.7949, 30),
  ('a5555555-5555-5555-5555-555555555555', 'DP-005', 'Omar Said',      'Cobra',  '+1-202-555-0105', 'cobra@dp.local',  'Junior Agent',       'Downtown',   'offline',    now() - interval '3 hour', 40.7060, -74.0090, 12)
on conflict (id) do nothing;

-- Demo cases ----------------------------------------------------------------
-- PII fields are encrypted; seed data has null *_enc values (local dev only).
insert into public.cases (id, case_number, client_id, client_name, case_type, start_date, end_date, status, priority, description) values
  ('c1111111-1111-1111-1111-111111111111', 'CASE-2026-0001', '11111111-1111-1111-1111-111111111111', 'Eleanor Vance', 'Infidelity', '2026-06-01', null,         'active',  'high',     'Surveillance of subject during weekday evenings.'),
  ('c2222222-2222-2222-2222-222222222222', 'CASE-2026-0002', '22222222-2222-2222-2222-222222222222', 'Marcus Reid',   'Insurance',  '2026-05-20', null,         'assigned','critical', 'Suspected fraudulent disability claim — document physical activity.'),
  ('c3333333-3333-3333-3333-333333333333', 'CASE-2026-0003', null,                                   'Walk-in',       'Background', '2026-06-10', '2026-06-12', 'closed',  'low',      'Pre-employment background verification.')
on conflict (id) do nothing;

-- Assignments ---------------------------------------------------------------
insert into public.case_agents (case_id, agent_id) values
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111'),
  ('c1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222'),
  ('c2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333')
on conflict do nothing;

-- Timeline ------------------------------------------------------------------
insert into public.timeline_entries (case_id, agent_id, entry_date, entry_time, entry, location, lat, lng) values
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-06-14', '08:15', 'Target left residence on foot heading north.', '88 Riverside Dr', 40.7990, -73.9700),
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-06-14', '08:40', 'Target arrived at Westfield shopping mall, entered main entrance.', 'Westfield Mall', 40.7115, -74.0110),
  ('c1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', '2026-06-14', '09:05', 'Target entered Brew & Co coffee shop, met unidentified female.', 'Brew & Co', 40.7120, -74.0090)
on conflict do nothing;

-- Expenses ------------------------------------------------------------------
insert into public.expenses (agent_id, case_id, category, amount, expense_date, notes) values
  ('a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'fuel',    48.20, '2026-06-14', 'Full tank — surveillance route'),
  ('a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'parking', 12.00, '2026-06-14', 'Mall parking garage'),
  ('a2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'food',    18.75, '2026-06-14', 'Lunch during stakeout')
on conflict do nothing;
