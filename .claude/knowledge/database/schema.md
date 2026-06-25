# Database Schema — Current State

Canonical, migration-derived reference. Reflects the database after replaying migrations `0001`–`0069`. Every object below traces to a migration; citations are in parentheses.

PII / sensitive columns flagged inline. See the "Security-sensitive tables" section at the end and cross-reference `rls.md`.

Conventions: all `public` schema unless noted. UUID PKs via `gen_random_uuid()` (pgcrypto, 0001). `timestamptz` everywhere for timestamps.

---

## Identity & access

### profiles (0001; altered 0012, 0018)
Application users, mirrors `auth.users`. Carries the app-level RBAC role. **SECURITY-SENSITIVE**: PII (email, phone, full_name) + role/auth data.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | — | PK; FK → auth.users(id) ON DELETE CASCADE |
| email | text | yes | — | UNIQUE. NOT NULL dropped in 0012 (phone-only OTP users) |
| full_name | text | yes | — | |
| avatar_url | text | yes | — | |
| role | user_role | no | `'client'` | Default was `'agent'` (0001) → `'client'` (0018) |
| phone | text | yes | — | |
| is_active | boolean | no | `true` | |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |

### agents (0001; altered 0013, 0028, 0030, 0035)
Field operatives, optionally linked 1:1 to a profile login. **SECURITY-SENSITIVE**: live GPS (current_lat/lng), PII (phone, email, full_name), device telemetry.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| profile_id | uuid | yes | — | UNIQUE; FK → profiles(id) ON DELETE SET NULL |
| agent_code | text | no | — | UNIQUE |
| full_name | text | no | — | |
| nickname | text | yes | — | |
| phone | text | yes | — | |
| email | text | yes | — | |
| photo_url | text | yes | — | |
| position | text | yes | — | |
| area | text | yes | — | |
| status | text | yes | `'offline'` | Was enum `agent_status` (0001); converted to text + CHECK in `('online','moving','idle','offline','emergency')` (0030) |
| last_active | timestamptz | yes | — | |
| current_lat | double precision | yes | — | live location |
| current_lng | double precision | yes | — | live location |
| battery_pct | smallint | yes | — | CHECK 0–100 |
| is_charging | boolean | yes | — | (0013) |
| speed_kmh | real | yes | `0` | (0028) |
| heading | smallint | yes | `0` | CHECK 0–359 (0028) |
| vehicle_type | text | yes | — | CHECK null or `('car','motorcycle','foot')` (0028 → tightened 0030) |
| agent_role | text | yes | — | CHECK null or `('field_agent','supervisor','team_leader','operations')` (0030) |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |

### clients (0001)
Surveillance customers with portal logins. **SECURITY-SENSITIVE**: PII (name, email, phone).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| profile_id | uuid | yes | — | UNIQUE; FK → profiles(id) ON DELETE SET NULL |
| name | text | no | — | |
| company | text | yes | — | |
| email | text | yes | — | |
| phone | text | yes | — | |
| notes | text | yes | — | |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |

---

## Cases & assignment

### cases (0001; PII columns 0007/0008; 0020, 0023, 0056, 0065)
Surveillance assignments. **SECURITY-SENSITIVE**: heavy target PII, stored application-layer encrypted (AES-256-GCM `_enc`) with HMAC blind-index (`_bidx`) for exact-match search. Plaintext target columns from 0001 were dropped in 0008.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| case_number | text | no | — | UNIQUE |
| client_id | uuid | yes | — | FK → clients(id) ON DELETE SET NULL |
| client_name | text | yes | — | DEPRECATED display denorm; not used for access control (0023) |
| case_type | text | yes | — | |
| start_date | date | yes | — | |
| end_date | date | yes | — | |
| status | case_status | no | `'new'` | |
| priority | case_priority | no | `'medium'` | |
| description | text | yes | — | |
| created_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| archived_at | timestamptz | yes | — | soft-delete / archive (0020) |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |
| **Encrypted target PII (0007/0008, 0056, 0065):** | | | | |
| target_name_enc | text | yes | — | + `target_name_bidx` (blind index) |
| target_phone_enc | text | yes | — | + `target_phone_bidx` |
| target_vehicle_enc | text | yes | — | |
| license_plate_enc | text | yes | — | + `license_plate_bidx` |
| target_address_enc | text | yes | — | |
| target_alias_enc | text | yes | — | (0056) |
| target_gender | text | yes | — | plaintext, low sensitivity (0056) |
| target_age | smallint | yes | — | (0056) |
| target_notes_enc | text | yes | — | (0056) |
| target_dob_enc | text | yes | — | (0065) |
| target_nationality | text | yes | — | plaintext (0065) |
| target_occupation | text | yes | — | plaintext (0065) |
| target_email_enc | text | yes | — | (0065) |
| target_socials_enc | text | yes | — | encrypted JSON (0065) |

