# Indexes — Current State

Migration-derived (0001–0069). Lists secondary indexes (beyond primary keys and the implicit unique indexes auto-created for UNIQUE constraints). Partial (`WHERE`) and GIN indexes are noted. Indexes on dropped tables (`reports`, `report_versions`) are excluded. `idx_timeline_entries_case_date_time` (created 0048) was DROPPED in 0050 and is excluded.

Format: index name — table (columns) [uniqueness / partial].

---

## agents (0001; 0030)
- agents_status_idx — agents (status) — recreated in 0030 after status column re-typed (dropped/recreated)
- agents_area_idx — agents (area)
- agents_name_trgm — agents (full_name) — **GIN** `gin_trgm_ops` (fuzzy search)

## cases (0001; 0007; 0020)
- cases_status_idx — cases (status)
- cases_priority_idx — cases (priority)
- cases_client_idx — cases (client_id)
- cases_target_name_bidx_idx — cases (target_name_bidx) (0007)
- cases_target_phone_bidx_idx — cases (target_phone_bidx) (0007)
- cases_license_plate_bidx_idx — cases (license_plate_bidx) (0007)
- cases_archived_idx — cases (archived_at) (0020)

## case_agents (0001; 0048)
- case_agents_agent_idx — case_agents (agent_id) (0001)
- idx_case_agents_agent_id — case_agents (agent_id) (0048) — NOTE: duplicate of case_agents_agent_idx (both exist; never dropped)

## timeline_entries (0001; 0034; 0048; 0050)
- timeline_case_idx — timeline_entries (case_id, entry_date, entry_time) (0001)
- timeline_entries_active_idx — timeline_entries (case_id, entry_date, entry_time) **partial** `WHERE deleted_at IS NULL` (0034)
- idx_timeline_entries_date — timeline_entries (entry_date ASC) **partial** `WHERE deleted_at IS NULL` (0048)
- (idx_timeline_entries_case_date_time created in 0048 was DROPPED in 0050 — excluded)

## evidence (0001; 0049)
- evidence_case_idx — evidence (case_id)
- idx_evidence_timeline_entry_id — evidence (timeline_entry_id) **partial** `WHERE timeline_entry_id IS NOT NULL` (0049)

## expenses (0001; 0054)
- expenses_agent_idx — expenses (agent_id)
- expenses_month_idx — expenses (expense_date)
- expenses_status_idx — expenses (status) **partial** `WHERE deleted_at IS NULL` (0054)
- expenses_deleted_at — expenses (deleted_at) **partial** `WHERE deleted_at IS NOT NULL` (0054)

## emergency_alerts (0001; 0011)
- alerts_status_idx — emergency_alerts (status, created_at DESC)
- alerts_active_idx — emergency_alerts (created_at DESC) **partial** `WHERE status = 'active'` (0011)

## notifications (0001)
- notifications_user_idx — notifications (user_id, is_read, created_at DESC)

## audit_logs (0001)
- audit_entity_idx — audit_logs (entity, created_at DESC)
- audit_actor_idx — audit_logs (actor_id, created_at DESC)

## invoices (0015; 0027)
- invoices_client_idx — invoices (client_id)
- invoices_status_idx — invoices (status)
- invoices_active_idx — invoices (client_id) **partial** `WHERE deleted_at IS NULL` (0027)

## agent_payments (0055)
- agent_payments_agent_idx — agent_payments (agent_id)
- agent_payments_case_idx — agent_payments (case_id)
- agent_payments_date_idx — agent_payments (work_date DESC)
- agent_payments_status_idx — agent_payments (status)
- agent_payments_paid_by — agent_payments (paid_by) **partial** `WHERE paid_by IS NOT NULL`

## agent_location_history (0028; 0029)
- idx_loc_hist_agent_time — agent_location_history (agent_id, recorded_at DESC) (0028)
- idx_agent_loc_hist_recorded_at — agent_location_history (recorded_at DESC) (0029)

## geofence_events (0028)
- idx_geo_events_fence_time — geofence_events (geofence_id, occurred_at DESC)
- idx_geo_events_agent_time — geofence_events (agent_id, occurred_at DESC)

## gps_devices (0022; 0035; 0036; 0046)
- gps_devices_case_id_idx — gps_devices (case_id) (0022)
- gps_devices_active_idx — gps_devices (case_id) **partial** `WHERE deleted_at IS NULL` (0022)
- gps_devices_imei_idx — gps_devices (imei) **partial** `WHERE imei IS NOT NULL AND deleted_at IS NULL` (0035)
- gps_devices_gps903_id_idx — gps_devices (gps903_device_id) **partial** `WHERE gps903_device_id IS NOT NULL AND deleted_at IS NULL` (0036)
- gps_devices_credential_id_idx — gps_devices (credential_id) (0046)

