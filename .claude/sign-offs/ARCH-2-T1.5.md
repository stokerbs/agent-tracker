# Gate Sign-off Record — ARCH-2 / T1.5

**Task:** T1.5 — Root + global error boundary (`src/app/error.tsx`, `src/app/global-error.tsx`)
**Backlog item:** ARCH-2 (P1, Register #4) — App Router error/loading states
**Builder:** frontend-builder — COMPLETE
**Change set:** 2 new files — `src/app/error.tsx` (root boundary, `useTranslations("errorBoundary.root")`) and `src/app/global-error.tsx` (provider-independent, own `<html>`/`<body>`, hardcoded copy). Both `'use client'`, render the T1.1 `ErrorState` (internal variant), reset wired to `reset()`, log via the T1.2 `logBoundaryError` with distinct contexts (`app:error` / `app:global-error`); only `error.digest` reaches the UI. `page.tsx` / `privacy` / `layout` unchanged.
**Disposition:** release-manager — **LOCAL DONE — MERGE PENDING PR**. Recorded sign-off only; not committed, no live PR opened. `PROJECT_RULES.md` checklist treated as a template; this record is the per-task instance.

## Pull Request Checklist (from PROJECT_RULES.md)

- [x] **Security reviewed** — `security-reviewer`: **APPROVED**. Only `error.digest` is surfaced to the UI (`detail={error.digest}`); no error message, stack, or secret reaches the client. No `process.env` access. `global-error.tsx` is provider-independent (own `<html>`/`<body>`, no i18n/context dependency) so it cannot itself throw on a missing provider. Client-safe imports only (T1.1 component + T1.2 logger).
- [x] **QA approved** — `qa-test-engineer`: **APPROVED**. Valid Next.js error-boundary contracts (root `error.tsx` + `global-error.tsx`); `errorBoundary.root.*` keys present in both `en`/`th` catalogs (from T1.3); `reset()` wired to the recovery affordance; logging fires from an `[error]`-keyed effect with distinct contexts; `tsc --noEmit` exits 0; ESLint clean. No regression to `page.tsx`/`privacy`/`layout`.
- [x] **Tests passing** — typecheck (`tsc --noEmit`) and lint clean. NOTE: no automated boundary test authored — outside T1.5 acceptance criteria; broader test coverage is tracked separately as TD-12. No existing tests regressed.
- [x] **Documentation updated** — JSDoc on `global-error.tsx` explaining its provider-independence (why it carries its own document shell and hardcoded copy). No external doc changes warranted.
- [x] **No secrets committed** — Confirmed. Only `error.digest` reaches the UI; the error message goes only to the server log via `logBoundaryError`. No env/secret access, no secret-bearing literals.

## Carried observation (non-blocking, tracked)

- **`global-error.tsx` copy is English while the document may be `lang="th"`.** This is a deliberate provider-independence trade-off: `global-error` must render without the i18n provider (it replaces the root layout), so its copy is hardcoded and cannot use `useTranslations`. Recorded here so the en-copy-under-`th`-locale gap is tracked, not lost. Non-blocking per security + QA.

## Gate summary

| Gate | Agent | Verdict |
|---|---|---|
| 1 — Security | security-reviewer | APPROVED |
| 2 — QA | qa-test-engineer | APPROVED |
| Release | release-manager | LOCAL DONE — MERGE PENDING PR |

## Scope verification

- Scope matches T1.5 only: root + global error boundaries.
- No scope creep: no route-group boundaries (T1.6), no segment boundaries (Phase 2 / T2.x), no `loading.tsx`; reuses T1.1 component, T1.2 logger, T1.3 strings.
- No unrelated files modified (`page.tsx` / `privacy` / `layout` untouched).
