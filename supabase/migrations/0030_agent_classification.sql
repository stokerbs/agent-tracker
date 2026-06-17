-- =============================================================
-- 0030_agent_classification.sql
--
-- Refactor the agent classification model:
--   1. AgentStatus: replace old operational states with clear
--      real-time states (online/moving/idle/offline/emergency)
--   2. AgentRole: new column for organisational hierarchy
--      (field_agent / supervisor / team_leader / operations)
--   3. VehicleType: restrict to transport-only values
--      (car / motorcycle / foot — remove supervisor / emergency)
--
-- Data is migrated safely before constraints are updated.
-- =============================================================

-- ── 1. Convert agents.status from enum to text ─────────────

-- PostgreSQL does not allow removing values from an enum type, so
-- we cast the column to text first, then add a new CHECK constraint.

ALTER TABLE public.agents
  ALTER COLUMN status TYPE text USING status::text;

-- ── 2. Migrate existing status values ──────────────────────

UPDATE public.agents
SET status = CASE status
  WHEN 'available'  THEN 'online'
  WHEN 'on_mission' THEN 'online'
  WHEN 'traveling'  THEN 'moving'
  WHEN 'break'      THEN 'idle'
  -- 'offline' stays 'offline'
  ELSE                   'offline'
END;

-- ── 3. Apply new status constraint ─────────────────────────

ALTER TABLE public.agents
  ALTER COLUMN status SET DEFAULT 'offline',
  ADD CONSTRAINT agents_check_status
  CHECK (status IN ('online', 'moving', 'idle', 'offline', 'emergency'));

-- ── 4. Drop the now-redundant enum type ────────────────────

DROP TYPE IF EXISTS public.agent_status;

-- ── 5. Add agent_role column ────────────────────────────────

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS agent_role text
    CONSTRAINT agents_check_role
    CHECK (agent_role IN ('field_agent', 'supervisor', 'team_leader', 'operations'));

-- ── 6. Migrate vehicle_type data ───────────────────────────

-- Agents previously marked 'supervisor' in vehicle_type are promoted
-- to agent_role = 'supervisor'; the transport field is cleared.
UPDATE public.agents
SET agent_role   = 'supervisor',
    vehicle_type = NULL
WHERE vehicle_type = 'supervisor';

-- 'emergency' was never a transport method; clear it.
-- If such agents should have a role, operators can set it manually.
UPDATE public.agents
SET vehicle_type = NULL
WHERE vehicle_type = 'emergency';

-- ── 7. Tighten vehicle_type constraint ─────────────────────

ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_vehicle_type_values;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_vehicle_type_values
  CHECK (vehicle_type IS NULL OR vehicle_type IN ('car', 'motorcycle', 'foot'));

-- ── 8. Recreate the status index ───────────────────────────

DROP INDEX IF EXISTS public.agents_status_idx;
CREATE INDEX agents_status_idx ON public.agents (status);
