# ARCH-3 · Types Drift Audit — `src/lib/types.ts` vs migration-derived schema

**Type:** Read-only audit (no source-code changes). **Date:** 2026-06-25.
**Subject:** `/Users/thomas/agent-tracker/src/lib/types.ts` (the hand-mirrored shared domain types).

## Scope & the ARCH-3 ↔ FUT-1 boundary

- **ARCH-3 (this document, IN SCOPE):** document every divergence between the hand-authored
  `src/lib/types.ts` and the database schema as derived from migrations `0001`–`0069`, classify
  each by drift class + severity, and hand a remediation plan to FUT-1. **Audit-only.** No `.ts`
  source file is changed, no types are generated, no importers are touched.
- **FUT-1 (OUT OF SCOPE here):** run `supabase gen types`, create `src/lib/database.types.ts`, and
  cut the importers over from the hand-mirrored types to the generated `Tables<T>['Row']` set.
  The cutover is deferred to FUT-1 because `supabase gen types` requires **live DB / Supabase CLI
  access** (project ref + network), which is **not available in this offline environment**. That is
  the explicit reason ARCH-3 stops at documentation.

## Offline source-of-truth note

This audit is **migration-derived, not live introspection.** The authoritative references used are:
- `.claude/knowledge/database/schema.md` — table/column reference, stated as replaying `0001`–`0069`.
- `.claude/knowledge/database/enums.md` — enum + enum-like CHECK reference, same migration range.

These two docs are themselves derived from the migration files, **not** from `pg_catalog` on a
running database. Where a doc was ambiguous, the raw migration SQL under `supabase/migrations/` was
spot-checked (citations inline below). A live `supabase gen types` run in FUT-1 is the only way to
get a `pg_catalog`-faithful set; any residual discrepancy this audit cannot see (e.g. a hotfix
applied directly to prod and never captured as a migration) would surface there.

> Migration-number note: `schema.md` attributes the target-intel tables to "0056/0057" and the
> relationship/target-profile columns to "0065". The on-disk migrations confirm
> `0057_target_intelligence.sql` (target_photos / target_vehicles / target_locations),
> `0056_target_intel_profile.sql` (cases target-profile columns), `0060_locations_improved.sql`
> (location_name / maps_url), and `0065_ai_case_intake.sql` (target_relationships + cases email/
> socials/dob). Citations below use the verified on-disk numbers.

---

## Divergence classes (as defined for this audit)

| Class | Meaning | Functional risk |
|---|---|---|
| **A** | Type-fidelity: a DB `smallint`/`bigint`/`numeric`/`real`/`integer`/`double precision` column is mirrored as TS `number`; an enum/CHECK-backed column is mirrored as a TS union. Structural narrowing/widening only. | Low — TS has one `number`; precision/width is not expressible. Expected and acceptable. |
| **B** | Enum-VALUE drift: the TS union's concrete values do not match the DB enum / CHECK value list. | Medium–High depending on whether the missing/extra value can appear at runtime. |
| **C** | Enum-vs-CHECK representation: a TS union tracks a **text + CHECK** column (not a real PG enum) by eye, so it can silently rot when the CHECK changes. | Medium — no enum to regenerate from; FUT-1's generated types will surface these as `string`, not a union. |
| **D** | Stale / rot-prone hand-provenance comments baked into the type (migration numbers, "decrypted on server", etc.). Not a structural drift but a maintenance hazard. | Low. |
| **E** | Naming / coverage divergence to confirm against a specific migration CHECK (the union is wider/narrower than the DB constraint). | Medium. |

---

## 1. Full inventory — string-literal unions (17)