NOTE: `*_bidx` columns are plaintext TEXT (HMAC blind indexes), not encrypted; they exist to support indexed exact-match lookup.

### case_agents (0001) — JOIN TABLE (many-to-many)
Assignment of agents to cases. Composite PK `(case_id, agent_id)`.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| case_id | uuid | no | — | PK part; FK → cases(id) ON DELETE CASCADE |
| agent_id | uuid | no | — | PK part; FK → agents(id) ON DELETE CASCADE |
| assigned_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| assigned_at | timestamptz | no | `now()` | |

### timeline_entries (0001; 0034 soft-delete)
Chronological surveillance log. **SECURITY-SENSITIVE**: surveillance content + location.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| case_id | uuid | no | — | FK → cases(id) ON DELETE CASCADE |
| agent_id | uuid | yes | — | FK → agents(id) ON DELETE SET NULL |
| entry_date | date | no | `current_date` | |
| entry_time | time | no | `current_time` | |
| entry | text | no | — | |
| location | text | yes | — | |
| lat | double precision | yes | — | |
| lng | double precision | yes | — | |
| photo_url | text | yes | — | |
| video_url | text | yes | — | |
| deleted_at | timestamptz | yes | — | soft-delete (0034) |
| deleted_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL (0034) |
| updated_at | timestamptz | yes | — | (0034) |
| updated_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL (0034) |
| created_at | timestamptz | no | `now()` | |

### evidence (0001; 0049 timeline link)
Files attached to cases. **SECURITY-SENSITIVE**: evidence records (storage paths to private bucket).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| case_id | uuid | no | — | FK → cases(id) ON DELETE CASCADE |
| type | evidence_type | no | `'photo'` | |
| category | text | yes | — | |
| storage_path | text | no | — | path in private `evidence` bucket |
| file_name | text | yes | — | |
| file_size | bigint | yes | — | |
| mime_type | text | yes | — | |
| notes | text | yes | — | |
| timeline_entry_id | uuid | yes | — | FK → timeline_entries(id) ON DELETE SET NULL (0049) |
| uploaded_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| uploaded_at | timestamptz | no | `now()` | |

---

## Target intelligence (all clients RLS-denied; agents read-only on assigned cases)

### target_photos (0057)
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| case_id | uuid | no | — | FK → cases(id) ON DELETE CASCADE |
| storage_path | text | no | — | private `intelligence` bucket |
| is_primary | boolean | no | `false` | |
| caption | text | yes | — | |
| uploaded_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| created_at | timestamptz | no | `now()` | |

### target_vehicles (0057)
**SECURITY-SENSITIVE**: encrypted plate (`license_plate_enc`) + blind index.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| case_id | uuid | no | — | FK → cases(id) ON DELETE CASCADE |
| make / model / color | text | yes | — | |
| license_plate_enc | text | yes | — | encrypted |
| license_plate_bidx | text | yes | — | blind index |
| notes | text | yes | — | |
| is_primary | boolean | no | `false` | |
| photo_url | text | yes | — | denorm primary photo path |
| created_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| created_at / updated_at | timestamptz | no | `now()` | |

### vehicle_photos (0059)
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| vehicle_id | uuid | no | — | FK → target_vehicles(id) ON DELETE CASCADE |
| case_id | uuid | no | — | FK → cases(id) ON DELETE CASCADE |
| storage_path | text | no | — | |
| is_primary | boolean | no | `false` | |
| uploaded_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| created_at | timestamptz | no | `now()` | |

