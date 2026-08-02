-- Migration 0107 — Apple AirTag manual/CSV location-history tracker
--
-- Brand-new tracker type, fully separate from the GPS903 (`gps_devices` /
-- `gps_device_positions`) polling system. NOTHING polls this data — every
-- row is human-entered (manual form entry or CSV import) by staff working a
-- case. Because these are evidentiary records (chain-of-custody matters),
-- `air_tag_positions` is treated as append-only / immutable: no UPDATE or
-- DELETE policy exists for it except the admin escape hatch.
--
-- Adds:
--   air_tag_trackers  — one row per AirTag assigned to a case (soft-deleted)
--   air_tag_positions — manually/CSV-entered position history per tracker
--
-- Access model (mirrors the current can_access_case()-scoped standard set by
-- 0048/0063/0087/0095/0096/0106 — NOT the older blanket-supervisor pattern
-- from 0022 — since this is new surveillance-adjacent data and the codebase
-- has been deliberately closing blanket-supervisor cross-case exposure):
--   Admin      — ALL on both tables, unconditional.
--   Supervisor — SELECT on both tables, scoped to assigned cases via
--                can_access_case(); UPDATE on air_tag_trackers only (used by
--                the app to soft-delete via deleted_at). No UPDATE/DELETE on
--                air_tag_positions — positions are immutable once entered.
--   Agent      — SELECT + INSERT on both tables, scoped to assigned cases via
--                can_access_case()/case_agents. WITH CHECK enforces
--                created_by = auth.uid() / entered_by = auth.uid() — the
--                client can never assert authorship of someone else's entry.
--   Client     — no policy at all on either table → default deny (RLS with
--                zero matching policies denies by default), matching how
--                gps_devices denies the client role.
--
-- This migration intentionally does NOT touch gps_devices, gps_device_positions,
-- or any cleanup-positions cron/retention job — air_tag_positions are manual
-- evidentiary records, not high-frequency telemetry, and must never be swept
-- by that retention job.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. air_tag_trackers — one row per AirTag assigned to a case
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.air_tag_trackers (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  case_id      uuid        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  label        text        NOT NULL,
  apple_serial text        NULL,
  notes        text        NULL,
  created_by   uuid        REFERENCES public.profiles(id),
  deleted_at   timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT air_tag_trackers_pkey PRIMARY KEY (id),
  CONSTRAINT air_tag_trackers_label_len CHECK (char_length(label) BETWEEN 1 AND 120)
);

COMMENT ON TABLE public.air_tag_trackers IS
  'Apple AirTag trackers assigned to a case. Manual/CSV-entry only — no polling cron writes here.';

CREATE INDEX IF NOT EXISTS air_tag_trackers_case_id_idx
  ON public.air_tag_trackers (case_id);