| # | TS union (line) | DB object | Source migration | Class | Severity | Notes |
|---|---|---|---|---|---|---|
| 1 | `UserRole` (7) | enum `user_role` | 0001 | A | Low | Exact match: admin/supervisor/agent/client. |
| 2 | `AgentStatus` (9) | CHECK on `agents.status` (text) | 0030 | C | Low | online/moving/idle/offline/emergency — matches CHECK. Was enum `agent_status`, dropped 0030; now text+CHECK. Generated types will emit `string`. |
| 3 | `AgentRole` (16) | CHECK on `agents.agent_role` (text, nullable) | 0030 | C | Low | field_agent/supervisor/team_leader/operations — matches CHECK. Generated → `string \| null`. |
| 4 | `AgentVehicleType` (22) | CHECK on `agents.vehicle_type` (text, nullable) | 0028→0030 | C | Low | car/motorcycle/foot — matches CHECK. Generated → `string \| null`. |
| 5 | `CaseStatus` (24) | enum `case_status` | 0001 + `cancelled` 0020 | A | Low | Exact match incl. `cancelled`. |
| 6 | `CasePriority` (25) | enum `case_priority` | 0001 | A | Low | Exact match. |
| 7 | `EvidenceType` (26) | enum `evidence_type` | 0001 | A | Low | Exact match: photo/video/pdf/document/audio. |
| 8 | `ExpenseCategory` (27) | enum `expense_category` | 0001 + 0052 (+0053 data) | **B** | **Medium (latent)** | **DRIFT — see §3.1.** Union OMITS `food` and `hotel` which still exist in the PG enum. |
| 9 | `ExpenseStatus` (36) | enum `expense_status` | 0054 | A | Low | pending/paid/reimbursed/cancelled — exact. |
| 10 | `PayrollStatus` (37) | enum `payroll_status` | 0055 | A | Low | pending/paid/cancelled/adjusted — exact. |
| 11 | `AlertStatus` (38) | enum `alert_status` | 0001 | A | Low | active/acknowledged/resolved — exact. |
| 12 | `GpsProvider` (39) | enum `gps_provider` | 0022 + `GPS903` 0035 | A | Low | AIS/TRUE/DTAC/GPS903 — exact. |
| 13 | `InvoiceStatus` (40) | enum `invoice_status` | 0015 | A | Low | draft/sent/paid/overdue — exact. |
| 14 | `NotificationType` (48) | enum `notification_type` | 0001 | A | Low | emergency/case/report/assignment/system — exact. (`report` retained though reports tables dropped 0051 — the enum value still exists.) |
| 15 | `RelationKind` (140) | CHECK-less `target_relationships.relation` (text, default `associate`) | 0065 | C/E | Medium | spouse/partner/friend/associate/family/other. schema.md lists the same 6 as the column comment, but the migration column is **plain text with NO CHECK** (verified — see §3.4 method). Union is app-enforced only; generated → `string`. |
| 16 | `LocationType` (396) | CHECK-less `target_locations.location_type` (text, default `other`) | 0057 | **E** | **Medium** | **DRIFT — see §3.3.** Union is home/workplace/school/gym/other; DB column is free text, comment says only `home/workplace/other`. |
| 17 | `IntakeImageKind` (545) + `IntakeDocKind` (553) | **none** — AI extraction contract | 0065 (prompt only) | n/a | n/a | NOT a DB object. App/AI contract. Must survive FUT-1 (see §4). |

> Inline anonymous unions also present (counted under their parent row interface, not as named
> unions): `GpsDevice.last_locate_mode` `"gps"|"lbs"|"offline"|"unknown"` (matches CHECK 0043, class
> C); `GeofenceEvent.event_type` `"enter"|"exit"` (matches CHECK 0028, class C);
> `IntakeLocation.type` `"home"|"workplace"|"other"` (AI contract, narrower than `LocationType` — by
> design, not drift).

---

## 2. Full inventory — row / object interfaces (31)

"Mirror?" = does this interface mirror one DB table row? "Survive FUT-1?" = must it be retained as a
hand-authored type when generated `Tables<T>['Row']` lands (see §4).