### target_locations (0057; 0060)
**SECURITY-SENSITIVE**: encrypted address (`address_enc`) + coordinates.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| case_id | uuid | no | — | FK → cases(id) ON DELETE CASCADE |
| location_type | text | no | `'other'` | 'home' / 'workplace' / 'other' |
| label | text | yes | — | |
| address_enc | text | yes | — | encrypted street address |
| lat / lng | double precision | yes | — | |
| notes | text | yes | — | |
| photo_url | text | yes | — | |
| location_name | text | yes | — | (0060) |
| maps_url | text | yes | — | (0060) |
| created_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| created_at / updated_at | timestamptz | no | `now()` | |

### target_relationships (0065)
**SECURITY-SENSITIVE**: encrypted person name (`name_enc`).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| case_id | uuid | no | — | FK → cases(id) ON DELETE CASCADE |
| name_enc | text | yes | — | encrypted |
| relation | text | no | `'associate'` | spouse/partner/friend/associate/family/other |
| notes | text | yes | — | |
| created_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| created_at / updated_at | timestamptz | no | `now()` | |

---

## Communications & alerts

### case_messages (0058)
Two-way staff↔client thread per case. `is_internal=TRUE` = staff-only notes. Realtime-enabled (0061). **SECURITY-SENSITIVE**: case-related communications.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| case_id | uuid | no | — | FK → cases(id) ON DELETE CASCADE |
| sender_id | uuid | no | — | FK → profiles(id) |
| body | text | no | — | CHECK length 1–2000 |
| is_internal | boolean | no | `false` | |
| created_at | timestamptz | no | `now()` | |

### case_message_views (0058) — JOIN TABLE
Last-seen tracking per user per case. Composite PK `(case_id, profile_id)`. Realtime-enabled (0062).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| case_id | uuid | no | — | PK part; FK → cases(id) ON DELETE CASCADE |
| profile_id | uuid | no | — | PK part; FK → profiles(id) ON DELETE CASCADE |
| last_seen_at | timestamptz | no | `now()` | |

### emergency_alerts (0001)
SOS records. **SECURITY-SENSITIVE**: agent location.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| agent_id | uuid | yes | — | FK → agents(id) ON DELETE SET NULL |
| case_id | uuid | yes | — | FK → cases(id) ON DELETE SET NULL |
| lat / lng | double precision | yes | — | |
| notes | text | yes | — | |
| status | alert_status | no | `'active'` | |
| acknowledged_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| acknowledged_at | timestamptz | yes | — | |
| created_at | timestamptz | no | `now()` | |

### notifications (0001)
In-app alerts per user.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_id | uuid | no | — | FK → profiles(id) ON DELETE CASCADE |
| type | notification_type | no | `'system'` | |
| title | text | no | — | |
| body | text | yes | — | |
| link | text | yes | — | |
| is_read | boolean | no | `false` | |
| created_at | timestamptz | no | `now()` | |

---

## Finance

### expenses (0001; 0011, 0053, 0054)
Field reimbursements. **SECURITY-SENSITIVE**: financial records.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| agent_id | uuid | yes | — | FK → agents(id) ON DELETE SET NULL |
| case_id | uuid | yes | — | FK → cases(id) ON DELETE SET NULL |
| category | expense_category | no | `'misc'` | |
| amount | numeric(12,2) | no | — | CHECK ≥ 0 |
| currency | text | no | `'THB'` | CHECK `^[A-Z]{3}$` (0011); default USD→THB (0053) |
| expense_date | date | no | `current_date` | |
| receipt_url | text | yes | — | |
| notes | text | yes | — | |
| created_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| **OCR fields (0053):** | | | | |
| vendor_name | text | yes | — | |
| vat_amount | numeric(10,2) | yes | — | |
| receipt_number | text | yes | — | |
| expense_time | time | yes | — | |
| ocr_confidence | smallint | yes | — | CHECK 0–100 |
| ocr_raw | jsonb | yes | — | |
| source | text | no | `'manual'` | CHECK `('manual','ocr')` |
| **Status / soft-delete (0054):** | | | | |
| status | expense_status | no | `'pending'` | |
| paid_at | timestamptz | yes | — | |
| paid_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| deleted_at | timestamptz | yes | — | |
| deleted_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| created_at | timestamptz | no | `now()` | |

