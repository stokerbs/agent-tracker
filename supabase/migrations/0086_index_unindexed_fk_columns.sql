-- PERF-1 (Register #16): foreign-key columns without a covering index.
-- Postgres auto-indexes the REFERENCED side (the unique/PK target) but NOT the
-- REFERENCING column, so every unindexed FK forces a sequential scan on (a) joins
-- and filters by that column and (b) ON DELETE / ON UPDATE cascades when the
-- parent row is removed. The biggest fan-out here is deleting a `profiles` row,
-- which probes created_by / deleted_by / updated_by / uploaded_by / *_by columns
-- across ~20 tables — each a seq scan without these indexes.
--
-- Adds a covering btree index for every single-column FK that currently lacks
-- one (audited live against the linked DB). All idempotent (IF NOT EXISTS).
-- Tables are currently small so plain (non-CONCURRENT) CREATE INDEX in a txn is
-- instant; if any of these grows large later, switch that one to CONCURRENTLY
-- (outside a transaction). Naming: idx_<table>_<column>.

BEGIN;

-- agent_payments
CREATE INDEX IF NOT EXISTS idx_agent_payments_created_by ON public.agent_payments (created_by);
-- ai_prompt_versions
CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_prompt_id ON public.ai_prompt_versions (prompt_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_saved_by ON public.ai_prompt_versions (saved_by);
-- case_agents
CREATE INDEX IF NOT EXISTS idx_case_agents_assigned_by ON public.case_agents (assigned_by);
-- case_claims
CREATE INDEX IF NOT EXISTS idx_case_claims_decided_by ON public.case_claims (decided_by);
-- case_message_views
CREATE INDEX IF NOT EXISTS idx_case_message_views_profile_id ON public.case_message_views (profile_id);
-- case_messages
CREATE INDEX IF NOT EXISTS idx_case_messages_sender_id ON public.case_messages (sender_id);
-- cases
CREATE INDEX IF NOT EXISTS idx_cases_board_posted_by ON public.cases (board_posted_by);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON public.cases (created_by);
-- emergency_alerts
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_acknowledged_by ON public.emergency_alerts (acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_agent_id ON public.emergency_alerts (agent_id);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_case_id ON public.emergency_alerts (case_id);
-- evidence
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON public.evidence (uploaded_by);
-- expenses
CREATE INDEX IF NOT EXISTS idx_expenses_case_id ON public.expenses (case_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses (created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_by ON public.expenses (deleted_by);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON public.expenses (paid_by);
-- geofences
CREATE INDEX IF NOT EXISTS idx_geofences_created_by ON public.geofences (created_by);
-- gps_device_access
CREATE INDEX IF NOT EXISTS idx_gps_device_access_granted_by ON public.gps_device_access (granted_by);
-- gps_devices
CREATE INDEX IF NOT EXISTS idx_gps_devices_agent_id ON public.gps_devices (agent_id);
CREATE INDEX IF NOT EXISTS idx_gps_devices_created_by ON public.gps_devices (created_by);
-- gps903_credentials
CREATE INDEX IF NOT EXISTS idx_gps903_credentials_created_by ON public.gps903_credentials (created_by);
-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_case_id ON public.invoices (case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices (created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_by ON public.invoices (deleted_by);
-- target_locations
CREATE INDEX IF NOT EXISTS idx_target_locations_created_by ON public.target_locations (created_by);
-- target_photos
CREATE INDEX IF NOT EXISTS idx_target_photos_uploaded_by ON public.target_photos (uploaded_by);
-- target_relationships
CREATE INDEX IF NOT EXISTS idx_target_relationships_created_by ON public.target_relationships (created_by);
-- target_vehicles
CREATE INDEX IF NOT EXISTS idx_target_vehicles_created_by ON public.target_vehicles (created_by);
-- timeline_entries
CREATE INDEX IF NOT EXISTS idx_timeline_entries_agent_id ON public.timeline_entries (agent_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_deleted_by ON public.timeline_entries (deleted_by);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_updated_by ON public.timeline_entries (updated_by);
-- vehicle_photos
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_uploaded_by ON public.vehicle_photos (uploaded_by);

COMMIT;
