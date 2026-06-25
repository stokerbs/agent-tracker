# PostgreSQL Functions — Current State

Migration-derived (0001–0069). Reflects the final definition of each function after all `CREATE OR REPLACE` / `DROP`. Functions tied to dropped objects (report notification functions) are listed under "Dropped".

All are in schema `public`.

---

## RBAC / authorization helpers (SECURITY DEFINER)

These power RLS policies. All are `STABLE`, `LANGUAGE sql`, `SECURITY DEFINER`, `SET search_path = public`.

| Function | Signature → Return | What it does | Source |
|---|---|---|---|
| current_role() | `() → user_role` | Returns `profiles.role` for `auth.uid()`. | 0002 |
| is_admin() | `() → boolean` | True if caller's profile role = 'admin'. | 0002 |
| is_staff() | `() → boolean` | True if caller's role in ('admin','supervisor'). | 0002 |
| my_agent_id() | `() → uuid` | Returns `agents.id` linked to `auth.uid()` (or null). | 0002 |
| can_access_case(target_case uuid) | `(uuid) → boolean` | True if caller is admin OR explicitly assigned to the case via case_agents→agents. (Redefined in 0063 to remove the blanket `supervisor` clause from 0002 — now assignment-scoped.) **DEAD-BUT-LIVE: defined but not yet adopted** — per 0063's own comment it has no caller and is wired into no RLS policy or query. Do not assume it gates access anywhere; it is safe to adopt going forward. | 0002 → 0063 |

NOTE: `current_role` shadows the SQL-standard `current_role` keyword but is schema-qualified as `public.current_role()` in policies.

---

## Trigger functions

| Function | Return | Security | What it does | Source |
|---|---|---|---|---|
| set_updated_at() | trigger | INVOKER (plpgsql) | Sets `NEW.updated_at = now()`. Shared updated_at trigger fn. | 0002 |
| touch_updated_at() | trigger | INVOKER (plpgsql) | Same as set_updated_at; created for ai_prompts. | 0033 |
| set_gps_devices_updated_at() | trigger | INVOKER (plpgsql) | Sets `NEW.updated_at = now()` on gps_devices. | 0022 |
| set_gps903_credentials_updated_at() | trigger | INVOKER (plpgsql) | Sets `NEW.updated_at = now()` on gps903_credentials. | 0041 |
| handle_new_user() | trigger | DEFINER, `search_path=public` | AFTER INSERT on auth.users → inserts a `profiles` row (role always `'client'`, never trusts metadata role), populates email/phone/full_name (phone & phone-name fallback restored in 0067), then auto-links a matching `clients` row by email. Final form: 0067. | 0002 → 0005 → 0011 → 0012 → 0018 → 0024 → 0067 |
| log_audit() | trigger | DEFINER, `search_path=public` | Generic audit: inserts into `audit_logs` (actor = auth.uid(), action = TG_OP, entity = table, entity_id = row id, metadata = full row jsonb). Returns OLD on DELETE else NEW. | 0002 |
| notify_supervisors_on_alert() | trigger | DEFINER, `search_path=public` | AFTER INSERT on emergency_alerts → inserts an 'emergency' notification for every active admin/supervisor. | 0002 |
| sync_client_name_on_update() | trigger | DEFINER, `search_path=public` | When `clients.name` changes, back-fills `cases.client_name` on all linked cases. | 0023 |
| link_client_profile_on_insert() | trigger | DEFINER, `search_path=public` | AFTER INSERT on clients with email + no profile_id → links to an existing unlinked client-role profile with matching email. | 0025 |
| check_invoice_case_client() | trigger | INVOKER (plpgsql) | BEFORE INSERT/UPDATE on invoices: if `case_id` is set, raises foreign_key_violation unless `cases.client_id = invoices.client_id`. | 0026 |

---

## Utility / reporting functions

| Function | Signature → Return | Security | What it does | Source |
|---|---|---|---|---|
| next_invoice_number() | `() → text` | INVOKER, `LANGUAGE sql` | Returns `'INV-' || YYYYMM || '-' || LPAD(nextval('invoice_seq'),3)`. Default for invoices.invoice_number. | 0015 |
| monthly_expense_summary(p_month date DEFAULT date_trunc('month', current_date)::date) | `→ TABLE(agent_id uuid, agent_name text, category expense_category, total numeric, entries bigint)` | DEFINER, STABLE, `LANGUAGE sql`, `search_path=public` | Aggregates expenses by agent + category for the given month. | 0002 |

Sequence: `invoice_seq` (START 1, 0015) — backs `next_invoice_number()`.

---

## Dropped functions (excluded from current state)

- `notify_agent_on_assignment()` — created 0016, DROPPED 0019 (notifications moved to app layer).
- `notify_on_report_status()` — created 0016, DROPPED 0019 (and `reports` table later dropped in 0051).