CREATE INDEX IF NOT EXISTS air_tag_trackers_active_idx
  ON public.air_tag_trackers (case_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_air_tag_trackers_created_by
  ON public.air_tag_trackers (created_by);

-- ── updated_at trigger ───────────────────────────────────────────────────────
-- Reuses the canonical public.set_updated_at() (0002) rather than defining a
-- new one-off function — 0075 deliberately consolidated duplicate updated_at
-- trigger functions onto this one; a new table should not reintroduce one.

DROP TRIGGER IF EXISTS air_tag_trackers_updated_at ON public.air_tag_trackers;
CREATE TRIGGER air_tag_trackers_updated_at
  BEFORE UPDATE ON public.air_tag_trackers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Audit trigger ─────────────────────────────────────────────────────────────
-- Sensitive case-linked data (see schema.md "audit logging for sensitive
-- actions"); reuses the generic public.log_audit() trigger (0002/0009/0011).

DROP TRIGGER IF EXISTS trg_audit_air_tag_trackers ON public.air_tag_trackers;
CREATE TRIGGER trg_audit_air_tag_trackers
  AFTER INSERT OR UPDATE OR DELETE ON public.air_tag_trackers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. air_tag_positions — manual/CSV-entered position history per tracker
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.air_tag_positions (
  id          uuid          NOT NULL DEFAULT gen_random_uuid(),
  air_tag_id  uuid          NOT NULL REFERENCES public.air_tag_trackers(id) ON DELETE CASCADE,
  lat         numeric(10,6) NOT NULL,
  lng         numeric(10,6) NOT NULL,
  recorded_at timestamptz   NOT NULL,
  accuracy_m  integer       NULL,
  source      text          NOT NULL DEFAULT 'manual',
  note        text          NULL,
  entered_by  uuid          NOT NULL REFERENCES public.profiles(id),
  created_at  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT air_tag_positions_pkey PRIMARY KEY (id),
  CONSTRAINT air_tag_positions_lat_range CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT air_tag_positions_lng_range CHECK (lng BETWEEN -180 AND 180),
  CONSTRAINT air_tag_positions_accuracy_positive CHECK (accuracy_m IS NULL OR accuracy_m > 0),
  CONSTRAINT air_tag_positions_source_check CHECK (source IN ('manual', 'csv_import')),
  CONSTRAINT air_tag_positions_note_len CHECK (note IS NULL OR char_length(note) <= 500),
  -- Dedupe CSV re-imports: same tracker + timestamp + coordinates = same fix.
  CONSTRAINT air_tag_positions_dedupe_unique UNIQUE (air_tag_id, recorded_at, lat, lng)
);

COMMENT ON TABLE public.air_tag_positions IS
  'Manually/CSV-entered AirTag position history. Immutable once entered — no UPDATE/DELETE policy for non-admins (evidentiary integrity). Not polled, not part of the gps_device_positions retention/cleanup job.';

CREATE INDEX IF NOT EXISTS air_tag_positions_tag_time_idx
  ON public.air_tag_positions (air_tag_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_air_tag_positions_entered_by
  ON public.air_tag_positions (entered_by);

-- ── Audit trigger ─────────────────────────────────────────────────────────────
-- Positions should never be UPDATEd/DELETEd by anyone except admin (RLS below
-- enforces this), but the trigger still logs the full lifecycle including the
-- rare admin-initiated correction/removal.

DROP TRIGGER IF EXISTS trg_audit_air_tag_positions ON public.air_tag_positions;
CREATE TRIGGER trg_audit_air_tag_positions
  AFTER INSERT OR UPDATE OR DELETE ON public.air_tag_positions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RLS — enable
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.air_tag_trackers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.air_tag_positions ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RLS — air_tag_trackers
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "air_tag_trackers_admin_all"        ON public.air_tag_trackers;
DROP POLICY IF EXISTS "air_tag_trackers_supervisor_select" ON public.air_tag_trackers;
DROP POLICY IF EXISTS "air_tag_trackers_supervisor_update" ON public.air_tag_trackers;
DROP POLICY IF EXISTS "air_tag_trackers_agent_select"       ON public.air_tag_trackers;
DROP POLICY IF EXISTS "air_tag_trackers_agent_insert"       ON public.air_tag_trackers;

-- Admin: unrestricted full CRUD
CREATE POLICY "air_tag_trackers_admin_all" ON public.air_tag_trackers
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Supervisor: read trackers on cases they're assigned to (can_access_case()
-- is admin-OR-case_agents-assignment; the current_role() guard means this
-- branch only ever matches an assigned supervisor, never widens agent access)
CREATE POLICY "air_tag_trackers_supervisor_select" ON public.air_tag_trackers
  FOR SELECT
  USING (
    public."current_role"() = 'supervisor'
    AND public.can_access_case(case_id)
  );

-- Supervisor: UPDATE on assigned cases only — used by the app to soft-delete
-- (set deleted_at) a mis-entered tracker. No DELETE policy for supervisors:
-- soft delete only, never a hard delete.
CREATE POLICY "air_tag_trackers_supervisor_update" ON public.air_tag_trackers
  FOR UPDATE
  USING (
    public."current_role"() = 'supervisor'
    AND public.can_access_case(case_id)
  )
  WITH CHECK (
    public."current_role"() = 'supervisor'
    AND public.can_access_case(case_id)
  );

-- Agent: read trackers on assigned, non-deleted cases only
CREATE POLICY "air_tag_trackers_agent_select" ON public.air_tag_trackers
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public."current_role"() = 'agent'
    AND public.can_access_case(case_id)
  );

-- Agent: create trackers on assigned cases only. created_by is never trusted
-- from the client — it must match the inserting user.
CREATE POLICY "air_tag_trackers_agent_insert" ON public.air_tag_trackers
  FOR INSERT
  WITH CHECK (
    public."current_role"() = 'agent'
    AND public.can_access_case(case_id)
    AND created_by = auth.uid()
  );

-- No client policy → default deny (RLS enabled, zero matching policies).
-- No agent UPDATE/DELETE → agents cannot edit or soft-delete trackers.

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RLS — air_tag_positions (immutable: no UPDATE/DELETE for non-admins)
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "air_tag_positions_admin_all"        ON public.air_tag_positions;
DROP POLICY IF EXISTS "air_tag_positions_supervisor_select" ON public.air_tag_positions;
DROP POLICY IF EXISTS "air_tag_positions_agent_select"       ON public.air_tag_positions;
DROP POLICY IF EXISTS "air_tag_positions_agent_insert"       ON public.air_tag_positions;

-- Admin: unrestricted full CRUD (the only role able to correct/delete a
-- mis-entered position)
CREATE POLICY "air_tag_positions_admin_all" ON public.air_tag_positions
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Supervisor: read only, scoped to assigned cases via the parent tracker's
-- case_id. No UPDATE/DELETE policy at all — positions are immutable evidence.
CREATE POLICY "air_tag_positions_supervisor_select" ON public.air_tag_positions
  FOR SELECT
  USING (
    public."current_role"() = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM public.air_tag_trackers t
      WHERE t.id = air_tag_positions.air_tag_id
        AND public.can_access_case(t.case_id)
    )
  );

-- Agent: read positions for non-deleted trackers on assigned cases only
CREATE POLICY "air_tag_positions_agent_select" ON public.air_tag_positions
  FOR SELECT
  USING (
    public."current_role"() = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.air_tag_trackers t
      WHERE t.id = air_tag_positions.air_tag_id
        AND t.deleted_at IS NULL
        AND public.can_access_case(t.case_id)
    )
  );

-- Agent: insert positions for non-deleted trackers on assigned cases only.
-- entered_by is never trusted from the client — it must match the inserting
-- user. No UPDATE/DELETE policy for agents either — once entered, immutable.
CREATE POLICY "air_tag_positions_agent_insert" ON public.air_tag_positions
  FOR INSERT
  WITH CHECK (
    public."current_role"() = 'agent'
    AND entered_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.air_tag_trackers t
      WHERE t.id = air_tag_positions.air_tag_id
        AND t.deleted_at IS NULL
        AND public.can_access_case(t.case_id)
    )
  );

-- No client policy → default deny.
-- No service_role insert policy → nothing polls this table.
-- No UPDATE/DELETE policy for supervisor or agent → immutable once entered.

COMMIT;
