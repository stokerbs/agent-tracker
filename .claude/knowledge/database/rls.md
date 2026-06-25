# Row Level Security — Current State

Migration-derived (0001–0069). RLS is enabled on every `public` table listed below plus `storage.objects`. Policies reflect the final state after all drops/replacements. Helper functions (`is_admin()`, `is_staff()`, `current_role()`, `my_agent_id()`) are SECURITY DEFINER — see `functions.md`.

`is_staff()` = role in (admin, supervisor). `current_role()` = the caller's `profiles.role`.

Cross-reference `schema.md` for which tables are security-sensitive.

---

## RLS enablement

RLS ENABLED on: profiles, agents, clients, cases, case_agents, timeline_entries, evidence, expenses, emergency_alerts, notifications, audit_logs (0003); invoices (0015); report_versions (0021, table later dropped); gps_devices (0022); agent_location_history, geofences, geofence_events (0028); ai_prompts, ai_prompt_versions (0033); gps903_session (0036); gps903_devices (0038/0040); gps_device_positions, gps_device_access (0039/0040); gps903_credentials, gps903_credential_sessions (0041); agent_payments (0055); target_photos, target_vehicles, target_locations (0057); case_messages, case_message_views (0058); vehicle_photos (0059); target_relationships (0065); device_tokens (0068); gps_tokens (0069).

Tables with RLS enabled but NO user-facing policies (service-role only, default-deny for everyone else): `gps903_session`, `gps903_credentials`, `gps903_credential_sessions`.

---

## profiles (0003; modified 0009)

| Policy | Cmd | Logic |
|---|---|---|
| profiles self read | SELECT | `id = auth.uid() OR is_admin() OR (current_role()='supervisor' AND role <> 'admin')` — own profile; admins see all; supervisors see all non-admin profiles (0009 V-4) |
| profiles self update | UPDATE | USING `id = auth.uid()` / CHECK `id = auth.uid()` |
| profiles admin all | ALL | USING/CHECK `is_admin()` |

Audit trigger present (0011). New rows auto-created by `handle_new_user` (SECURITY DEFINER, bypasses RLS).

## agents (0003; replaced 0014)

| Policy | Cmd | Logic |
|---|---|---|
| agents staff write | ALL | USING/CHECK `is_staff()` |
| agents self update | UPDATE | USING/CHECK `profile_id = auth.uid()` |
| agents staff read all | SELECT | role `authenticated`; USING `is_staff()` (0014) |
| agents self read | SELECT | role `authenticated`; USING `profile_id = auth.uid()` (0014) |

Clients have no SELECT path → denied. (0014 removed the old "agents read authed" that exposed live GPS to all authed users.)

## clients (0003)

| Policy | Cmd | Logic |
|---|---|---|
| clients staff read | SELECT | `is_staff() OR profile_id = auth.uid()` |
| clients staff write | ALL | USING/CHECK `is_staff()` |

## cases (0003; modified 0009)

| Policy | Cmd | Logic |
|---|---|---|
| cases staff read | SELECT | `is_staff()` |
| cases agent read | SELECT | EXISTS assignment via case_agents→agents where `a.profile_id = auth.uid()` |
| cases client read | SELECT | EXISTS clients row where `c.id = cases.client_id AND profile_id = auth.uid()` |
| cases staff insert | INSERT | CHECK `is_staff()` (0009 V-1) |
| cases staff update | UPDATE | USING/CHECK `is_staff()` (0009 V-1) |
| cases admin delete | DELETE | USING `is_admin()` — DELETE is admin-only (0009 V-1) |

## case_agents (0003)

| Policy | Cmd | Logic |
|---|---|---|
| case_agents staff write | ALL | USING/CHECK `is_staff()` |
| case_agents read | SELECT | `is_staff() OR` agent owns the row (`agents.id = case_agents.agent_id AND profile_id = auth.uid()`) |

## timeline_entries (rebuilt in 0048)

0048 dropped the old 0003/0009 policies. Current model:

| Policy | Cmd | Logic |
|---|---|---|
| timeline_admin_all | ALL | USING/CHECK `is_admin()` |
| timeline_case_member_select | SELECT | `deleted_at IS NULL AND` caller assigned to the case (case_agents→agents) |
| timeline_case_member_insert | INSERT | caller assigned to the case AND `(agent_id IS NULL OR agent_id = my_agent_id())` (self-attribution) |
| timeline_supervisor_update | UPDATE | USING: caller is supervisor AND assigned to the case; CHECK `true` |
| timeline_supervisor_delete | DELETE | USING: caller is supervisor AND assigned to the case |

Agents: SELECT + INSERT on assigned cases only (no UPDATE/DELETE). Supervisors gained per-case scoping (0048 removed blanket "timeline staff all").

## evidence (0003; agent insert hardened 0049)

| Policy | Cmd | Logic |
|---|---|---|
| evidence staff all | ALL | USING/CHECK `is_staff()` |
| evidence agent read | SELECT | caller assigned to evidence.case_id (case_agents→agents) |
| evidence agent insert | INSERT | caller assigned to case AND (`timeline_entry_id IS NULL` OR the referenced timeline entry belongs to the same case and is not deleted) (0049) |

## expenses (rebuilt in 0054)

0054 dropped earlier policies (0003/0009). Current model:

| Policy | Cmd | Logic |
|---|---|---|
| expenses staff select | SELECT | `is_staff() AND deleted_at IS NULL` |
| expenses staff insert | INSERT | CHECK `is_staff()` |
| expenses staff update | UPDATE | USING `is_staff() AND deleted_at IS NULL` / CHECK `is_staff()` |
| expenses staff delete | DELETE | USING `is_staff()` |
| expenses agent select | SELECT | `deleted_at IS NULL AND` caller owns the agent row |
| expenses agent insert | INSERT | CHECK caller owns the agent row |
| expenses agent update | UPDATE | USING `deleted_at IS NULL AND` owns agent row / CHECK owns agent row |

Agents cannot DELETE. Audit trigger present (0009).

## emergency_alerts (0003; agent insert hardened 0009)

| Policy | Cmd | Logic |
|---|---|---|
| alerts staff all | ALL | USING/CHECK `is_staff()` |
| alerts agent insert | INSERT | caller owns the agent row AND (`case_id IS NULL` OR caller assigned to that case) (0009 V-5) |
| alerts agent read own | SELECT | caller owns the agent row |

## notifications (0003)

| Policy | Cmd | Logic |
|---|---|---|
| notifications own | SELECT | `user_id = auth.uid()` |
| notifications own update | UPDATE | USING/CHECK `user_id = auth.uid()` |

No INSERT policy for users — notifications are created by SECURITY DEFINER triggers / service role.

## audit_logs (0003)

| Policy | Cmd | Logic |
|---|---|---|
| audit admin read | SELECT | `is_admin()` |

No INSERT/UPDATE/DELETE policies → append-only & immutable for users; writes happen via SECURITY DEFINER `log_audit` trigger.

## invoices (rebuilt in 0027)

0027 dropped 0015's broad policy. Current model:

| Policy | Cmd | Logic |
|---|---|---|
| invoices staff select | SELECT | role `authenticated`; `is_staff() AND deleted_at IS NULL` |
| invoices staff insert | INSERT | role `authenticated`; CHECK `is_staff()` |
| invoices staff update | UPDATE | USING `is_staff() AND deleted_at IS NULL` / CHECK `is_staff()` (allows soft-delete) |
| invoices client read own | SELECT | role `authenticated`; `deleted_at IS NULL AND status != 'draft' AND client_id IN (clients where profile_id = auth.uid())` |

## agent_payments (0055)

| Policy | Cmd | Logic |
|---|---|---|
| payroll admin all | ALL | USING/CHECK `is_admin()` |
| payroll supervisor select | SELECT | `current_role() = 'supervisor'` |
| payroll supervisor update | UPDATE | USING/CHECK `current_role() = 'supervisor'` |
| payroll agent read | SELECT | caller owns the agent row |

## Live map

### agent_location_history (0028)
- `loc_hist staff read` — SELECT, role authenticated, `is_staff()`. Inserts via service role.

### geofences (0028)
- `geofences staff read` — SELECT, role authenticated, `is_staff() AND deleted_at IS NULL`. Writes via service role.

### geofence_events (0028)
- `geo_events staff read` — SELECT, role authenticated, `is_staff()`. Inserts via service role.

