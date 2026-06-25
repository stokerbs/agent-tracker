# Gate Sign-off Record — ARCH-2 / T1.6

**Task:** T1.6 — Route-group root error boundaries (4 files)
**Backlog item:** ARCH-2 (P1, Register #4) — App Router error/loading states
**Builder:** frontend-builder — COMPLETE
**Change set:** 4 new files —
- `src/app/(dashboard)/error.tsx` — `variant="internal"`, `errorBoundary.generic`, `detail={error.digest}`, context `dashboard:error`
- `src/app/(auth)/error.tsx` — `variant="internal"`, `errorBoundary.generic`, `detail={error.digest}`, context `auth:error`
- `src/app/(portal)/portal/error.tsx` — `variant="portal"`, `errorBoundary.portal`, **NO detail/digest**, context `portal:error`
- `src/app/(portal-auth)/error.tsx` — `variant="portal"`, `errorBoundary.portal`, **NO detail/digest**, context `portal-auth:error`

All `'use client'`, render the T1.1 `ErrorState`, reset wired to `reset()`, log via the T1.2 `logBoundaryError`. No `layout` / `page` / `loading.tsx` changes.
**Disposition:** release-manager — **LOCAL DONE — MERGE PENDING PR**. Recorded sign-off only; not committed, no live PR opened. `PROJECT_RULES.md` checklist treated as a template; this record is the per-task instance.

## Pull Request Checklist (from PROJECT_RULES.md)

- [x] **Security reviewed** — `security-reviewer`: **APPROVED**. Both portal boundaries (`(portal)/portal`, `(portal-auth)`) pass **no detail, digest, message, or stack** to the UI — `errorBoundary.portal` copy only (verified leak-free: no `detail=` present in either portal file). Internal boundaries (`(dashboard)`, `(auth)`) surface only `error.digest`. Distinct log contexts per tier. No `process.env`/secret access; client-safe imports only.
- [x] **QA approved** — `qa-test-engineer`: **APPROVED**. Four valid Next.js route-group `error.tsx` boundaries; per-tier variant/namespace mapping correct (internal→`generic`, portal→`portal`), keys present in both `en`/`th` catalogs, no cross-wiring between tiers; `reset()` wired; `tsc --noEmit` exits 0; ESLint clean. No regression to layouts/pages/loading.
- [x] **Tests passing** — typecheck (`tsc --noEmit`) and lint clean. NOTE: no automated boundary test authored — outside T1.6 acceptance criteria; broader test coverage is tracked separately as TD-12. No existing tests regressed.
- [x] **Documentation updated** — boundary intent is self-evident from the per-tier variant/namespace; no external doc changes warranted.
- [x] **No secrets committed** — Confirmed. Portal boundaries render nothing internal; internal boundaries render only `error.digest`. No env/secret access, no secret-bearing literals.

## Gate summary

| Gate | Agent | Verdict |
|---|---|---|
| 1 — Security | security-reviewer | APPROVED (portal boundaries verified leak-free) |
| 2 — QA | qa-test-engineer | APPROVED |
| Release | release-manager | LOCAL DONE — MERGE PENDING PR |

## Scope verification

- Scope matches T1.6 only: four route-group `error.tsx` boundaries.
- No scope creep: no segment-level boundaries (Phase 2 / T2.x), no `loading.tsx`, no layout/page edits; reuses T1.1 component, T1.2 logger, T1.3 strings.
- Trust boundary enforced: the `(portal)` group is the first portal-safe variant usage; T2.7 builds on it.
- No unrelated files modified.