## gps_device_positions (0039/0040)
- gps_device_positions_device_time_idx — gps_device_positions (gps_device_id, recorded_at DESC)
- gps_device_positions_recorded_idx — gps_device_positions (recorded_at DESC)

## gps_device_access (0039/0040)
- gps_device_access_device_idx — gps_device_access (gps_device_id)
- gps_device_access_profile_idx — gps_device_access (profile_id)
- (UNIQUE `gps_device_access_unique` on (gps_device_id, profile_id) — constraint-backed)

## gps903_devices (0038/0040)
- gps903_devices_imei_idx — gps903_devices (imei) **partial** `WHERE imei IS NOT NULL`
- (UNIQUE `gps903_devices_gps903_id_key` on (gps903_device_id) — constraint-backed)

## target_photos (0057)
- target_photos_case_idx — target_photos (case_id)

## target_vehicles (0057)
- target_vehicles_case_idx — target_vehicles (case_id)
- target_vehicles_plate_idx — target_vehicles (license_plate_bidx) **partial** `WHERE license_plate_bidx IS NOT NULL`

## vehicle_photos (0059)
- idx_vehicle_photos_vehicle — vehicle_photos (vehicle_id, created_at)
- idx_vehicle_photos_case — vehicle_photos (case_id)

## target_locations (0057)
- target_locations_case_idx — target_locations (case_id)

## target_relationships (0065)
- target_relationships_case_idx — target_relationships (case_id)

## case_messages (0058)
- idx_case_messages_case — case_messages (case_id, created_at ASC)

## device_tokens (0068)
- device_tokens_profile_idx — device_tokens (profile_id)
- (UNIQUE on token — constraint-backed)

## gps_tokens (0069)
- gps_tokens_profile_idx — gps_tokens (profile_id)
- (UNIQUE on token — constraint-backed)

---

## FK columns without a covering index (performance smell)

Observation only — these are foreign-key columns that have NO index leading with that column. Without one, reverse lookups (find children of a parent) and parent deletes / SET NULL cascades scan the child table. This is a known smell, not a recommended migration; we are not changing the DB. (FK columns covered by an existing index, or by a composite PK/UNIQUE whose FIRST column is the FK, are excluded.)

The CA specifically named `case_messages.sender_id` (→ profiles, 0058) and `cases.created_by` (→ profiles, 0001). Scanning the full documented FK set, the complete list of uncovered FK columns is:

- cases.created_by (→ profiles, 0001)
- timeline_entries.agent_id (→ agents, 0001); timeline_entries.deleted_by, timeline_entries.updated_by (→ profiles, 0034)
- evidence.uploaded_by (→ profiles, 0001)
- target_photos.uploaded_by, target_vehicles.created_by, target_locations.created_by (→ profiles, 0057); target_relationships.created_by (→ profiles, 0065); vehicle_photos.uploaded_by (→ profiles, 0059)
- case_messages.sender_id (→ profiles, 0058)
- case_message_views.profile_id (→ profiles, 0058) — only the 2nd PK column, so not covered for FK lookups
- emergency_alerts.agent_id, emergency_alerts.case_id, emergency_alerts.acknowledged_by (→ agents/cases/profiles, 0001)
- expenses.case_id, expenses.created_by, expenses.paid_by, expenses.deleted_by (0001/0054)
- invoices.case_id, invoices.created_by, invoices.deleted_by (0015/0026/0027)
- agent_payments.created_by (→ profiles, 0055)
- geofences.created_by (→ profiles, 0028)
- gps_devices.created_by (→ profiles, 0022)
- gps_device_access.granted_by (→ profiles, 0039/0040)
- gps903_credentials.created_by (→ profiles, 0041)
- ai_prompt_versions.prompt_id (→ ai_prompts, 0033), ai_prompt_versions.saved_by (→ profiles, 0033)

Most are low-traffic `*_by` audit columns where the smell is mild. The higher-traffic ones (case-scoped FKs and `case_messages.sender_id`) are the ones worth attention if reverse lookups by those columns ever appear in queries.

## Notes / observations
- **Duplicate index on case_agents.agent_id**: `case_agents_agent_idx` (0001) and `idx_case_agents_agent_id` (0048) both index the same column; neither was dropped, so both currently exist.
- UNIQUE-constraint-backed indexes (e.g., on profiles.email, agents.agent_code, cases.case_number, invoices.invoice_number, device_tokens.token, gps_tokens.token, gps903_credentials.imei/gps903_device_id) are implicit and not separately listed except where called out above.
