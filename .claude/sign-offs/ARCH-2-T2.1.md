# Gate Sign-off Record — ARCH-2 / T2.1

**Task:** T2.1 — Cases & Clients segment boundaries / loading states
**Backlog item:** ARCH-2 (P1, Register #4) — App Router error/loading states · Phase 2 (Cases & Clients group)
**Builder:** frontend-builder — COMPLETE
**Change set:** 4 new files —
- `src/app/(dashboard)/cases/[id]/loading.tsx` — tailored per-page Skeleton, no PII/params/data
- `src/app/(dashboard)/cases/[id]/error.tsx` — `'use client'`, `variant="internal"`, `errorBoundary.generic`, `detail={error.digest}` only, context `cases-detail:error`
- `src/app/(dashboard)/clients/[id]/loading.tsx` — tailored per-page Skeleton, no PII/params/data
- `src/app/(dashboard)/clients/[id]/error.tsx` — `'use client'`, `variant="internal"`, `errorBoundary.generic`, `detail={error.digest}` only, context `clients-detail:error`

`cases/intake` confirmed light (no async fetch) → no files added. T1.6 group boundary/loading and existing pages untouched.
**Disposition:** release-manager — **LOCAL DONE — MERGE PENDING PR**. Recorded sign-off only; not committed, no live PR opened. `PROJECT_RULES.md` checklist treated as a template; this record is the per-task instance.

## Pull Request Checklist (from PROJECT_RULES.md)

- [x] **Security reviewed** — `security-reviewer`: **APPROVED**. Both error boundaries pass only `error.digest` to the UI (`detail={error.digest}`); no message/stack reaches the DOM. Internal `errorBoundary.generic` namespace (not portal) — appropriate for the authenticated staff surface. No `process.env`/secret access. Both `loading.tsx` files are Skeleton/static with no PII, route params, or case/client data. Client-safe imports only. No regression to the group boundary or existing pages.
- [x] **QA approved** — `qa-test-engineer`: **APPROVED**. Valid Next.js segment boundaries + loading files; `variant="internal"` + `errorBoundary.generic` keys present in both `en`/`th` catalogs, correctly not portal; digest-only `detail`; distinct log contexts (`cases-detail:error` / `clients-detail:error`); `reset()` wired; tailored per-page skeletons; the `cases/intake` no-files decision is sound (light page). `tsc --noEmit` exits 0; ESLint clean.
- [x] **Tests passing** — typecheck (`tsc --noEmit`) and lint clean. NOTE: no automated boundary/loading test authored — outside T2.1 acceptance criteria; broader test coverage is tracked separately as TD-12. No existing tests regressed.
- [x] **Documentation updated** — boundary/loading intent is self-evident from the internal variant/namespace and tailored skeletons; no external doc changes warranted.
- [x] **No secrets committed** — Confirmed. Only `error.digest` in the UI; no PII in loading skeletons. No env/secret access, no secret-bearing literals.

## Gate summary

| Gate | Agent | Verdict |
|---|---|---|
| 1 — Security | security-reviewer | APPROVED (digest-only; internal namespace; loading PII-free) |
| 2 — QA | qa-test-engineer | APPROVED |
| Release | release-manager | LOCAL DONE — MERGE PENDING PR |

## Scope verification

- Scope matches T2.1 only: Cases & Clients detail-page loading/error files.
- No scope creep: no portal changes (T2.7), no other internal groups (T2.2–T2.6), no group-root or root/global boundary edits; reuses T1.1 component, T1.2 logger, T1.3 `errorBoundary.generic` strings.
- `cases/intake` correctly excluded (light page, no async fetch).
- No unrelated files modified.