| # | TS interface (line) | DB table | Source migration | Mirror? | Class(es) | Severity | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `InvoiceLineItem` (42) | (jsonb shape of `invoices.line_items`) | 0015 | No (jsonb) | A | Low | Shape of a jsonb array element; generated types emit `Json`. Retain. |
| 2 | `Profile` (55) | `profiles` | 0001/0012/0018 | Yes | A | Low | 1:1. `role: UserRole`. Clean. |
| 3 | `Agent` (67) | `agents` | 0001/0013/0028/0030/0035 | Yes | A, C | Low | numerics→`number` (battery_pct smallint, speed_kmh real, heading smallint); status/agent_role/vehicle_type are text+CHECK (class C). |
| 4 | `Client` (92) | `clients` | 0001 | Yes | — | Low | 1:1. Clean. |
| 5 | `Case` (104) | `cases` | 0001/0007/0008/0056/0065 | Yes | A, D | Low | `target_age` smallint→`number`. Carries provenance comments (class D — see §3.5). Encrypted `*_enc`/`*_bidx` correctly mirrored as `string\|null`; plaintext target PII correctly absent (§6). |
| 6 | `TargetRelationship` (148) | `target_relationships` | 0065 | Yes | C, D | Low | `relation: RelationKind` (class C). Server-decorated `name?` (§4). Comment "decrypted on the server" (class D). |
| 7 | `GpsDevice` (161) | `gps_devices` | 0022 + many | Yes | A, C, D | Low | Many `numeric`/`integer`→`number` (last_lat/lng numeric(10,6), last_speed_kmh numeric(6,2), etc.). `last_locate_mode` inline union (class C). Heavy provenance comments (class D). `traccar_id` correctly absent (dropped 0064). |
| 8 | `GpsDevicePosition` (190) | `gps_device_positions` | 0039/0040 | Yes | A | Low | numeric(10,6)/numeric(6,2)/integer → `number`. |
| 9 | `GpsDeviceAccess` (201) | `gps_device_access` | 0039/0040 | Yes | — | Low | 1:1. |
| 10 | `GpsDeviceAccessWithProfile` (209) | **composed** (`gps_device_access` + joined `profiles`) | — | No (join) | — | — | **Survive FUT-1** (§4). |
| 11 | `GpsDeviceForMap` (214) | **enriched** (`gps_devices` + case_number + cred_*) | — | No (view-ish) | — | — | **Survive FUT-1** (§4). |
| 12 | `Gps903Device` (222) | `gps903_devices` | 0038/0040 | Yes | A | Low | `gps903_device_id` integer→`number`. |
| 13 | `Gps903Credential` (235) | `gps903_credentials` | 0041/0042/0046 | Yes (redacted) | — | Low | **`device_password` intentionally OMITTED** — correct (§6). `gps903_device_id` integer→`number`. |
| 14 | `CaseWithAgents` (251) | **composed** (`Case` + `agents[]`) | — | No (join) | — | — | **Survive FUT-1** (§4). |
| 15 | `LinkedEvidence` (255) | `evidence` + `signedUrl` | 0001/0049 | Partial | A | Low | Server-decorated **required** `signedUrl: string` (§4). `file_size` bigint→`number` (class A — bigint precision caveat). |
| 16 | `TimelineEntry` (270) | `timeline_entries` | 0001/0034 | Yes (+decorated) | A | Low | `lat/lng` double precision→`number`. `linked_evidence?` decorated array (§4). |
| 17 | `Evidence` (290) | `evidence` | 0001/0049 | Yes | A | Low | `file_size` bigint→`number` (class A caveat). |
| 18 | `Expense` (305) | `expenses` | 0001/0011/0053/0054 | Yes | A, C, **B-adjacent** | Medium | `category: ExpenseCategory` carries the §3.1 drift. `amount` numeric(12,2), `vat_amount` numeric(10,2), `ocr_confidence` smallint → `number`. `source: string` (DB is text+CHECK manual/ocr — class C, but typed as plain `string` here, looser than the union pattern). **`ocr_raw` jsonb column OMITTED** from the type — see §3.6. |
| 19 | `ExtractedExpense` (330) | **none** — OCR/AI contract | 0053-era | No (AI) | — | — | **Survive FUT-1** (§4). `category: ExpenseCategory` (inherits §3.1). |
| 20 | `AgentPayment` (351) | `agent_payments` | 0055 | Yes | A, C | Low | `amount` numeric→`number`; `status: PayrollStatus`. |
| 21 | `TargetPhoto` (367) | `target_photos` | 0057 | Yes (+decorated) | — | Low | `signedUrl?` decorated (§4). |
| 22 | `TargetVehicle` (378) | `target_vehicles` | 0057 | Yes (+decorated) | — | Low | `licensePlate?`, `photoSignedUrl?` decorated (§4). Encrypted plate correctly `*_enc`/`*_bidx`. |
| 23 | `TargetLocation` (398) | `target_locations` | 0057/0060 | Yes (+decorated) | A, **E** | Medium | `location_type: LocationType` carries §3.3 drift. `lat/lng` double precision→`number`. `address?`, `photoSignedUrl?` decorated (§4). |
| 24 | `EmergencyAlert` (417) | `emergency_alerts` | 0001 | Yes | A | Low | `status: AlertStatus`; lat/lng→`number`. |
| 25 | `Notification` (430) | `notifications` | 0001 | Yes | A | Low | `type: NotificationType`. |
| 26 | `AuditLog` (441) | `audit_logs` | 0001 | Yes | A | Low | `id: number` mirrors `bigserial` (class A — bigint precision caveat; generated may emit `number`). `metadata: Record<string,unknown>` mirrors jsonb (generated → `Json`). `ip_address` inet→`string`. |
| 27 | `Invoice` (452) | `invoices` | 0015/0017/0026/0027 | Yes | A | Low | `line_items: InvoiceLineItem[]` (jsonb→typed array; generated → `Json`). `amount` numeric→`number`. `status: InvoiceStatus`. |
| 28 | `EnrichedUser` (475) | **enriched** (`Profile` + auth.users fields + agent fields) | — | No (composed) | — | — | **Survive FUT-1** (§4). `last_sign_in_at`/`otp_verified` come from `auth.users`/auth, not a public table. |
| 29 | `AgentLocationHistory` (483) | `agent_location_history` | 0028 | Yes | A | Low | speed_kmh real, heading smallint → `number`. |
| 30 | `Geofence` (493) | `geofences` | 0028 | Yes | A | Low | `coordinates: Array<{lat;lng}>` mirrors jsonb (generated → `Json`). |
| 31 | `GeofenceEvent` (506) | `geofence_events` | 0028 | Yes | A, C | Low | `event_type` inline union (CHECK 0028, class C); lat/lng→`number`. |
| 32 | `VehiclePhoto` (516) | `vehicle_photos` | 0059 | Yes (+decorated) | — | Low | `signedUrl?` decorated (§4). |
| 33 | `CaseMessage` (527) | `case_messages` | 0058 | Yes | — | Low | 1:1. (DB has CHECK body length 1–2000; not expressible in TS — class A-ish, ignore.) |
| 34 | `CaseMessageWithSender` (536) | **composed** (`case_messages` + joined `profiles`) | — | No (join) | — | — | **Survive FUT-1** (§4). |
| 35–43 | `IntakeSocial`, `IntakeTarget`, `IntakeVehicle`, `IntakeLocation`, `IntakeRelationship`, `IntakeTimelineEvent`, `IntakeDocument`, `IntakeImageClassification`, `IntakeExtraction`, `IntakeStagedFile`, `IntakeAnalyzeResult` (561–661) | **none** — AI extraction contract | 0065 (prompt only) | No (AI) | — | — | **Survive FUT-1** (§4). Edited on the review screen before any DB write; these are NOT row mirrors. |

