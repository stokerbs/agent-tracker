# Foreign-Key Relationships — Current State

Migration-derived (0001–0069). Format: `child.column → parent.column` with ON DELETE behavior. No FK in this schema declares a non-default ON UPDATE, so ON UPDATE is NO ACTION everywhere (omitted below). FKs on dropped tables (`reports`, `report_versions` — dropped in 0051) are excluded.

## Identity

| Child column | → Parent | ON DELETE | Source |
|---|---|---|---|
| profiles.id | auth.users(id) | CASCADE | 0001 |
| agents.profile_id (UNIQUE → 1:1) | profiles(id) | SET NULL | 0001 |
| clients.profile_id (UNIQUE → 1:1) | profiles(id) | SET NULL | 0001 |

## Cases & assignment

| Child column | → Parent | ON DELETE | Source |
|---|---|---|---|
| cases.client_id | clients(id) | SET NULL | 0001 |
| cases.created_by | profiles(id) | SET NULL | 0001 |
| case_agents.case_id | cases(id) | CASCADE | 0001 |
| case_agents.agent_id | agents(id) | CASCADE | 0001 |
| case_agents.assigned_by | profiles(id) | SET NULL | 0001 |
| timeline_entries.case_id | cases(id) | CASCADE | 0001 |
| timeline_entries.agent_id | agents(id) | SET NULL | 0001 |
| timeline_entries.deleted_by | profiles(id) | SET NULL | 0034 |
| timeline_entries.updated_by | profiles(id) | SET NULL | 0034 |
| evidence.case_id | cases(id) | CASCADE | 0001 |
| evidence.uploaded_by | profiles(id) | SET NULL | 0001 |
| evidence.timeline_entry_id | timeline_entries(id) | SET NULL | 0049 |

`case_agents` is the **many-to-many join** between `cases` and `agents` (composite PK `case_id, agent_id`).

## Target intelligence

| Child column | → Parent | ON DELETE | Source |
|---|---|---|---|
| target_photos.case_id | cases(id) | CASCADE | 0057 |
| target_photos.uploaded_by | profiles(id) | SET NULL | 0057 |
| target_vehicles.case_id | cases(id) | CASCADE | 0057 |
| target_vehicles.created_by | profiles(id) | SET NULL | 0057 |
| vehicle_photos.vehicle_id | target_vehicles(id) | CASCADE | 0059 |
| vehicle_photos.case_id | cases(id) | CASCADE | 0059 |
| vehicle_photos.uploaded_by | profiles(id) | SET NULL | 0059 |
| target_locations.case_id | cases(id) | CASCADE | 0057 |
| target_locations.created_by | profiles(id) | SET NULL | 0057 |
| target_relationships.case_id | cases(id) | CASCADE | 0065 |
| target_relationships.created_by | profiles(id) | SET NULL | 0065 |

## Communications & alerts

| Child column | → Parent | ON DELETE | Source |
|---|---|---|---|
| case_messages.case_id | cases(id) | CASCADE | 0058 |
| case_messages.sender_id | profiles(id) | (default NO ACTION) | 0058 |
| case_message_views.case_id | cases(id) | CASCADE | 0058 |
| case_message_views.profile_id | profiles(id) | CASCADE | 0058 |
| emergency_alerts.agent_id | agents(id) | SET NULL | 0001 |
| emergency_alerts.case_id | cases(id) | SET NULL | 0001 |
| emergency_alerts.acknowledged_by | profiles(id) | SET NULL | 0001 |
| notifications.user_id | profiles(id) | CASCADE | 0001 |

`case_message_views` is a **per-user-per-case join** (composite PK `case_id, profile_id`).

## Finance