## GPS tracking

### gps_devices (0022; rebuilt 0039/0040; agent read added 0047)
| Policy | Cmd | Logic |
|---|---|---|
| gps_devices admin all | ALL | USING/CHECK `is_admin()` (0022) |
| gps_devices access read | SELECT | `deleted_at IS NULL AND` EXISTS grant in `gps_device_access` for `auth.uid()` (0040) |
| gps_devices supervisor edit | UPDATE | USING: supervisor AND has access grant for this device; CHECK: supervisor (0040) |
| gps_devices_agent_read | SELECT | `deleted_at IS NULL AND` (directly assigned via `agent_id` OR assigned to the device's case via case_agents) (0047) |

(0022's supervisor read/edit and original agent-case read policies were dropped in 0039/0040, replaced by access-grant model; 0047 re-added agent read by assignment.)

### gps_device_positions (0039/0040; agent read added 0047)
| Policy | Cmd | Logic |
|---|---|---|
| gdp_admin_all | ALL | `is_admin()` |
| gdp_access_read | SELECT | EXISTS grant in `gps_device_access` for the device + `auth.uid()` |
| gdp_service_insert | INSERT | CHECK `auth.role() = 'service_role'` |
| gdp_agent_read | SELECT | device exists, not deleted, and caller is directly assigned (`agent_id`) or assigned to its case (0047) |

### gps_device_access (0039/0040)
| Policy | Cmd | Logic |
|---|---|---|
| gda_admin_all | ALL | USING/CHECK `is_admin()` |
| gda_supervisor_read | SELECT | caller is supervisor |
| gda_supervisor_write | INSERT | CHECK caller is supervisor |
| gda_supervisor_delete | DELETE | caller is supervisor |
| gda_self_read | SELECT | `profile_id = auth.uid()` (so users learn which devices they can see) |

### gps903_devices (0038/0040)
- `staff_read_gps903_devices` — SELECT, profiles role in (admin, supervisor). Writes via service role.

### gps903_session / gps903_credentials / gps903_credential_sessions
RLS enabled, NO policies → service-role only. `gps903_credentials` holds device passwords; intentionally never exposed to any authenticated user. **Housekeeping/security note**: `gps903_session` is a superseded-but-undropped singleton (created 0036, functionally replaced by `gps903_credential_sessions` in 0041) that still holds a live session cookie — a dead-but-live table. Not user-reachable (no policies), but it remains a stale session surface worth tracking. Cross-ref `schema.md` → gps903_session.

## case_messages (0058)

| Policy | Cmd | Logic |
|---|---|---|
| msgs_admin_all | ALL | USING: caller role = 'admin' |
| msgs_supervisor_all | ALL | USING: caller role = 'supervisor' |
| msgs_agent_select | SELECT | `is_internal = FALSE AND` caller assigned to the case |
| msgs_agent_insert | INSERT | `is_internal = FALSE AND sender_id = auth.uid() AND` caller assigned to the case |
| msgs_client_select | SELECT | `is_internal = FALSE AND` caller is the case's client |
| msgs_client_insert | INSERT | `is_internal = FALSE AND sender_id = auth.uid() AND` caller is the case's client |

Internal (staff-only) notes are only visible to admin/supervisor. Agents and clients are hard-blocked from `is_internal=TRUE` rows.

## case_message_views (0058)
- `views_own` — ALL, USING/CHECK `profile_id = auth.uid()`.

## Target intelligence (clients fully denied; agents read-only on assigned cases)

Each of `target_photos` (0057), `target_vehicles` (0057), `target_locations` (0057), `target_relationships` (0065), `vehicle_photos` (0059) has the same 3-policy shape:

| Policy (per table) | Cmd | Logic |
|---|---|---|
| `<name> admin all` | ALL | USING/CHECK `is_admin()` |
| `<name> supervisor all` | ALL | USING/CHECK `current_role() = 'supervisor'` |
| `<name> agent read/select` | SELECT | caller assigned to the row's case (case_agents→agents) |

Policy names: `intel_photos *`, `intel_vehicles *`, `intel_locations *`, `intel_relationships *`, and `vph_admin_all` / `vph_supervisor_all` / `vph_agent_select` for vehicle_photos. No client policy on any of these → clients denied.

## ai_prompts / ai_prompt_versions (0033)

| Policy | Table | Cmd | Logic |
|---|---|---|---|
| staff can read prompts | ai_prompts | SELECT | `is_staff()` |
| admin can update prompts | ai_prompts | UPDATE | caller role = 'admin' |
| staff can read prompt versions | ai_prompt_versions | SELECT | `is_staff()` |
| admin can insert prompt versions | ai_prompt_versions | INSERT | CHECK caller role = 'admin' |

(No INSERT policy on `ai_prompts` for users — seeded via migrations; edits via update only.)

## device_tokens (0068)

| Policy | Cmd | Logic |
|---|---|---|
| device_tokens self select | SELECT | `profile_id = auth.uid()` |
| device_tokens self insert | INSERT | CHECK `profile_id = auth.uid()` |
| device_tokens self update | UPDATE | USING/CHECK `profile_id = auth.uid()` |
| device_tokens self delete | DELETE | `profile_id = auth.uid()` |

Push sender uses service role (bypasses RLS).

## gps_tokens (0069)

| Policy | Cmd | Logic |
|---|---|---|
| gps_tokens self select | SELECT | `profile_id = auth.uid()` |
| gps_tokens self insert | INSERT | CHECK `profile_id = auth.uid()` |
| gps_tokens self delete | DELETE | `profile_id = auth.uid()` |

(No self UPDATE policy — tokens are re-issued by insert/delete; the location route validates via service role.)

---

## Storage object policies (storage.objects)

Buckets (0004): `avatars`, `evidence`, `receipts`, `reports` (all private). `agent-photos` (public, 0031). `intelligence` (private, 0057). Bucket-level MIME/size limits set in 0010.

| Policy | Cmd | Logic |
|---|---|---|
| avatars read authed | SELECT | bucket `avatars` AND authenticated (0004) |
| avatars write own | INSERT | bucket `avatars` AND first path segment = `auth.uid()` (0004) |
| avatars update own | UPDATE | bucket `avatars` AND first path segment = `auth.uid()` (USING+CHECK, 0010) |
| evidence staff read | SELECT | bucket `evidence` AND `is_staff()` (0004) |
| evidence staff write | INSERT | bucket `evidence` AND `is_staff()` (0011 final) |
| evidence agent write | INSERT | bucket `evidence` AND `current_role()='agent'` AND folder[1] = an assigned case_id (0011 final) |
| evidence agent read | SELECT | bucket `evidence` AND folder[1] = an assigned case_id (0010) |
| evidence staff delete | DELETE | bucket `evidence` AND `is_staff()` (0010) |
| receipts staff read | SELECT | bucket `receipts` AND `is_staff()` (0004) |
| receipts own write | INSERT | bucket `receipts` AND folder[1] = `auth.uid()` (0004) |
| receipts own read | SELECT | bucket `receipts` AND folder[1] = `auth.uid()` (0004) |
| receipts staff all | ALL | bucket `receipts` AND `is_staff()` (0010) |
| reports staff all | ALL | bucket `reports` AND `is_staff()` (0004) |
| agent-photos staff write | INSERT | bucket `agent-photos` AND `is_staff()` (0031) |
| agent-photos staff update | UPDATE | bucket `agent-photos` AND `is_staff()` (0031) |
| agent-photos staff delete | DELETE | bucket `agent-photos` AND `is_staff()` (0031) |
| intel bucket staff insert | INSERT | bucket `intelligence` AND `is_staff()` (0057) |
| intel bucket staff update | UPDATE | bucket `intelligence` AND `is_staff()` (0057) |
| intel bucket staff delete | DELETE | bucket `intelligence` AND `is_staff()` (0057) |
| intel bucket staff read | SELECT | bucket `intelligence` AND `is_staff()` (0057) |
| intel bucket agent read | SELECT | bucket `intelligence` AND `current_role()='agent'` AND folder[1] = an assigned case_id (0057) |

NOTE: the original broad "evidence authed write" (0004) was dropped and replaced (0006 then 0011) so that agents may only write into folders for cases they are assigned to. `agent-photos` bucket is public-read at the object level (public bucket), so no SELECT policy is needed there.