**Inventoried totals:** **17 named string-literal unions** + **~31 row/object interfaces**
(43 named interfaces total when the 11 `Intake*`/contract interfaces and 4 composed/enriched
interfaces are counted). Plus 3 inline anonymous unions noted under §1.

---

## 3. Concrete drift findings (called out explicitly)

### 3.1 — `ExpenseCategory` OMITS legacy enum values `food` / `hotel` (Class B, latent)

`src/lib/types.ts` lines 27–35:

```
fuel | toll | parking | meals | accommodation | transportation | office | misc
```

The PG type `expense_category` (enums.md) actually contains, **in order**:

```
fuel, toll, parking, food, hotel, misc, meals, accommodation, transportation, office
```

i.e. the DB enum still defines **`food`** and **`hotel`**, which the TS union does not list.
Confirmed against `0001_initial_schema.sql:18` (`fuel,toll,parking,food,hotel,misc`) and
`0052_expense_ocr_fields.sql:6–9` (`meals`, `accommodation`, `transportation`, `office` added).

**Why this is latent, not an active runtime error:** `0053_expense_ocr_columns.sql:6–7` migrated all
existing data off the legacy values
(`UPDATE expenses SET category='meals' WHERE category='food'` and
`...='accommodation' WHERE category='hotel'`). Postgres cannot drop enum values, so `food`/`hotel`
remain **defined but unused** — no live row carries them, so no row read will ever produce a value
outside the TS union. This is a **type-vs-enum definition divergence**, not a runtime type hole.

**Routing (ARCH-3 documents only):**
- DB-side enum value cleanup (the only safe path being a type recreation, since PG cannot remove a
  value) → **TD-10**.
- Type reconciliation (a `supabase gen types` run will emit the union **with** `food`/`hotel`,
  re-widening the generated type) → **FUT-1**. FUT-1 must decide whether to keep the generated
  (wider, DB-faithful) union or layer an app-narrowed alias.