### invoices (0015; 0017, 0026, 0027)
Client invoices. **SECURITY-SENSITIVE**: financial records.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| invoice_number | text | no | `next_invoice_number()` | UNIQUE |
| client_id | uuid | no | — | FK → clients(id) ON DELETE CASCADE |
| case_id | uuid | yes | — | FK → cases(id) ON DELETE SET NULL |
| title | text | no | — | |
| line_items | jsonb | no | `'[]'` | |
| amount | numeric(12,2) | no | `0` | |
| currency | text | no | `'THB'` | |
| status | invoice_status | no | `'draft'` | |
| issued_date | date | no | `current_date` | |
| due_date | date | yes | — | |
| notes | text | yes | — | |
| created_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL (re-pointed from auth.users in 0026) |
| paid_at | timestamptz | yes | — | (0017) |
| payment_method | text | yes | — | (0017) |
| payment_ref | text | yes | — | (0017) |
| deleted_at | timestamptz | yes | — | (0027) |
| deleted_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL (0027) |
| created_at / updated_at | timestamptz | no | `now()` | |

### agent_payments (0055)
Agent payroll (daily payments owed). **SECURITY-SENSITIVE**: financial records / PII.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| agent_id | uuid | yes | — | FK → agents(id) ON DELETE SET NULL |
| case_id | uuid | yes | — | FK → cases(id) ON DELETE SET NULL |
| work_date | date | no | — | |
| amount | numeric(12,2) | no | — | CHECK ≥ 0 |
| currency | text | no | `'THB'` | |
| notes | text | yes | — | |
| status | payroll_status | no | `'pending'` | |
| paid_at | timestamptz | yes | — | |
| paid_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| created_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| created_at / updated_at | timestamptz | no | `now()` | |

---

## Live map / geofencing

### agent_location_history (0028)
Agent trail history. Staff read; inserts via service role.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| agent_id | uuid | no | — | FK → agents(id) ON DELETE CASCADE |
| lat / lng | double precision | no | — | |
| speed_kmh | real | yes | — | |
| heading | smallint | yes | — | |
| recorded_at | timestamptz | no | `now()` | |

### geofences (0028)
Surveillance zones. Staff read non-deleted; writes via service role.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| name | text | no | — | |
| description | text | yes | — | |
| coordinates | jsonb | no | `'[]'` | |
| color | text | no | `'#3B82F6'` | |
| active | boolean | no | `true` | |
| created_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| created_at / updated_at | timestamptz | no | `now()` | |
| deleted_at | timestamptz | yes | — | |

### geofence_events (0028)
Enter/exit events. Staff read; inserts via service role.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| geofence_id | uuid | no | — | FK → geofences(id) ON DELETE CASCADE |
| agent_id | uuid | no | — | FK → agents(id) ON DELETE CASCADE |
| event_type | text | no | — | CHECK `('enter','exit')` |
| lat / lng | double precision | no | — | |
| occurred_at | timestamptz | no | `now()` | |

---

## GPS device tracking (GPS903 integration)

