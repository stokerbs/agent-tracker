# Triggers — Current State

Migration-derived (0001–0069). Final set after all `DROP TRIGGER` / replacements. Triggers on dropped tables (`reports`, `report_versions`) and dropped notification triggers are listed under "Dropped".

Function definitions are in `functions.md`.

---

## auth.users

| Trigger | Timing/Event | Function | Source |
|---|---|---|---|
| on_auth_user_created | AFTER INSERT | handle_new_user() | 0002 (fn redefined through 0067) |

## updated_at maintenance (BEFORE UPDATE, set timestamp)

| Trigger | Table | Function | Source |
|---|---|---|---|
| trg_profiles_updated | profiles | set_updated_at() | 0002 |
| trg_agents_updated | agents | set_updated_at() | 0002 |
| trg_clients_updated | clients | set_updated_at() | 0002 |
| trg_cases_updated | cases | set_updated_at() | 0002 |
| trg_invoices_updated | invoices | set_updated_at() | 0015 |
| gps_devices_updated_at | gps_devices | set_gps_devices_updated_at() | 0022 |
| ai_prompts_updated_at | ai_prompts | touch_updated_at() | 0033 |
| gps903_credentials_updated_at | gps903_credentials | set_gps903_credentials_updated_at() | 0041 |
| trg_agent_payments_updated | agent_payments | set_updated_at() | 0055 |
| trg_target_vehicles_updated | target_vehicles | set_updated_at() | 0057 |
| trg_target_locations_updated | target_locations | set_updated_at() | 0057 |
| trg_target_relationships_updated | target_relationships | set_updated_at() | 0065 |

(NOTE: `trg_reports_updated` from 0002 was removed implicitly when `reports` was dropped in 0051.)

## Audit logging (AFTER, write to audit_logs)

| Trigger | Table | Event | Function | Source |
|---|---|---|---|---|
| trg_audit_cases | cases | INSERT/UPDATE/DELETE | log_audit() | 0002 |
| trg_audit_agents | agents | INSERT/UPDATE/DELETE | log_audit() | 0002 |
| trg_audit_alerts | emergency_alerts | INSERT/UPDATE | log_audit() | 0002 |
| trg_audit_expenses | expenses | INSERT/UPDATE/DELETE | log_audit() | 0009 |
| trg_audit_profiles | profiles | INSERT/UPDATE/DELETE | log_audit() | 0011 |

(`trg_audit_reports` from 0002 removed when `reports` dropped in 0051. `trg_audit_alerts` covers INSERT/UPDATE only — not DELETE.)

## Notifications

| Trigger | Table | Event | Function | Source |
|---|---|---|---|---|
| trg_alert_notify | emergency_alerts | AFTER INSERT | notify_supervisors_on_alert() | 0002 |

This is the only DB-level notification trigger that remains; assignment/report-status notification triggers were moved to the application layer (dropped in 0019).

## Data integrity / sync

| Trigger | Table | Timing/Event | Function | Source |
|---|---|---|---|---|
| trg_sync_client_name | clients | AFTER UPDATE OF name | sync_client_name_on_update() | 0023 |
| trg_link_client_profile_on_insert | clients | AFTER INSERT | link_client_profile_on_insert() | 0025 |
| trg_invoice_case_client | invoices | BEFORE INSERT OR UPDATE | check_invoice_case_client() | 0026 |

---

## Dropped triggers (excluded from current state)

- `trg_assignment_notify` on case_agents — created 0016, DROPPED 0019.
- `trg_report_status_notify` on reports — created 0016, DROPPED 0019.
- `trg_reports_updated` / `trg_audit_reports` on reports — gone when `reports` table dropped (0051 CASCADE).