### 3.2 — `report_status` enum present in DB but ABSENT from types.ts → CORRECT (not drift)

The PG enum `report_status` (`draft/submitted/approved/rejected/review`) still exists (orphaned;
the `reports`/`report_versions` tables were dropped CASCADE in `0051`, the enum was never dropped —
enums.md). `types.ts` has **no** `ReportStatus` union and no `Report` interface. This is the
**correct** state: nothing in the app references a non-existent table. **Record as "correct, not
drift."** Relates to **TD-9** (the orphaned enum/table cleanup tracking item). ARCH-3 takes no action.

### 3.3 — `TargetLocation.location_type` union wider than the DB (Class E)

`src/lib/types.ts` line 396:

```
export type LocationType = "home" | "workplace" | "school" | "gym" | "other";
```

**Verified against migrations** (not just schema.md): `0057_target_intelligence.sql:48` declares

```
location_type text NOT NULL DEFAULT 'other', -- 'home' | 'workplace' | 'other'
```

— a **plain `text` column with NO CHECK constraint**, only a code comment listing three values.
`0060_locations_improved.sql` adds `location_name`/`maps_url` and does **not** add a CHECK.

So: the DB enforces nothing (any string is accepted); the column comment names 3 values; the TS
union names 5 (`school` and `gym` are extra). This is a **class E** divergence: the union is wider
than the column's documented intent and, because there is no CHECK to regenerate from, FUT-1's
generated type will collapse this to plain **`string`**. ARCH-3 documents only. FUT-1 should decide
whether `school`/`gym` are intended product values (then add a DB CHECK via a future migration, route
to TD) or app-only conveniences (retain a hand union over the generated `string`).

### 3.4 — `RelationKind` tracks a CHECK-less text column (Class C/E)

`target_relationships.relation` is `text NOT NULL DEFAULT 'associate'` with **no CHECK** (verified;
`0065_ai_case_intake.sql` creates the table, schema.md line 230 lists the 6 values only as a
column comment). `RelationKind` (6 values) is therefore app-enforced only; generated types → `string`.
Same handling note as §3.3 — FUT-1 decides retain-union vs add-CHECK (TD).

### 3.5 — Stale/rot-prone provenance comments baked into types (Class D)

Several interfaces carry migration-number/behavior comments that will rot and that the generated
types will not reproduce:
- `Case` (110, 119): `// encrypted PII — plaintext columns dropped in migration 0008`,
  `// additional target profile fields (migration 0065)`.
- `GpsDevice` (173, 181–183): denormalization + per-field `deviceUtcDate`/`stopTimeMinute`/ACC notes.
- `TargetRelationship` (157): `/** decrypted on the server for display */`.
- `Gps903Credential` (239): `// device_password intentionally absent — never sent to the browser`.

These are documentation, not structural drift (severity Low), but FUT-1 should preserve the
**security-relevant** ones (the `device_password` omission rationale, the "decrypted on server"
notes) somewhere when the generated types replace the hand mirrors — they encode intent the
generator cannot.

### 3.6 — Columns present in DB but OMITTED from the mirror

- `expenses.ocr_raw` (jsonb, 0053) is **not** present on the `Expense` interface (which otherwise
  mirrors the OCR fields). Likely deliberate (raw OCR blob not needed client-side). Flag for FUT-1:
  the generated `Tables<'expenses'>['Row']` **will** include `ocr_raw: Json`, so any code newly
  switched to the generated type gains the field — confirm no consumer assumed its absence.
- `Expense.source` is typed as plain `string` while the DB is `text` + CHECK `('manual','ocr')` —
  looser than the project's union convention (class C, minor inconsistency; not a runtime risk).

No other column-level divergences were found: `cases` target-profile/encrypted columns, `gps_devices`
denormalized position columns, and the finance soft-delete columns all match the mirror.

---

## 4. Non-table-mirror inventory — MUST survive the FUT-1 cutover

These types are **not** row mirrors of a single table and therefore **must not be deleted** when
FUT-1 swaps importers to generated `Tables<T>['Row']`. Generated types only cover real tables/views;
deleting these with the swap would break the AI intake pipeline, joined queries, and server-decorated
surfaces.

