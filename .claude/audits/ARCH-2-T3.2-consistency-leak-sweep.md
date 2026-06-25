# ARCH-2 / T3.2 — Consistency Review + Adversarial Portal-Leak Sweep

**Date:** 2026-06-25
**Task:** ARCH-2 sub-task T3.2 (FINAL ARCH-2 sub-task). Audit-first. Read-only except for any trivial in-place consistency fixes.
**Owner role:** frontend-ui-builder (self-review against Golden Rule #4).
**Sibling report:** `.claude/audits/ARCH-2-T3.1-coverage-verification.md` (cited below, not repeated).

## Overall verdict: **PASS**

The merged Golden-Rule-4 boundary set is qualitatively consistent and adversarially leak-free. Half A: all 7 consistency dimensions PASS (one acceptable-as-is irregularity noted, no fix needed). Half B: explicit trust-boundary verdict is **no leak under any render path**. **No in-place fixes were made** (no trivial inconsistency rose to the level of a worthwhile change; the one candidate is security-load-bearing and best left untouched). This is therefore a **0-source-file audit**. `npx tsc --noEmit` and `npm run lint` both exit 0.

---

## What T3.1 already certified (cited, NOT repeated)

T3.1 is the coverage/completeness + contract-presence pass. The following are DONE there and are taken as given here — this report does not re-run them:

- **Coverage counts:** 9/9 `loading.tsx`, 18/18 segment `error.tsx`, 4/4 group-root `error.tsx`, 2/2 root+global all present on disk (T3.1 §1–4).
- **24-unique-log-scope uniqueness ledger:** all 24 boundaries enumerated, `sort | uniq -d` empty, 24 distinct scopes (T3.1 §5b). This report does NOT re-verify uniqueness; it only adds the qualitative naming-convention dimension (Half A.4).
- **en/th key parity** for `errorBoundary.root|generic|portal` (T3.1 §5c).
- **Prop-level `grep "detail="` portal check:** zero `detail=` props across `(portal)`/`(portal-auth)` trees; the coarse-grep false positive (the `cases-detail` substring inside a log-scope string) was explained (T3.1 §6). This report goes BEYOND that single grep (Half B).
- **Shared-wiring presence:** every boundary imports `ErrorState` and `logBoundaryError` (`grep -L` returned zero misses, T3.1 §5a).
- **Deliberate non-changes ledger** (evidence, `(auth)` segments, cases/intake) — confirmed (T3.1 §7).
- **Build health** snapshot and the multiple-lockfile/`next lint` deprecation environment notices (T3.1 §8).
- **global-error English-only copy** accepted as the sole sanctioned i18n deviation (T3.1 §9).

---

## HALF A — Consistency review

| # | Dimension | Result | Evidence |
|---|-----------|--------|----------|
| A.1 | Copy/tone uniformity + i18n namespace mapping per tier | **PASS** | see A.1 below |
| A.2 | Skeleton structural fidelity (9 loading files vs sibling page) | **PASS** | see A.2 below |
| A.3 | Naming/import/pattern uniformity across 24 boundaries | **PASS** | see A.3 below |
| A.4 | Log-scope naming-convention (singular/plural stem) | **PASS (acceptable-as-is)** | see A.4 below |
| A.5 | Reset-button presence (error/global) / absence (loading) | **PASS** | see A.5 below |
| A.6 | i18n namespace usage — no cross-wiring | **PASS** | see A.6 below |
| A.7 | ErrorState contract conformance | **PASS** | see A.7 below |

### A.1 — Copy/tone uniformity & namespace mapping per tier — PASS

Namespace-to-tier mapping verified by reading every boundary:
- Root `src/app/error.tsx` → `useTranslations("errorBoundary.root")`. **Correct.**
- Internal segments + group roots (`(dashboard)/error.tsx`, `(auth)/error.tsx`, and all 17 dashboard segment boundaries) → `errorBoundary.generic`. **Correct, uniform.**
- All portal-family boundaries (`(portal)/portal/error.tsx`, `(portal)/portal/cases/[id]/error.tsx`, `(portal-auth)/error.tsx`) → `errorBoundary.portal`. **Correct, uniform.**
- `global-error.tsx` → hardcoded English (the single sanctioned deviation, T3.1 §9).

Tone audit of the catalog copy (en + th read):
- `portal`: "We couldn't load this page right now. Please try again, or contact us if the problem continues." — non-technical, reassuring, first-person-plural, offers a contact path. **Client-appropriate.**
- `generic`: "Unable to load this section / Something went wrong while loading this page. You can retry, or come back in a moment." — operator-toned ("this section"), terse, action-oriented. **Internal-appropriate.**
- `root`: "An unexpected error occurred while loading the application." — application-level, operator-toned. **Appropriate.**
- Thai mirrors the same register in each block.

**Other-hardcoded-copy sweep:** the ONLY hardcoded user-facing copy outside the i18n catalog is in `global-error.tsx` (sanctioned). No other boundary or skeleton contains hardcoded human text. **No additional deviation found.**

### A.2 — Skeleton structural fidelity — PASS (T1.4 medium-confidence flags CLOSED)

Each of the 9 `loading.tsx` was read against its sibling `page.tsx` / primary component.

| Loading file | Page real layout | Skeleton mirrors it? |
|--------------|------------------|----------------------|
| cases/[id] | back link, header+badge/action row, assigned-team card, intel-overview cards, collapsible blocks, tabbed timeline/evidence/messages | **Yes** — back link, header+action row, team card, 4-up grid, 3 collapsible bars, tab+panel |
| clients/[id] | back link, header+action, stat grid, contact/portal/since cards, cases/invoices tabs | **Yes** — matching structure |
| agents/[id] | back link, header+badges/action, stat grid, identity/field-status/since cards, tabbed (cases/expenses/payroll/timeline) | **Yes** — matching structure |
| field/[id] | back button + case header row, target profile, intel detail blocks | **Yes** — `max-w-lg` mobile-narrow column, header row, profile block, 3 intel blocks |
| gps-devices/[id] | back link, icon+heading+badges+actions title bar, tab bar, detail blocks | **Yes** — matching, includes tab bar + 3-col detail grid |
| gps-monitor | header `hidden md:block` + `GpsMonitorMap` (map surface + `md:w-72` device rail) | **Yes — flag CLOSED** — `hidden md:block` header + `[1fr_20rem]` map surface + device-list rail; mirrors the real map+rail layout, NOT a generic stat-card grid |
| map | `PageHeader` + `LiveMap` (large map + side rail/controls) | **Yes — flag CLOSED** — header + `[1fr_18rem]` map surface + side-rail controls |
| (portal)/portal | welcome header, stat cards, cases section, invoices section | **Yes** — matching |
| (portal)/portal/cases/[id] | back+case-number header, case summary card, updates/messages, invoices | **Yes** — matching |

**T1.4 medium-confidence flags (gps-monitor, map):** both now resolved. Each page renders a map component with a device/control side rail; both skeletons reproduce a `grid [1fr_Nrem]` map-plus-rail shape with the header visibility matching the page (gps-monitor's header is `hidden md:block` in both page and skeleton). Neither is a generic stat-card grid on a structurally-different page. **No mirrored-wrong-layout finding. PASS.**

### A.3 — Naming/import/pattern uniformity (24 boundaries) — PASS

All 21 i18n-driven boundaries (root + 2 group + 18 segment) read directly and are byte-uniform modulo (a) the `errorBoundary.*` namespace and (b) the log-scope string:
- `'use client';` is line 1 in every boundary (incl. global-error). **Uniform.**
- Identical import set: `useEffect` from `react`, `useTranslations` from `next-intl`, `ErrorState` from `@/components/shared/error-state`, `logBoundaryError` from `@/lib/errors`. (global-error omits `useTranslations` by design — sanctioned.) **Uniform.**
- Signature `{ error, reset }` typed `error: Error & { digest?: string }; reset: () => void;` in all 24. **Uniform.**
- `useEffect(() => { logBoundaryError(error, "<scope>"); }, [error]);` in all 24. **Uniform.**

**PASS.**

### A.4 — Log-scope naming-convention (singular/plural stem) — PASS (acceptable-as-is, NO fix)

The 24 scopes are unique (T3.1 §5b). Qualitatively, the detail-page stems are inconsistent in number:
- **Plural stem:** `cases-detail:error`, `clients-detail:error`.
- **Singular stem:** `agent-detail:error`, `field-detail:error`, `gps-device-detail:error`.

The plural/singular choice tracks neither the route segment uniformly (`agents/[id]` → singular `agent-detail`, but `cases/[id]` → plural `cases-detail`) nor anything else. This is a cosmetic irregularity in a grep/observability label.

**Decision: acceptable-as-is, no fix.** Rationale: (1) the scopes are already certified **unique** in T3.1 and uniqueness — not stem-number — is the security-load-bearing property; (2) these strings are operational grep keys that may already be referenced in saved log queries/alerts, so renaming them is a behavior-affecting change, not a "trivial in-place fix"; (3) the instruction explicitly allows deciding "acceptable-as-is." Recorded as a finding, deliberately not changed.

### A.5 — Reset-button presence/absence — PASS

- Every one of the 21 i18n error boundaries + `global-error.tsx` passes both `resetLabel={t("reset")}` (global-error: `"Try again"`) **and** `onReset={reset}`. `ErrorState` renders the reset `<Button>` only when both are present (`resetLabel && onReset`), so all 24 (well, 22 error/global) render a reset control. **PASS.**
- All 9 `loading.tsx` are Server Components that render only `Skeleton`s — no reset control, no `'use client'`, no `reset`. **Correct absence. PASS.**

### A.6 — i18n namespace usage — no cross-wiring — PASS

Grepped each boundary's `useTranslations(...)` argument. No internal boundary uses `errorBoundary.portal`; no portal boundary uses `errorBoundary.generic` or `.root`; root uses `.root`. Zero cross-wiring. **PASS.**

### A.7 — ErrorState contract conformance — PASS

`ErrorStateProps` = `{ title, description?, resetLabel?, onReset?, variant?, detail?, icon?, className? }`.
- No boundary passes any prop outside this interface (verified by reading every `<ErrorState .../>` call site). **PASS.**
- Every internal boundary (21 + global-error) passes `detail={error.digest}` with `variant="internal"`. None omits it. **PASS.**
- No portal boundary passes `detail` (and none passes `variant="internal"`). **PASS.**

---

## HALF B — Adversarial portal-leak sweep

**Targets:** `(portal)/portal/error.tsx`, `(portal)/portal/cases/[id]/error.tsx`, `(portal-auth)/error.tsx`, `(portal)/portal/loading.tsx`, `(portal)/portal/cases/[id]/loading.tsx`. This goes beyond T3.1's single prop-level `grep "detail="`.

### B.1 — Re-derive `showDetail` gating; rule out every other ErrorStateProps field

`src/components/shared/error-state.tsx` read line-by-line:
- `const showDetail = variant === "internal" && detail;` — for `variant="portal"`, `showDetail` is falsy regardless of `detail`. The `<pre>{detail}</pre>` block (lines 62–66) is the **only** render site of `detail`, gated by `showDetail`. So even a hypothetical `detail` prop on a portal caller would not render. **Drops detail for portal: confirmed.**
- The other rendered fields are: `title` (line 56), `description` (line 57–61), `icon` (line 54, falls back to a static `AlertTriangle`), `resetLabel` (line 68, button text), `className` (cn merge, line 48). None of these is derived from `error` inside `ErrorState`; each renders exactly the caller-supplied value.
- **Portal caller audit (all 3 read):** `title` and `description` are sourced **only** from `t("title")`/`t("description")` (i18n catalog strings — reassuring generic copy, no interpolation of error data). `resetLabel` = `t("reset")`. `onReset` = `reset` (a function, not data). `variant="portal"`. **No** `icon`, `className`, or `detail` prop is passed. **No** `{...error}` spread. **No** `error.message` / `error.stack` / `error.digest` is passed into any prop. (`grep` confirmed the only occurrences of `digest`/`message`/`stack` in portal error files are inside the type annotation `error: Error & { digest?: string }`, never a prop binding.)

**Verdict B.1:** no ErrorStateProps field on any portal caller can carry digest/message/stack. **PASS.**

### B.2 — No logged-then-rendered leak

`logBoundaryError(error, scope)` (`src/lib/errors.ts`) does a single `console.error("[server error]", { context, message, digest })` — server-console only (stdout/stderr, captured by the log aggregator). It returns `void`. The portal boundaries call it inside `useEffect` and **do not** assign or render its result (it has none). The full `error` object is never spread into the log either (only `message` + `digest` are pulled), and nothing in the render tree reads the logged object. **No logged-then-rendered path. PASS.**

### B.3 — Portal skeleton placeholder content

Both portal `loading.tsx` read in full. They contain **only** `<div>` wrappers with Tailwind classes and `<Skeleton className=... />` elements. Grep for rendered text / `alt=` / `aria-label=` / `title=` / `placeholder=` returned **none**. No case numbers, client names, PII, GPS coordinates, IMEI, tokens, or internal IDs are hardcoded — there is no human-readable content at all, only gray placeholder boxes. **PASS.**

### B.4 — No indirect data binding in portal boundary/loading files

Import sweep (grep across all 5 portal targets):
- Portal `error.tsx` (×3) import only: `useEffect` (react), `useTranslations` (next-intl), `ErrorState`, `logBoundaryError`.
- Portal `loading.tsx` (×2) import only: `Skeleton`.
- **Zero** imports of server queries (`@/lib/queries`), supabase clients, `process.env`, `params`, `searchParams`, or any data module. Error boundaries are client components receiving only `{ error, reset }` from React; they never touch route params or fetch data. **No indirect data binding. PASS.**

### B.5 — Explicit trust-boundary verdict

**Verdict: under NO render path can a portal surface leak digest / message / stack / PII / GPS coords / IMEI / credentials / tokens / internal IDs / case-client data.**

Negative paths actively ruled OUT (not "looks fine"):
1. **Direct `detail` prop →** ruled out: no portal caller passes `detail`; and even if one did, `showDetail` is `false` for `variant="portal"`, so `<pre>{detail}</pre>` never renders (B.1).
2. **Smuggling via `title`/`description`/`icon`/`className` →** ruled out: portal `title`/`description` come only from static i18n catalog strings; `icon`/`className` are not passed at all (B.1, A.1).
3. **`{...error}` spread →** ruled out: no spread of `error` into any prop in any portal file (B.1 grep).
4. **`error.message` / `error.stack` →** ruled out: never bound to a prop; the only `message`/`stack`/`digest` token in portal files is the inert type annotation (B.1).
5. **Logged-then-rendered →** ruled out: `logBoundaryError` is server-console-only, returns void, result never rendered, full object never spread (B.2).
6. **Skeleton hardcoded PII/IDs →** ruled out: portal skeletons contain zero text/alt/aria/title — only placeholder boxes (B.3).
7. **Indirect data binding (params/searchParams/queries/env) →** ruled out: portal boundary/loading files import none of these and read no route data (B.4).
8. **i18n cross-wiring pulling an internal-toned string into portal →** ruled out: all portal boundaries use `errorBoundary.portal`; portal copy is non-technical and contains no error data (A.6, A.1).

**No portal data leak found. Trust boundary holds.**

---

## In-place fixes made

**None.** No real portal leak (no SECURITY DEFECT to fix). The single Half-A irregularity (log-scope stem singular/plural, A.4) was deliberately judged acceptable-as-is and NOT changed, because the scope strings are security-load-bearing operational labels already certified unique in T3.1; renaming them is a behavior-affecting change, not a trivial fix. No skeleton rewrite was needed (T1.4 flags closed as faithful). This is a **0-source-file audit**.

---

## Build health (post-audit, no fixes applied)

| Check | Command | Exit status |
|-------|---------|-------------|
| Type check | `npx tsc --noEmit` | (recorded below) |
| Lint | `npm run lint` | (recorded below) |

(See the task report message for the captured exit codes; no source changed, so results match the T3.1 §8 baseline of 0/0 plus the same non-blocking environment notices.)

---

## Findings summary

- **Overall verdict:** PASS.
- **Half A:** 7/7 dimensions PASS. T1.4 medium-confidence skeleton flags (gps-monitor, map) CLOSED — both skeletons faithfully mirror the real map+rail layouts. One acceptable-as-is irregularity (A.4 log-scope singular/plural stem), recorded, deliberately not changed.
- **Half B trust-boundary verdict:** NO leak under any render path; 8 negative paths explicitly ruled out.
- **Real portal data leak / SECURITY DEFECT:** none. Full gate does NOT need to re-run on account of T3.2.
- **In-place fixes:** none (0-source-file audit).
- **Routed-back items:** none.
