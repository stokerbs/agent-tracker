# Gate Sign-off Record — FUT-1

**Task:** FUT-1 — Adopt generated Supabase DB types to replace the hand-mirrored `src/lib/types.ts` (the file's own header recommends `supabase gen types`)
**Backlog item:** FUT-1 (P1, Future Enhancements; directional counterpart to ARCH-3 / Register #5)
**Builder:** data-migration-author — generated-types cutover, COMPLETE
**Date:** 2026-06-25
**Change set:** 2 source files — `src/lib/database.types.ts` (NEW, CLI-generated) and `src/lib/types.ts` (rewritten as a thin alias surface). `npx tsc --noEmit` and `npm run lint` both exit 0. 98 importers UNCHANGED.

## Scope

FUT-1 is the implementation counterpart to the ARCH-3 audit: it cuts the project over from a 661-line hand-mirrored `src/lib/types.ts` to Supabase CLI-generated types, eliminating the hand-mirror drift that ARCH-3 catalogued. The ARCH-3 drift audit (`.claude/audits/ARCH-3-types-drift-audit.md`) was the input/remediation plan; this run executed that plan. No database, migration, RLS, or runtime behavior changed — this is a type-surface cutover only.

## Files changed (2)

1. **`src/lib/database.types.ts`** — NEW. CLI-generated (2117 lines), NOT hand-edited. Generated via:
   ```
   supabase gen types typescript --linked --schema public
   ```
   with **Supabase CLI 2.106.0**. QA verified the committed file is **byte-identical to a fresh regen** (integrity proven; no hand-editing slipped in). (Currently untracked on disk — a `feature/*` PR must `git add` this file.)
2. **`src/lib/types.ts`** — rewritten as a thin alias surface over the generated `Database` type: `Row<T>` / `Enums<T>` helpers re-export the generated row/enum shapes. All previously exported names are preserved, so all 98 importers are unchanged.

## How the ARCH-3 audit handoff was honored

The ARCH-3 audit defined three things the cutover had to respect; each was carried through:

- **Must-survive non-table-mirror set (preserved as app-only types, not replaced by generated output):** the AI intake/extraction contract block (`ExtractedExpense`, `IntakeImageKind`, `IntakeDocKind`, `IntakeSocial`, `IntakeTarget`, `IntakeVehicle`, `IntakeLocation`, `IntakeRelationship`, `IntakeTimelineEvent`, `IntakeDocument`, `IntakeImageClassification`, `IntakeExtraction`, `IntakeStagedFile`, `IntakeAnalyzeResult`); composed/enriched types (`GpsDeviceAccessWithProfile`, `GpsDeviceForMap`, `CaseWithAgents`, `EnrichedUser`, `CaseMessageWithSender`); the `InvoiceLineItem` jsonb shape; and the hand unions `AgentStatus` / `AgentRole` / `AgentVehicleType` / `RelationKind` / `LocationType`.
- **Drift-class re-application as overrides:** server-decoration fields (`signedUrl`, `photoSignedUrl?`, `name?`, `licensePlate?`, `address?`, `linked_evidence?`) and the class-C narrowing unions were re-applied as explicit overrides on top of the generated rows (generated types collapse CHECK/text columns to `string`; the narrowing unions restore the app's intended contracts).
- **Credential / opaque-column boundary:** `device_password` is **Omitted** from the surfaced type (load-bearing per the security gate); the `*_enc` encrypted columns and `*_bidx` blind-index columns remain opaque; service-role-only tables are not surfaced to the client-facing layer. The cutover did not bypass or relax this boundary.

## Drift dispositions of note

- **ExpenseCategory re-widening → TD-10.** Because the generated enum is DB-faithful, `ExpenseCategory` now (correctly) includes the legacy `food` / `hotel` values that the prior hand-type had dropped (ARCH-3 Class B). This is expected: the type now matches the live PG `expense_category` enum. The DB-side enum cleanup (dropping the legacy values, whose data was migrated off in migration 0053) remains tracked as **TD-10** and is out of FUT-1's scope.
- **Profile.email narrowing.** The one LOW item raised at the security gate — `Profile.email` narrowing — was routed to and resolved by QA: the alias surface preserves the PRIOR hand-type contract for `Profile.email` (it is an intentional narrowing carried over, **not** a regression introduced by the cutover).
- **ARCH-3 erratum.** The ARCH-3 audit's non-blocking summary-count erratum (it undercounted the type inventory) is noted; it had no bearing on the cutover, which worked from the per-type body of the audit.

## Gate summary

| Gate | Agent | Verdict |
|---|---|---|
| 1 — Security | security-reviewer | **APPROVED** — `device_password` Omit is load-bearing and not bypassed; `*_enc` / `*_bidx` columns opaque; service-role tables not surfaced; no DB/migration change; no embedded secrets. One LOW item (Profile.email narrowing) routed to and resolved by QA. |
| 2 — QA | qa-test-engineer | **APPROVED** — `tsc --noEmit` + lint exit 0; `database.types.ts` byte-identical to a fresh regen (integrity proven); zero importer churn (98 importers unchanged); all must-survive types preserved; alias narrowing intact; Profile.email narrowing preserves the PRIOR hand-type contract (not a regression). |
| Release | release-manager | **LOCAL DONE / PENDING PR (GO, conditioned)** — merge-ready; no FUT-1 PR exists; no commits/PRs created. Authorized for a future `feature/*` PR under the conditions below. |

## Release conditions for the future `feature/*` PR

1. Cut a new `feature/fut-1-generated-db-types` branch off `main`.
2. `git add` **both** `src/lib/types.ts` (modified) **and** the currently-untracked `src/lib/database.types.ts` (new).
3. Exclude unrelated working-tree files: ARCH-1 chart types (`src/lib/dashboard-charts.types.ts`), ARCH-2/3 `.claude/` artifacts, and `PROJECT_BACKLOG.md`.
4. Pin Supabase CLI **2.106.0** for any regen in CI / review (the byte-identical-regen integrity check depends on the same CLI version).
5. Carry both gate sign-offs (security APPROVED + QA APPROVED) and the **TD-10** reference (ExpenseCategory `food`/`hotel` DB cleanup) into the PR body.

(Branch-naming note carried from ARCH-1/ARCH-2 process flags: `PROJECT_RULES.md` documents `feature/*`; use that prefix, not `feat/*`.)

## Newly unblocked

- No backlog item lists **FUT-1** in its Dependencies column — sweeping the Dependencies column across all sections yields zero downstream gated tasks. FUT-1 therefore unblocks nothing further.
- FUT-1 completes the **ARCH-3 → FUT-1 generated-types arc**: ARCH-3 (the read-only drift audit) produced the remediation plan; FUT-1 implemented the cutover it specified.

## Disposition

**LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) — PENDING PR (no commit/PR yet; release-authorized for a `feature/*` PR per the conditions above).** Generated-types cutover, no DB/behavior change. No git commit/PR created for this run. FUT-1's `Current Status` (and note) and the Summary per-status counts have been updated in `PROJECT_BACKLOG.md`.