### gps_devices (0022; 0035, 0036, 0037, 0039, 0043–0046, 0064)
Per-case GPS trackers (soft-deleted). **SECURITY-SENSITIVE**: GPS location + IMEI/phone identifiers.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| case_id | uuid | no | — | FK → cases(id) ON DELETE CASCADE |
| imei | varchar(15) | yes | — | CHECK null or `^\d{15}$` |
| phone_number | text | yes | — | |
| provider | gps_provider | yes | — | |
| notes | text | yes | — | |
| created_by | uuid | yes | — | FK → profiles(id) |
| agent_id | uuid | yes | — | FK → agents(id) ON DELETE SET NULL (0035) |
| credential_id | uuid | yes | — | FK → gps903_credentials(id) ON DELETE RESTRICT (0046) |
| gps903_device_id | integer | yes | — | (0036) |
| last_polled_at | timestamptz | yes | — | (0037) |
| last_poll_ok | boolean | yes | — | (0037) |
| last_lat / last_lng | numeric(10,6) | yes | — | (0039) |
| last_speed_kmh | numeric(6,2) | yes | — | (0039) |
| last_heading | integer | yes | — | (0039) |
| last_battery_pct | integer | yes | — | CHECK 0–100 (0039) |
| last_seen_at | timestamptz | yes | — | (0039) |
| last_locate_mode | text | yes | — | CHECK `('gps','lbs','offline','unknown')` (0043) |
| last_position_time | timestamptz | yes | — | (0044) |
| last_stop_minutes | integer | yes | — | (0044) |
| last_ignition | boolean | yes | — | (0045) |
| deleted_at | timestamptz | yes | — | soft-delete |
| created_at / updated_at | timestamptz | no | `now()` | |

NOTE: `traccar_id` (added 0035) was DROPPED in 0064.

### gps_device_positions (0039/0040)
Per-device position history.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| gps_device_id | uuid | no | — | FK → gps_devices(id) ON DELETE CASCADE |
| lat / lng | numeric(10,6) | no | — | |
| speed_kmh | numeric(6,2) | no | `0` | |
| heading | integer | no | `0` | |
| battery_pct | integer | yes | — | CHECK 0–100 |
| recorded_at | timestamptz | no | `now()` | |

### gps_device_access (0039/0040) — JOIN TABLE
Profile↔device view grants. UNIQUE `(gps_device_id, profile_id)`.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| gps_device_id | uuid | no | — | FK → gps_devices(id) ON DELETE CASCADE |
| profile_id | uuid | no | — | FK → profiles(id) ON DELETE CASCADE |
| granted_by | uuid | yes | — | FK → profiles(id) |
| created_at | timestamptz | no | `now()` | |

### gps903_devices (0038/0040)
GPS903 device catalog (discovery sync). UNIQUE `(gps903_device_id)`.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| gps903_device_id | integer | no | — | UNIQUE |
| device_name | text | yes | — | |
| imei | text | yes | — | |
| model | text | yes | — | |
| last_seen | timestamptz | yes | — | |
| synced_at | timestamptz | no | `now()` | |
| created_at / updated_at | timestamptz | no | `now()` | |

### gps903_credentials (0041; 0042, 0046)
Per-device GPS903 login credentials. **SECURITY-SENSITIVE**: stores `device_password` (credentials). No user-facing RLS policies — service-role only.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| device_name | text | no | — | |
| imei | text | no | — | UNIQUE; CHECK `^\d{15}$` |
| device_password | text | no | — | **credential — server-side only** |
| gps903_device_id | integer | yes | — | UNIQUE; NOT NULL dropped in 0042 |
| is_active | boolean | no | `true` | |
| last_synced_at | timestamptz | yes | — | |
| last_sync_ok | boolean | yes | — | |
| phone_number | text | yes | — | (0046) |
| provider | text | yes | — | (0046) |
| created_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| created_at / updated_at | timestamptz | no | `now()` | |

### gps903_session (0036)
Singleton ASP.NET session cache (PK forced to id=1). RLS enabled, service-role only. **SECURITY / HOUSEKEEPING**: superseded by `gps903_credential_sessions` (0041) and no longer used by current code, but the table was never dropped — a dead-but-live table still holding a live session cookie. Service-role-only (RLS enabled, zero policies) so not user-reachable. Flagged here and in `rls.md` so the stale session surface is visible from the security angle, not just as schema housekeeping.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | integer | no | `1` | PK; CHECK id=1 |
| session_cookie | text | no | — | |
| expires_at | timestamptz | no | — | |
| updated_at | timestamptz | no | `now()` | |

### gps903_credential_sessions (0041)
Per-credential session cache. RLS enabled, service-role only.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| credential_id | uuid | no | — | PK; FK → gps903_credentials(id) ON DELETE CASCADE |
| session_cookie | text | no | — | |
| expires_at | timestamptz | no | — | |
| updated_at | timestamptz | no | `now()` | |