| Child column | → Parent | ON DELETE | Source |
|---|---|---|---|
| expenses.agent_id | agents(id) | SET NULL | 0001 |
| expenses.case_id | cases(id) | SET NULL | 0001 |
| expenses.created_by | profiles(id) | SET NULL | 0001 |
| expenses.paid_by | profiles(id) | SET NULL | 0054 |
| expenses.deleted_by | profiles(id) | SET NULL | 0054 |
| invoices.client_id | clients(id) | CASCADE | 0015 |
| invoices.case_id | cases(id) | SET NULL | 0015 |
| invoices.created_by | profiles(id) | SET NULL | created 0015 (→ auth.users), re-pointed to profiles in 0026 |
| invoices.deleted_by | profiles(id) | SET NULL | 0027 |
| agent_payments.agent_id | agents(id) | SET NULL | 0055 |
| agent_payments.case_id | cases(id) | SET NULL | 0055 |
| agent_payments.paid_by | profiles(id) | SET NULL | 0055 |
| agent_payments.created_by | profiles(id) | SET NULL | 0055 |

NOTE: `invoices.created_by` originally referenced `auth.users(id)` (0015); the constraint was dropped and re-created to reference `profiles(id)` ON DELETE SET NULL in 0026.

## Live map / geofencing

| Child column | → Parent | ON DELETE | Source |
|---|---|---|---|
| agent_location_history.agent_id | agents(id) | CASCADE | 0028 |
| geofences.created_by | profiles(id) | SET NULL | 0028 |
| geofence_events.geofence_id | geofences(id) | CASCADE | 0028 |
| geofence_events.agent_id | agents(id) | CASCADE | 0028 |

## GPS tracking

| Child column | → Parent | ON DELETE | Source |
|---|---|---|---|
| gps_devices.case_id | cases(id) | CASCADE | 0022 |
| gps_devices.created_by | profiles(id) | (default NO ACTION) | 0022 |
| gps_devices.agent_id | agents(id) | SET NULL | 0035 |
| gps_devices.credential_id | gps903_credentials(id) | RESTRICT | 0046 |
| gps_device_positions.gps_device_id | gps_devices(id) | CASCADE | 0039/0040 |
| gps_device_access.gps_device_id | gps_devices(id) | CASCADE | 0039/0040 |
| gps_device_access.profile_id | profiles(id) | CASCADE | 0039/0040 |
| gps_device_access.granted_by | profiles(id) | (default NO ACTION) | 0039/0040 |
| gps903_credentials.created_by | profiles(id) | SET NULL | 0041 |
| gps903_credential_sessions.credential_id | gps903_credentials(id) | CASCADE | 0041 |

`gps_device_access` is a **many-to-many join** between `gps_devices` and `profiles` (UNIQUE `gps_device_id, profile_id`).

NOTE: `gps903_devices` has NO FK linking it to `gps_devices`/`gps903_credentials`; it is a standalone discovery-sync catalog matched by `gps903_device_id`/`imei` in application code. `gps903_session` has no FKs.

## Native app tokens

| Child column | → Parent | ON DELETE | Source |
|---|---|---|---|
| device_tokens.profile_id | profiles(id) | CASCADE | 0068 |
| gps_tokens.profile_id | profiles(id) | CASCADE | 0069 |

## AI / prompts

| Child column | → Parent | ON DELETE | Source |
|---|---|---|---|
| ai_prompt_versions.prompt_id | ai_prompts(id) | CASCADE | 0033 |
| ai_prompt_versions.saved_by | profiles(id) | SET NULL | 0033 |

## Audit

| Child column | → Parent | ON DELETE | Source |
|---|---|---|---|
| audit_logs.actor_id | profiles(id) | SET NULL | 0001 |

## One-to-many / one-to-one summary

- **1:1** (UNIQUE FK): agents.profile_id ↔ profiles, clients.profile_id ↔ profiles.
- **Many-to-many join tables**: `case_agents` (cases↔agents), `gps_device_access` (gps_devices↔profiles), `case_message_views` (cases↔profiles, per-user view state).
- Everything else is standard one-to-many (parent → many children).
