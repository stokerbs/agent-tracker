# Enum Types — Current State

Migration-derived (0001–0069). Values reflect all `ALTER TYPE ... ADD VALUE`. Postgres cannot remove enum values, so additions are permanent unless the whole type is dropped.

All in schema `public`.

| Enum | Values (in order) | Source | Notes |
|---|---|---|---|
| user_role | `admin`, `supervisor`, `agent`, `client` | 0001 | profiles.role |
| case_status | `new`, `assigned`, `active`, `pending`, `closed`, `cancelled` | 0001 + `cancelled` (0020) | cases.status |
| case_priority | `low`, `medium`, `high`, `critical` | 0001 | cases.priority |
| evidence_type | `photo`, `video`, `pdf`, `document`, `audio` | 0001 | evidence.type |
| expense_category | `fuel`, `toll`, `parking`, `food`, `hotel`, `misc`, `meals`, `accommodation`, `transportation`, `office` | 0001 + 4 added (0052) | expenses.category. Legacy `food`→`meals` and `hotel`→`accommodation` data migrated in 0053, but `food`/`hotel` values remain defined in the type. |
| alert_status | `active`, `acknowledged`, `resolved` | 0001 | emergency_alerts.status |
| report_status | `draft`, `submitted`, `approved`, `rejected`, `review` | 0001 + `review` (0021) | ORPHANED — `reports` table dropped in 0051, but the type was never dropped, so it still exists with no column using it. |
| notification_type | `emergency`, `case`, `report`, `assignment`, `system` | 0001 | notifications.type |
| invoice_status | `draft`, `sent`, `paid`, `overdue` | 0015 | invoices.status |
| gps_provider | `AIS`, `TRUE`, `DTAC`, `GPS903` | 0022 + `GPS903` (0035) | gps_devices.provider |
| expense_status | `pending`, `paid`, `reimbursed`, `cancelled` | 0054 | expenses.status |
| payroll_status | `pending`, `paid`, `cancelled`, `adjusted` | 0055 | agent_payments.status |

---

## Dropped enums (excluded from current state)

- **agent_status** (`available`, `on_mission`, `traveling`, `break`, `offline`) — created 0001, DROPPED in 0030. `agents.status` is now a `text` column with a CHECK constraint allowing `('online','moving','idle','offline','emergency')`.

## Enum-like CHECK constraints (NOT enums, for reference)

Several "enum-like" fields are plain text + CHECK rather than enum types:
- `agents.status` → `('online','moving','idle','offline','emergency')` (0030)
- `agents.vehicle_type` → null or `('car','motorcycle','foot')` (0030)
- `agents.agent_role` → null or `('field_agent','supervisor','team_leader','operations')` (0030)
- `geofence_events.event_type` → `('enter','exit')` (0028)
- `expenses.source` → `('manual','ocr')` (0053)
- `gps_devices.last_locate_mode` → `('gps','lbs','offline','unknown')` (0043)