---

## Native app tokens

### device_tokens (0068)
Native push tokens (FCM/APNs). **SECURITY-SENSITIVE**: device/push tokens.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| profile_id | uuid | no | — | FK → profiles(id) ON DELETE CASCADE |
| platform | text | no | — | 'ios' / 'android' / 'web' |
| token | text | no | — | UNIQUE |
| created_at | timestamptz | no | `now()` | |
| last_seen_at | timestamptz | no | `now()` | |

### gps_tokens (0069)
Long-lived per-user bearer tokens for background GPS reporting. **SECURITY-SENSITIVE**: auth credentials (bearer tokens).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| profile_id | uuid | no | — | FK → profiles(id) ON DELETE CASCADE |
| token | text | no | — | UNIQUE |
| created_at | timestamptz | no | `now()` | |
| last_used_at | timestamptz | yes | — | |
| revoked_at | timestamptz | yes | — | |

---

## AI / prompts

### ai_prompts (0033; seeded 0033, 0065, 0066)
Editable AI system prompts. Staff read; admin update.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| prompt_key | text | no | — | UNIQUE |
| name | text | no | — | |
| description | text | yes | — | |
| prompt_text | text | no | — | |
| default_text | text | no | — | |
| is_active | boolean | no | `true` | |
| created_at / updated_at | timestamptz | no | `now()` | |

Seeded keys: `surveillance_report_th`, `surveillance_report_en` (0033), `case_intake` (0065; prompt text updated to Thai default in 0066).

### ai_prompt_versions (0033)
Prompt edit history. Staff read; admin insert.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| prompt_id | uuid | no | — | FK → ai_prompts(id) ON DELETE CASCADE |
| prompt_text | text | no | — | |
| saved_by | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| saved_at | timestamptz | no | `now()` | |

---

## Audit

### audit_logs (0001)
Immutable activity trail. **SECURITY-SENSITIVE**: holds full row snapshots (incl. PII) in `metadata`, actor IPs. Admin read-only; no UPDATE/DELETE policy (append-only).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | bigserial | no | — | PK (NOT a UUID) |
| actor_id | uuid | yes | — | FK → profiles(id) ON DELETE SET NULL |
| action | text | no | — | INSERT/UPDATE/DELETE/etc. |
| entity | text | no | — | |
| entity_id | text | yes | — | |
| metadata | jsonb | yes | — | full row snapshot |
| ip_address | inet | yes | — | |
| created_at | timestamptz | no | `now()` | |

---

## DROPPED tables (excluded from current state)

- **reports** (0001) and **report_versions** (0021) — both DROPPED CASCADE in 0051. Reports are now generated on-demand and never persisted. The `report_status` enum still exists (orphaned). All report-related triggers/notification functions are gone (see triggers.md / functions.md).

---

## Security-sensitive tables — summary

| Table | Why sensitive |
|---|---|
| profiles | PII (email/phone/name) + auth role data |
| agents | live GPS, PII, telemetry |
| clients | customer PII |
| cases | encrypted target PII (name/phone/address/plate/DOB/email/socials) |
| timeline_entries | surveillance content + location |
| evidence | evidence records (private storage paths) |
| target_photos / target_vehicles / target_locations / target_relationships / vehicle_photos | target intelligence (encrypted plate/address/name, coordinates, photos) |
| case_messages | case communications (internal staff notes) |
| emergency_alerts | agent location (SOS) |
| expenses / invoices / agent_payments | financial records |
| gps_devices / gps_device_positions / gps903_devices | GPS location + IMEI |
| gps903_credentials | device passwords (credentials) |
| gps903_session / gps903_credential_sessions | session cookies |
| device_tokens | push tokens |
| gps_tokens | bearer auth tokens |
| audit_logs | full-row snapshots (PII), actor IPs |
| agent_location_history / geofence_events | agent location history |

Storage buckets (all PRIVATE except `agent-photos`): `avatars`, `evidence`, `receipts`, `reports`, `intelligence` (private); `agent-photos` (public). See `rls.md` for object-level policies.