**(a) AI / extraction contracts (lines 330–349, 540–661):** `ExtractedExpense`, and the entire
`Intake*` block — `IntakeImageKind`, `IntakeDocKind`, `IntakeSocial`, `IntakeTarget`,
`IntakeVehicle`, `IntakeLocation`, `IntakeRelationship`, `IntakeTimelineEvent`, `IntakeDocument`,
`IntakeImageClassification`, `IntakeExtraction`, `IntakeStagedFile`, `IntakeAnalyzeResult`. These are
the Claude forced-tool-use return shapes, edited on the review screen **before** any DB write — they
deliberately do not match any table.

**(b) Composed / enriched / view-shaped types:** `GpsDeviceAccessWithProfile` (line 209),
`GpsDeviceForMap` (214), `CaseWithAgents` (251), `EnrichedUser` (475 — adds `auth.users` +
agent fields), `CaseMessageWithSender` (536). These join or decorate multiple tables.

**(c) Server-decorated optional/required fields on otherwise-mirroring interfaces** — these fields
do **not** exist as DB columns and must be re-applied (via an `& { ... }` decoration or wrapper type)
on top of any generated base:
- `LinkedEvidence.signedUrl: string` (required) and `TargetPhoto.signedUrl?`,
  `VehiclePhoto.signedUrl?`, `TargetVehicle.photoSignedUrl?`, `TargetLocation.photoSignedUrl?`.
- `TargetVehicle.licensePlate?` and `TargetLocation.address?` and `TargetRelationship.name?` —
  server-side **decrypted** plaintext of the `*_enc` columns (never a DB column).
- `TimelineEntry.linked_evidence?: LinkedEvidence[]` (joined array).

**(d) jsonb-shape helper:** `InvoiceLineItem` — describes the element shape of a jsonb column;
generated types will type the column as `Json`, so this hand shape stays useful and should be retained.

---

## 5. Remediation plan handed to FUT-1

**Recommended generate command** (already noted at the top of `types.ts`, lines 3–4):

```
supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```

(or `--linked` / `--local` per the CLI setup; requires live DB / CLI access, hence the deferral.)

**(i) Map 1:1 to generated `Tables<T>['Row']`** (replace the hand interface with a
`type X = Tables<'table'>['Row']` alias, modulo the class-A `number`/`Json` widening the generator
applies): `Profile`, `Agent`, `Client`, `Case`, `TargetRelationship`(base), `GpsDevice`(base),
`GpsDevicePosition`, `GpsDeviceAccess`, `Gps903Device`, `Gps903Credential`(see caveat),
`Evidence`, `TimelineEntry`(base), `Expense`(base), `AgentPayment`, `TargetPhoto`(base),
`TargetVehicle`(base), `TargetLocation`(base), `EmergencyAlert`, `Notification`, `AuditLog`,
`Invoice`, `AgentLocationHistory`, `Geofence`, `GeofenceEvent`, `VehiclePhoto`(base),
`CaseMessage`. **(base)** = swap the row part, then re-apply the §4(c) decorations on top.

  - **Caveat — `Gps903Credential`:** the generated row WILL include `device_password`. FUT-1 must
    **`Omit<Tables<'gps903_credentials'>['Row'], 'device_password'>`** (and similarly never select it)
    to preserve the current, correct redaction (§6). Do not blindly alias.
  - **Caveat — `Expense`:** generated row includes `ocr_raw` (§3.6); decide keep vs `Omit`.
  - **Class-C unions become `string`:** `AgentStatus`, `AgentRole`, `AgentVehicleType`,
    `RelationKind`, `LocationType`, `GpsDevice.last_locate_mode`, `GeofenceEvent.event_type`,
    `Expense.source` are text+CHECK, so generated types emit `string`. FUT-1 decides per field
    whether to keep the hand union (layer it over the generated base) or accept `string`.

**(ii) Generated `Insert` / `Update` variants — currently MISSING.** `types.ts` defines **no**
insert/update shapes at all (every interface is a read/row shape; writes are done untyped or via
ad-hoc objects). FUT-1's generator produces `Tables<T>['Insert']` and `Tables<T>['Update']` for
free — adopting them is a net-new capability, not a 1:1 replacement, and is the highest-value part
of the cutover for write-path safety. Recommend FUT-1 introduce `Insert`/`Update` aliases for at
least the high-write tables (`cases`, `expenses`, `timeline_entries`, `evidence`, `agent_payments`,
`invoices`, `case_messages`, `target_*`).

