# Detective Pulse — Project Backlog

**Purpose.** Single source of truth for all future engineering work. Every item is traceable back to a finding in one of the three source artifacts below. No item here is an invented work item; the only forward-looking entries live in **Future Enhancements** and are each grounded in an existing source finding.

**Source provenance.**
- **Technical Debt Register** (23 classified items, P0–P4) — the originating `Register #N` is cited on every backlog item.
- **Database Knowledge** — `.claude/knowledge/database/{schema,enums,indexes,functions,relationships,rls,triggers}.md`.
- **Architecture Inventory** — read-only survey of `src/` (`app/`, `components/`, `lib/`) + `supabase/`.
- **Project memory** — native app (Capacitor) push activation outstanding item.

**Status legend.**
- `BACKLOG` — captured, not yet scheduled.
- `READY` — fully specified by sources, no unmet dependencies.
- `IN PROGRESS` — a source evidences active work.
- `BLOCKED` — waiting on another unfinished item (blocker named).
- `DONE` — a source evidences completion.

**Sub-task qualifiers** (apply to sub-tasks recorded under a backlog item, never to the backlog item's own `Current Status`):
- `LOCAL DONE` — builder-complete and both gates (security-reviewer + qa-test-engineer) APPROVED, verified locally, but **not yet merged**.
- `PENDING PR` — Merge Status: no git commit/PR exists yet, so the release-manager has deferred final merge authorization until a live PR exists. A `LOCAL DONE` sub-task carries `PENDING PR` until merged.

**Owner-agent legend** (the 15 specialists referenced here):
`data-migration-author`, `backend-api-builder`, `frontend-builder`, `maps-geo-builder`, `native-app-builder`, `ai-engineer`, `security-reviewer`, `performance-engineer`, `qa-test-engineer`, `devops-engineer`, `operations-engineer`.

> Scope note: P0 tier is empty. No source establishes a confirmed, exploitable security or correctness defect. Items that "sound" P0 (the `gps903_session` stale-cookie surface; broad `createServiceClient` reach) are explicitly bounded by the sources as not-user-reachable / no-misuse-asserted and are filed at their evidenced severity (P1) under Security Improvements.

---

## 1. Active Features

The native push activation is the only in-flight feature evidenced by the sources (project memory: Capacitor Phase A+B code shipped via migrations 0068–0069; FCM env + native rebuild outstanding). The push transport code exists in `lib/push/` and `device_tokens`/`gps_tokens` tables exist (migrations 0068–0069), corroborating the Inventory. No other in-flight feature is evidenced; none invented.

| ID | Priority | Title | Owner Agent | Dependencies | Current Status |
|---|---|---|---|---|---|
| AF-1 | P1 | Native app push activation (FCM env + APNs config + native rebuild) — code shipped (migrations 0068–0069, `lib/push/` APNs+FCM), activation outstanding | native-app-builder | none | IN PROGRESS |

---

## 2. Technical Debt

P2 Maintainability and P4 Cleanup items.

| ID | Priority | Title | Owner Agent | Dependencies | Current Status |
|---|---|---|---|---|---|
| TD-1 | P2 | Duplicated Google Maps setup across `map/live-map.tsx` and `gps/gps-monitor-map.tsx` (from Register #8) | maps-geo-builder | TD-3 | BLOCKED — shares battery-helper duplication with TD-3 |
| TD-2 | P2 | GPS903 domain fragmentation across DB, lib, components, routes (from Register #9) | maps-geo-builder | TD-1, TD-4, TD-5 | BLOCKED — depends on TD-4 and TD-5 |
| TD-3 | P2 | Centralized `formatDate`/`formatCurrency`/`batteryColor` helpers bypassed (41 files raw `toLocale*`; ~7 inline `batteryColor`) (from Register #11) | frontend-builder | none | READY |
| TD-4 | P2 | `lib/gps903.ts` is a single 797-line integration file (from Register #10) | maps-geo-builder | none | BACKLOG |
| TD-5 | P2 | `gps903_devices` catalog has no FK to `gps_devices`/`gps903_credentials` (app-code-matched) (from Register #12) | data-migration-author | none | BACKLOG |
| TD-6 | P2 | Inconsistent component co-location and test-location conventions (8 components inside `app/`; tests split `lib/` vs `src/__tests__/`) (from Register #13) | frontend-builder | none | BACKLOG |
| TD-7 | P2 | Multiple/ad-hoc action-file split per feature (`actions.ts` + `account-actions.ts` + `intelligence-actions.ts`) (from Register #15) | backend-api-builder | none | BACKLOG |
| TD-8 | P4 | Duplicate index on `case_agents.agent_id` (`case_agents_agent_idx` + `idx_case_agents_agent_id`; neither dropped) (from Register #18) | data-migration-author | none | READY |
| TD-9 | P4 | Orphaned `report_status` enum (no column uses it after `reports` dropped in 0051) (from Register #19) | data-migration-author | none | READY |
| TD-10 | P4 | Legacy `expense_category` values `food`/`hotel` still defined (data migrated in 0053) (from Register #20) | data-migration-author | none | READY |
| TD-11 | P4 | Empty, untracked `components/reports/` directory (orphaned after 0051) (from Register #21) | frontend-builder | TD-9 | BLOCKED — same dropped-reports lineage as TD-9 |
| TD-12 | P4 | Thin automated test coverage (4 test files vs 86 app + 130 component files) (from Register #22) | qa-test-engineer | none | BACKLOG |
| TD-13 | P4 | Redundant trigger functions `set_updated_at()` / `touch_updated_at()` (from Register #23) | data-migration-author | none | READY |

---

## 3. Security Improvements

Security-natured items. Each is filed at its evidenced severity; none is a confirmed exploit.

| ID | Priority | Title | Owner Agent | Dependencies | Current Status |
|---|---|---|---|---|---|
| SEC-1 | P1 | `createServiceClient` (RLS-bypass) reachable from 22 files incl. `page.tsx` — audit Golden Rule 2 holds at every call site (no misuse asserted; breadth/audit risk) (from Register #2) | security-reviewer | none | READY |
| SEC-2 | P1 | Superseded-but-undropped `gps903_session` holding a live session cookie (RLS-enabled, zero policies → not user-reachable; stale credential surface) (from Register #1) | data-migration-author | SEC-4 | BLOCKED — confirm no code path reads it (SEC-4) before any change |
| SEC-3 | P1 | `can_access_case()` dead-but-live: defined (redefined 0063, assignment-scoped) but wired into no policy/query; do not assume it gates access (from Register #7) | security-reviewer | none | READY |
| SEC-4 | P2 | Debug endpoint `api/debug/gps903/route.ts` co-resident with production routes (`CRON_SECRET`-gated, no in-app caller; uses service role) (from Register #14) | devops-engineer | SEC-1 | BLOCKED — overlaps service-role audit (SEC-1) |

---

## 4. Performance Improvements

P3 items plus the duplicate index's performance dimension (the index itself is tracked as cleanup under TD-8; the query/scan-cost items live here).

| ID | Priority | Title | Owner Agent | Dependencies | Current Status |
|---|---|---|---|---|---|
| PERF-1 | P3 | FK columns without a covering index (~25 FK cols; higher-traffic: `case_messages.sender_id`, case-scoped FKs) (from Register #16) | performance-engineer | none | BACKLOG |
| PERF-2 | P3 | Near-duplicate GPS-device flatten queries in `lib/queries.ts` (`getActiveGpsDevices` / `getGpsMonitorDevices`, lines 251–298) (from Register #17) | backend-api-builder | ARCH-1 | READY — sole blocker ARCH-1 cleared (now LOCAL DONE / PENDING PR) |

---

## 5. Architecture Improvements

P1 architectural-risk items.

| ID | Priority | Title | Owner Agent | Dependencies | Current Status |
|---|---|---|---|---|---|
| ARCH-1 | P1 | Layering inversion: `lib/queries.ts` (data layer) imports chart view-types from `components/dashboard/charts` (UI layer) (from Register #3) | backend-api-builder | none | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) — PENDING PR (no commit/PR yet; release-authorized for a `feature/*` PR) |
| ARCH-2 | P1 | No `error.tsx` anywhere in `app/`; only one `loading.tsx` (violates Golden Rule 4 across ~25 segments) (from Register #4) | frontend-builder | none | DONE |
| ARCH-3 | P1 | Hand-mirrored `lib/types.ts` (661 lines) drifting from 69 migrations (header recommends generated types) (from Register #5) | data-migration-author | none | LOCAL DONE (audit-only; 0 source files; security-APPROVED, QA-APPROVED) — no separate PR (audit artifact `.claude/audits/ARCH-3-types-drift-audit.md`) |
| ARCH-4 | P1 | `notifications.ts` straddles persistence and transport concerns (DB insert + `sendPushToUsers` fan-out) (from Register #6) | operations-engineer | none | BACKLOG |

**ARCH-2 sub-task progress** (ARCH-2 is **DONE** — all sub-tasks T1.1–T3.2 complete; **Phase 1 (T1.1–T1.6) MERGED via PR #4 (`e35ef01`)**; **Phase 2 (T2.1–T2.7) MERGED via PR #4 (`e35ef01`)**; **Phase 3 (T3.1 coverage verification + T3.2 consistency/leak sweep) both PASS, security-APPROVED, QA-APPROVED, release GO**. Golden Rule 4 fully implemented + coverage-certified + consistency/leak-certified across the App Router tree; ARCH-2 was the last open Phase-3 dependency):

> **Merge reconciliation (2026-06-25):** PR #4 (`feat(arch-2): App Router error & loading boundaries`) was **MERGED into `main`** at merge commit `e35ef01205831070f02ae280c3675786af04bf69` (merged 2026-06-25 13:48Z; Vercel deploy completed). PR #4 carried the full ARCH-2 Phase 1 + Phase 2 implementation (T1.1–T2.7). The prior `PENDING PR — no commit/PR yet` Merge Status on those rows is therefore **stale and has been reconciled to MERGED**. Verified from git: `e35ef01` is HEAD of `main`; `gh pr view 4` → state MERGED. T3.1 is a 0-file verification audit certifying that merged tree (no separate PR of its own).

> **Disk re-verification (2026-06-25):** The full ARCH-2 working tree was re-evaluated from disk as the single source of truth. All 34 boundary/loading files + the shared component are present; every source path cited across all 13 sign-offs (`ARCH-2-T1.1`…`T2.7`) exists on disk; `tsc --noEmit` exits 0 and ESLint reports no warnings or errors across the tree. T2.4 = 4 internal digest-only `error.tsx` (invoices/expenses/payroll/reports), verified sound; T2.6 = deliberate 0-file non-change (the `(auth)` segments rely on the T1.6 `(auth)/error.tsx` group boundary), verified consistent with disk. An earlier status-integrity flag (T2.4/T2.6 "unverified") is superseded by this re-verification and the completion of their review work; all Phase-2 sub-tasks are LOCAL DONE per their sign-offs.

| Sub-task | Title | Owner | Status | Merge Status | Sign-off |
|---|---|---|---|---|---|
| T1.1 | Shared error-state component | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T1.1.md` |
| T1.2 | Boundary error-logging helper `logBoundaryError` (`src/lib/errors.ts`, additive) | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T1.2.md` |
| T1.3 | Error-boundary i18n strings (`messages/en.json` + `messages/th.json`, additive 9-key `errorBoundary` block) | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T1.3.md` |
| T1.4 | Async/loading-gap audit (read-only; `.claude/audits/ARCH-2-loading-audit.md`) — 38 segments, 9 need `loading.tsx`, 18 → segment `error.tsx` (T2.1–T2.7) | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T1.4.md` |
| T1.5 | Root + global error boundary (`src/app/error.tsx` + `src/app/global-error.tsx`, new) — renders T1.1 `ErrorState`, logs via T1.2 `logBoundaryError` (`app:error`/`app:global-error`), only `error.digest` to UI | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T1.5.md` |
| T1.6 | Route-group root boundaries (4 new `error.tsx`: `(dashboard)`/`(auth)` internal+digest; `(portal)/portal`/`(portal-auth)` portal-safe, NO digest — trust boundary enforced) | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED [portal leak-free], QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T1.6.md` |
| T2.1 | Cases & Clients segment boundaries (4 new: `cases/[id]/loading.tsx` + `error.tsx`, `clients/[id]/loading.tsx` + `error.tsx`; internal variant, digest-only, loading PII-free; `cases/intake` light → no files) | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T2.1.md` |
| T2.2 | Agents/Field/Evidence segment boundaries (4 new: `agents/[id]/loading.tsx` + `error.tsx`, `field/[id]/loading.tsx` + `error.tsx`; internal variant, digest-only, field GPS skeleton leak-free; `evidence` DEFERRED to group boundary per T1.4 audit; list segments → no files) | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T2.2.md` |
| T2.3 | GPS & Map segment boundaries (8 new: 5 `error.tsx` `map`/`gps-devices/[id]`/`gps-monitor`/`gps903-discovery`/`gps903-credentials` + 3 skeletons `map`/`gps-monitor`/`gps-devices/[id]`; internal variant, digest-only, no coords/IMEI/credentials/Maps-key; gps903-* error-only, gps-devices index none) | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED [no coords/IMEI/credentials/Maps-key], QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T2.3.md` |
| T2.5 | Admin/Ops & Settings segment boundaries (4 new `error.tsx`: `emergency`/`audit`/`users`/`settings/ai-prompts`; internal variant, digest-only, distinct contexts; `users` boundary imports no service-role/admin/secret module; no `loading.tsx` per audit; dashboard-index/settings-root/settings-profile rely on group) | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T2.5.md` |
| T2.7 | Portal & Portal-auth segment boundaries (3 new: `(portal)/portal/loading.tsx`, `(portal)/portal/cases/[id]/loading.tsx` + `error.tsx`; portal-safe, NO detail/digest, loading PII-free) | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED [portal leak-free], QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T2.7.md` |
| T2.4 | Invoices/Expenses/Payroll/Reports segment boundaries (4 new `error.tsx`: `invoices`/`expenses`/`payroll`/`reports`; internal variant, digest-only, unique log scopes `invoices:error`/`expenses:error`/`payroll:error`/`reports:error`; no `loading.tsx` in scope → rely on group skeleton) | frontend-builder | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T2.4.md` |
| T2.6 | `(auth)` route group deliberate-non-change (`login` = `'use client'`, `login/verify` = async but only `await searchParams` + self-Suspended, `register` = sync redirect, `(auth)/layout.tsx` only `getTranslations`) do no render-time DB work → no segment `error.tsx`/`loading.tsx`; rely on T1.6 `(auth)` group boundary; **0 new files** (per T1.4 audit) | frontend-builder | LOCAL DONE (verification; 0 files; security-APPROVED, QA-APPROVED) | MERGED via PR #4 (`e35ef01`) | `.claude/sign-offs/ARCH-2-T2.6.md` |
| T3.1 | Full Golden-Rule-4 coverage verification pass (read-only; `.claude/audits/ARCH-2-T3.1-coverage-verification.md`; **0 source files changed**) — overall **PASS**: 9/9 `loading.tsx`, 18/18 segment `error.tsx`, 4/4 group-root `error.tsx`, root + `global-error` present; 24 boundaries wired to shared `ErrorState` + `logBoundaryError` with **24 unique log scopes**; trust-boundary holds (21 internal digest, 3 portal no-digest); en/th i18n parity; `evidence`/`(auth)`/`cases/intake` deliberate non-changes confirmed; tsc + lint exit 0 | frontend-builder | LOCAL DONE (verification PASS; security-APPROVED, QA-APPROVED) | Implementation it certifies is MERGED via PR #4 (`e35ef01`); the verification pass itself is a 0-file audit (no separate PR) | `.claude/sign-offs/ARCH-2-T3.1.md` |
| T3.2 | Deeper consistency review + adversarial portal-leak sweep (FINAL ARCH-2 sub-task; `.claude/audits/ARCH-2-T3.2-consistency-leak-sweep.md`; **0 source files changed**) — overall **PASS**. Half A: 7/7 consistency dimensions PASS (two T1.4 Medium-confidence skeleton-fidelity flags — `gps-monitor`, `map` — CLOSED as faithful map+rail mirrors; one acceptable-as-is log-scope singular/plural stem irregularity recorded, deliberately NOT renamed to preserve T3.1's certified 24-unique-scope ledger). Half B: trust-boundary verdict — **NO leak under any render path** (8 negative paths explicitly ruled out); `ErrorState` `showDetail` hard-guard intact. tsc + lint exit 0 | frontend-builder | LOCAL DONE (verification PASS; 0 files; security-APPROVED, QA-APPROVED) | Certified implementation MERGED via PR #4 (`e35ef01`); verification pass itself is a 0-file audit (no separate PR) | `.claude/sign-offs/ARCH-2-T3.2.md` |

Dependency note (ARCH-2 breakdown): T1.2/T1.3/T1.4 depend on nothing; T1.5 & T1.6 depend on T1.1 **AND** T1.2 **AND** T1.3; Phase 2 (T2.x) depends on T1.4+T1.5+T1.6. Phase 1 + Phase 2 (T1.1–T2.7) are **MERGED via PR #4 (`e35ef01`)** — see the merge reconciliation note above (typecheck + lint clean; all sign-offs present and file-consistent). Phase 3: **T3.1 (full Golden-Rule-4 coverage verification pass) is LOCAL DONE — overall PASS, security-APPROVED, QA-APPROVED, release GO retrospective** (depended on T2.1–T2.7, all merged). **T3.2 (deeper consistency review + adversarial portal-leak sweep) is now LOCAL DONE — overall PASS (0 source files), security-APPROVED [trust boundary cannot leak under any render path], QA-APPROVED [Half-A consistency + T3.1 ledger unchanged], release GO** (its dependencies T2.7 + T3.1 are both satisfied). **All ARCH-2 sub-tasks T1.1–T3.2 are now complete; Phase 3 is done; ARCH-2 `Current Status` is flipped to DONE** — ARCH-2 was the last open Phase-3 dependency. (Non-change of record: the `evidence` segment's error/loading was deliberately DEFERRED to the T1.6 group boundary per the T1.4 audit — intentional, not an omission.) (Carried observation: T1.5 `global-error.tsx` copy is English under a possibly-`th` locale — deliberate provider-independence trade-off, tracked in its sign-off. T3.2 acceptable-as-is record: the log-scope singular/plural stem irregularity was deliberately NOT renamed, to preserve the security-load-bearing 24-unique-scope ledger certified in T3.1.)

> **Process flags (release-manager, non-blocking, reinforced going forward):** (1) **Merge-after-gate ordering:** PR #4 was merged into `main` *before* the T3.1 release-gate decision was rendered (the GO is therefore a *retrospective* certification). The documented pipeline requires Security + QA + release GO **before** merge; future ARCH-2/feature merges must await the release-gate verdict first. (2) **Branch-naming drift:** the merged branch used `feat/*` (and sibling `feat/arch-3`) whereas `PROJECT_RULES.md` documents `feature/*`; cosmetic, non-blocking — align naming or update the rule.

> GPS903 fragmentation (Register #9 → TD-2) and map-rendering duplication (Register #8 → TD-1) are architectural in nature but are filed once under Technical Debt to keep each Register item in a single section; their IDs remain traceable there.

---

## 6. Future Enhancements

Forward-looking only. Each is clearly implied by an existing source finding and is the directional counterpart to a debt item; none is invented beyond that.

| ID | Priority | Title | Owner Agent | Dependencies | Current Status |
|---|---|---|---|---|---|
| FUT-1 | P1 | [Forward-looking → implemented] Adopt generated Supabase DB types to replace hand-mirrored `lib/types.ts` (directional counterpart to ARCH-3 / Register #5; the file's own header recommends `supabase gen types`). Cutover implemented: NEW CLI-generated `src/lib/database.types.ts` (`supabase gen types typescript --linked --schema public`, CLI 2.106.0) + `src/lib/types.ts` rewritten as a thin alias surface (`Row<T>`/`Enums<T>`) over the generated `Database`; all exported names preserved, 98 importers unchanged. The ARCH-3 drift audit (`.claude/audits/ARCH-3-types-drift-audit.md`) was the input/remediation plan: must-survive non-table-mirror set (Intake* block, composed/enriched, server-decorated fields), class-C narrowing unions, and the opaque-credential boundary (`device_password`/`*_enc`) were all honored. DB-side `ExpenseCategory` `food`/`hotel` re-widening (the generated enum is DB-faithful) remains TD-10 | data-migration-author | ARCH-3 | LOCAL DONE (builder-complete; security-APPROVED, QA-APPROVED) — PENDING PR (no commit/PR yet; release-authorized for a `feature/*` PR per conditions in sign-off `.claude/sign-offs/FUT-1.md`) |
| FUT-2 | P2 | [Forward-looking] Consolidate the GPS903 domain (DB + `lib/gps903.ts` + `map/`,`gps/`,`gps903/` + 4 app segments) under one boundary (directional counterpart to TD-2 / Register #9) | maps-geo-builder | TD-2, TD-4 | BACKLOG |
| FUT-3 | P1 | [Forward-looking] Adopt `can_access_case()` as the central case-access guard across RLS/queries (directional counterpart to SEC-3 / Register #7; helper is defined and assignment-scoped, currently unwired) | security-reviewer | SEC-3 | BACKLOG |
| FUT-4 | P4 | [Forward-looking] Author an ERD / schema README for the 69-migration DB (no schema overview exists; grounded in Inventory + DB-docs "missing documentation" findings) | data-migration-author | none | BACKLOG |

---

## Summary

**Per section:** Active Features 1 · Technical Debt 13 · Security Improvements 4 · Performance Improvements 2 · Architecture Improvements 4 · Future Enhancements 4 — **28 items total** (23 Register items + AF-1 from project memory + FUT-1..FUT-4 forward-looking, of which FUT-1/FUT-2/FUT-3 are directional counterparts to existing debt and FUT-4 is grounded in the documentation-gap findings).

**Per status:** BACKLOG 10 · READY 8 · IN PROGRESS 1 · BLOCKED 5 · DONE 1 · LOCAL DONE / PENDING PR 2 (ARCH-1, FUT-1) · LOCAL DONE / no-PR (audit-only) 1 (ARCH-3) — **28 total**. (ARCH-2 is DONE — all sub-tasks T1.1–T3.2 complete; Phase 1 + Phase 2 MERGED via PR #4 (`e35ef01`), Phase 3 verification passes T3.1 + T3.2 both PASS/security-APPROVED/QA-APPROVED/release GO. The only remaining IN PROGRESS item is AF-1, native push activation. **ARCH-1 (2026-06-25) is LOCAL DONE / PENDING PR** — builder-complete, security-APPROVED, QA-APPROVED, release-authorized for a `feature/*` PR but no commit/PR yet; following the same convention used for ARCH-2's sub-tasks, the `LOCAL DONE / PENDING PR` qualifier is tracked separately from the plain backlog statuses (so it leaves the READY tally and is listed on its own line rather than under READY/DONE). **PERF-2 moved BLOCKED → READY** now that its sole blocker (ARCH-1) is cleared. **ARCH-3 (2026-06-25) is now LOCAL DONE / no-PR (audit-only)** — its deliverable is the read-only drift audit `.claude/audits/ARCH-3-types-drift-audit.md` (0 source files changed), security-APPROVED + QA-APPROVED + release GO; like ARCH-1 it leaves the READY tally and is tracked on its own qualifier line rather than folded into DONE (no merge/PR — the audit artifact lives under the untracked-but-not-gitignored `.claude/`). **FUT-1 (2026-06-25) is now LOCAL DONE / PENDING PR** — the ARCH-3 → FUT-1 generated-types arc is complete: the cutover is implemented (NEW CLI-generated `src/lib/database.types.ts` + `src/lib/types.ts` alias surface), builder-complete, security-APPROVED, QA-APPROVED, release-authorized for a `feature/*` PR but no commit/PR yet; tracked on the same `LOCAL DONE / PENDING PR` qualifier line as ARCH-1, so it leaves the READY tally (FUT-1 had earlier moved BACKLOG → READY once ARCH-3 cleared, then READY → LOCAL DONE / PENDING PR on this run). Net effect on plain counts: READY 9→8 (FUT-1 out to its qualifier line). Sub-task qualifiers are tracked separately from backlog-item status and are not folded into the plain-status counts.)

> Note on DONE: **ARCH-2 is the first backlog work item evidenced as finished** (all sub-tasks T1.1–T3.2 complete; implementation MERGED via PR #4 (`e35ef01`); both Phase-3 verification passes security-APPROVED + QA-APPROVED + release GO), so DONE is now **1**, no longer 0. The Database Knowledge docs are complete but are captured implicitly as the provenance of this backlog rather than as a counted work item.
