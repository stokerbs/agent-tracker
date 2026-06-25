# Gate Sign-off Record — ARCH-3

**Task:** ARCH-3 — Hand-mirrored `lib/types.ts` (661 lines) drifting from 69 migrations (header recommends generated types)
**Backlog item:** ARCH-3 (P1, Register #5) — Architecture Improvements
**Builder:** data-migration-author — audit-only deliverable, COMPLETE
**Date:** 2026-06-25
**Change set:** 0 `.ts` source files. Single deliverable artifact: `.claude/audits/ARCH-3-types-drift-audit.md`. `npx tsc --noEmit` and `npm run lint` both exit 0 (baseline unchanged — nothing was modified).

## Scope

ARCH-3 is a read-only audit that catalogs the hand-maintained `src/lib/types.ts` against the migration-derived PostgreSQL schema and classifies every point of drift, so that the forward-looking cutover to generated Supabase types (FUT-1) has a concrete, verified remediation plan to work from. It is explicitly **not** a code change: no interface, union, import, or behavior in `types.ts` was touched. The deliverable inventories 45 interfaces + 18 unions (see erratum below on the audit's own summary arithmetic) and assigns each a drift class A–E.

## Single deliverable artifact

- **`.claude/audits/ARCH-3-types-drift-audit.md`** — full inventory + drift classification + FUT-1 remediation handoff. (Under `.claude/`, which is untracked but **not** gitignored; there is no separate PR for this work.)

## Drift summary by class

- **Class A (type-fidelity, expected, low risk):** numeric columns → `number`, PG enums → string-literal unions, across nearly every row interface. Inherent to the hand-mirror approach; generated types will normalize these.
- **Class B (latent value omission):** 1 — `ExpenseCategory` omits legacy `food`/`hotel`, which are still defined in the PG `expense_category` enum. Latent only: data was migrated off these values in migration 0053, so there are no live rows and no runtime error. DB-side enum cleanup routed to **TD-10**; the omission also carries into FUT-1.
- **Class C (CHECK / CHECK-less text tracked as union → will collapse to `string` under generated types):** 8 fields — `AgentStatus`, `AgentRole`, `AgentVehicleType`, `RelationKind`, `LocationType`, `GpsDevice.last_locate_mode`, `event_type`, `Expense.source`.
- **Class D (rot-prone provenance):** 4 interfaces carry migration-number/behavior comments that will go stale and that generated types will not reproduce.
- **Class E (union wider than DB column):** `TargetLocation.location_type` — the union lists 5 values, but the underlying column is free `text` with **no CHECK** (the 0057 column is `text`, no constraint; comment lists 3). Verified no CHECK exists.
- **Other findings:** `expenses.ocr_raw` (jsonb) is omitted from the `Expense` interface. `report_status` is **correctly absent** from `types.ts` (recorded as **not drift**; relates to TD-9 — orphaned enum after `reports` dropped in 0051).

Raw migrations verified during the audit: 0001 / 0052 / 0053 / 0057 / 0065.

## FUT-1 boundary (must-survive non-table-mirror types)

The audit flags the types that are NOT row mirrors and therefore **must survive the FUT-1 generated-types cutover** (they cannot be deleted/replaced by `supabase gen types` output):

- **AI intake/extraction contract block:** `ExtractedExpense`, `IntakeImageKind`, `IntakeDocKind`, `IntakeSocial`, `IntakeTarget`, `IntakeVehicle`, `IntakeLocation`, `IntakeRelationship`, `IntakeTimelineEvent`, `IntakeDocument`, `IntakeImageClassification`, `IntakeExtraction`, `IntakeStagedFile`, `IntakeAnalyzeResult` (edited on the review screen before any DB write — not DB mirrors).
- **Composed / enriched types:** `GpsDeviceAccessWithProfile`, `GpsDeviceForMap`, `CaseWithAgents`, `EnrichedUser`, `CaseMessageWithSender`.
- **jsonb shape:** `InvoiceLineItem`.
- **Server-decoration fields:** `signedUrl`, `photoSignedUrl?`, `name?`, `licensePlate?`, `address?`, `linked_evidence?`.

**Security boundary carried into FUT-1:** `device_password` and the `*_enc` encrypted columns are confirmed correctly absent/opaque in `types.ts`; the audit instructs FUT-1 to keep them that way. Service-role-only tables (`gps903_session`, `gps903_credential_sessions`, `case_message_views`, `case_agents`, `device_tokens`, `gps_tokens`, `ai_prompts`/`ai_prompt_versions`) are intentionally outside the client-facing mirror — no drift, and FUT-1 need not surface their session-cookie / bearer-token columns to the browser layer.

## Gate summary

| Gate | Agent | Verdict |
|---|---|---|
| 1 — Security | security-reviewer | **APPROVED** — no secret/PII/credential values pasted; credential/encrypted columns (`device_password`, `*_enc`) kept opaque; FUT-1 guidance reinforces the security boundary; zero source change. |
| 2 — QA | qa-test-engineer | **APPROVED** — audit factually accurate against raw migrations (0001/0052/0053/0057/0065 verified); line citations accurate; non-table-mirror survival list correct; FUT-1 cutover correctly NOT performed; tsc + lint exit 0. |
| Release | release-manager | **GO — LOCAL DONE (audit-only; 0 source files)** — no separate PR (audit artifact under `.claude/`, untracked but not gitignored). ARCH-3 release-complete; FUT-1 now unblocked. |

## Non-blocking erratum (for FUT-1 to correct)

QA recorded one **NON-BLOCKING cosmetic erratum**: the audit's own summary label ("35–43" / "~31 row/object interfaces, 43 named interfaces total") undercounts the actual **45 interfaces + 18 unions**. Every type is individually named and classified in the body — only the summary arithmetic is off. No impact on the findings; FUT-1 should correct the summary count when it consumes the audit.

## Newly unblocked

- **FUT-1** (Future Enhancements; data-migration-author; directional counterpart to ARCH-3 / Register #5) — its sole dependency was ARCH-3. With ARCH-3 LOCAL DONE, FUT-1 has been moved **BACKLOG → READY** in `PROJECT_BACKLOG.md`, with its note updated to reference this drift audit as its input/remediation plan. (Not started — out of scope for this run.) No other backlog item lists ARCH-3 in its Dependencies column.

## Disposition

**LOCAL DONE (audit-only; 0 source files; security-APPROVED, QA-APPROVED) — release GO; no separate PR (audit artifact `.claude/audits/ARCH-3-types-drift-audit.md`).** No git commit/PR created for this run. ARCH-3's `Current Status` and FUT-1's status/note have been updated in `PROJECT_BACKLOG.md`; the Summary per-status counts were reconciled accordingly.