**(iii) Retain as hand-authored app types** (do not derive from generated): everything in §4 —
the `Intake*` contract block, `ExtractedExpense`, the composed/enriched types
(`GpsDeviceAccessWithProfile`, `GpsDeviceForMap`, `CaseWithAgents`, `EnrichedUser`,
`CaseMessageWithSender`), the server-decoration fields, and `InvoiceLineItem`.

**(iv) Open product decisions for FUT-1 (each may spawn a TD migration):** `food`/`hotel` enum
re-widening (§3.1 / TD-10); `school`/`gym` location types (§3.3); `RelationKind` CHECK (§3.4).

---

## 6. Security note

- This audit pastes **no** secret, credential, token, or plaintext-PII *value*. The only literal
  strings reproduced are enum value names (e.g. `food`, `meals`, `home`) and column **names** — no
  data.
- **Encrypted (`*_enc`) and credential columns are correctly absent / correctly shaped in the
  mirror, and must stay that way after FUT-1:**
  - `gps903_credentials.device_password` (a stored credential) is **deliberately omitted** from
    `Gps903Credential` (types.ts line 239). The generated row would include it — FUT-1 must `Omit`
    it (§5(i) caveat). Confirmed correct.
  - All `*_enc` columns (`cases.target_*_enc`, `target_vehicles.license_plate_enc`,
    `target_locations.address_enc`, `target_relationships.name_enc`) are mirrored as opaque
    `string | null` ciphertext — the decrypted plaintext is only ever present as the server-decorated
    optional fields (`name?`, `licensePlate?`, `address?`), never as a base column. Correct and must
    be preserved.
  - The `*_bidx` blind-index columns are correctly mirrored as plaintext `string | null` (they are
    HMAC indexes, not ciphertext, and carry no recoverable PII).
  - Service-role-only tables not modeled in `types.ts` (`gps903_session`,
    `gps903_credential_sessions`, `case_message_views`, `case_agents`, `device_tokens`, `gps_tokens`,
    `ai_prompts`/`ai_prompt_versions`) are out of the client-facing mirror by design — no drift, and
    FUT-1 need not surface their session-cookie / bearer-token columns to the browser layer.

---

## 7. Summary

- **Types inventoried:** 17 named string-literal unions + ~31 row/object interfaces (43 named
  interfaces in total, incl. the 11 `Intake*`/contract types and 4 composed/enriched types) + 3
  inline anonymous unions.
- **Drift by class:** mostly **Class A** (type-fidelity numeric→`number`, enum→union — expected,
  low risk) across nearly every row interface. **Class B:** 1 — `ExpenseCategory` missing
  `food`/`hotel` (latent, no live rows → not a runtime error; → TD-10 + FUT-1). **Class C:** 8
  text+CHECK / CHECK-less fields tracked as unions that generated types will collapse to `string`
  (`AgentStatus`, `AgentRole`, `AgentVehicleType`, `RelationKind`, `LocationType`,
  `last_locate_mode`, `event_type`, `Expense.source`). **Class D:** 4 interfaces carry rot-prone
  provenance comments. **Class E:** `TargetLocation.location_type` union (5 values) is wider than the
  DB column (free text, comment lists 3) — verified no CHECK exists.
- **`report_status`:** correctly absent from types.ts — recorded as **not drift** (relates to TD-9).
- **Non-table-mirror types flagged for FUT-1 survival (must NOT be deleted on cutover):** the AI
  contract block (`ExtractedExpense`, `IntakeImageKind`, `IntakeDocKind`, `IntakeSocial`,
  `IntakeTarget`, `IntakeVehicle`, `IntakeLocation`, `IntakeRelationship`, `IntakeTimelineEvent`,
  `IntakeDocument`, `IntakeImageClassification`, `IntakeExtraction`, `IntakeStagedFile`,
  `IntakeAnalyzeResult`), the composed/enriched types (`GpsDeviceAccessWithProfile`,
  `GpsDeviceForMap`, `CaseWithAgents`, `EnrichedUser`, `CaseMessageWithSender`), the jsonb shape
  `InvoiceLineItem`, and all server-decoration fields (`signedUrl`, `photoSignedUrl?`, `name?`,
  `licensePlate?`, `address?`, `linked_evidence?`).
- **Security:** no secrets/PII values pasted; `device_password` and `*_enc` columns confirmed
  correctly absent/opaque and flagged so FUT-1 keeps them that way.
- **Source-code changes:** none (audit doc only).
</content>
</invoke>
