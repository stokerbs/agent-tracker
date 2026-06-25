# Gate Sign-off Record — ARCH-2 / T2.7

**Task:** T2.7 — Portal & Portal-auth segment boundaries / loading states
**Backlog item:** ARCH-2 (P1, Register #4) — App Router error/loading states · Phase 2 (trust-boundary-critical group)
**Builder:** frontend-builder — COMPLETE
**Change set:** 3 new files —
- `src/app/(portal)/portal/loading.tsx` — Skeleton/static, no PII/data/env
- `src/app/(portal)/portal/cases/[id]/loading.tsx` — Skeleton/static, no PII/data/env
- `src/app/(portal)/portal/cases/[id]/error.tsx` — `'use client'`, `variant="portal"`, `errorBoundary.portal`, **NO detail/digest rendered to DOM**, logs `"portal:cases-detail:error"` server-side

T1.6 group-root portal boundaries untouched. Nothing added under `(portal-auth)/` (T1.4 audit: those routes are client/self-Suspended). No new i18n keys (reuses T1.3 `errorBoundary.portal`).
**Disposition:** release-manager — **LOCAL DONE — MERGE PENDING PR**. Recorded sign-off only; not committed, no live PR opened. `PROJECT_RULES.md` checklist treated as a template; this record is the per-task instance.

## Pull Request Checklist (from PROJECT_RULES.md)

- [x] **Security reviewed** — `security-reviewer`: **APPROVED**. Portal error boundary is leak-free across the client trust boundary: `variant="portal"`, no `detail`/digest/message/stack reaches the DOM (verified — the only `digest` occurrence is in the `error` prop *type*, never rendered), `errorBoundary.portal` copy only. Both `loading.tsx` files are Skeleton/static with no PII, case data, or env. Client-safe imports only. No regression to the T1.6 group-root portal boundary.
- [x] **QA approved** — `qa-test-engineer`: **APPROVED**. Valid Next.js segment boundary + loading files; portal render-safety asserted (no `detail` prop passed); loading skeletons PII-free; logging uses a distinct context (`portal:cases-detail:error`); `reset()` wired; `tsc --noEmit` exits 0; ESLint clean; no new i18n keys introduced.
- [x] **Tests passing** — typecheck (`tsc --noEmit`) and lint clean. NOTE: no automated boundary/loading test authored — outside T2.7 acceptance criteria; broader test coverage is tracked separately as TD-12. No existing tests regressed.
- [x] **Documentation updated** — boundary/loading intent is self-evident from the portal variant/namespace; no external doc changes warranted.
- [x] **No secrets committed** — Confirmed. Portal error boundary renders nothing internal; loading files render no PII. No env/secret access, no secret-bearing literals.

## Gate summary

| Gate | Agent | Verdict |
|---|---|---|
| 1 — Security | security-reviewer | APPROVED (portal boundary leak-free; loading PII-free) |
| 2 — QA | qa-test-engineer | APPROVED |
| Release | release-manager | LOCAL DONE — MERGE PENDING PR |

## Scope verification

- Scope matches T2.7 only: the portal segment loading/error files for the `(portal)` group.
- No scope creep: T1.6 group-root portal boundaries untouched; no `(portal-auth)` segment files (per T1.4 audit); no internal-tier (T2.1–T2.6) changes; reuses T1.1 component, T1.2 logger, T1.3 `errorBoundary.portal` strings.
- Trust boundary preserved: builds on the portal-safe variant introduced in T1.6; no internal detail crosses to the client surface.
- No unrelated files modified.
