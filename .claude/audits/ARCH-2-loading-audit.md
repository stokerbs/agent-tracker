# ARCH-2 · T1.4 — Async / Loading-Gap Audit

**Type:** Read-only audit (no code changes). **Date:** 2026-06-25.
**Scope:** Every route segment `page.tsx` / `layout.tsx` under `src/app/` route groups
`(dashboard)`, `(auth)`, `(portal)`, `(portal-auth)`, plus root `app/page.tsx` and `app/privacy/page.tsx`.

Inventory verified with `find`: **38 `page.tsx`** (37 enumerated segments + root `page.tsx` + `privacy` = 38, where root `app/layout.tsx` is the 5th layout, not a page) + **5 `layout.tsx`** + **1 `loading.tsx`** + **0 `error.tsx` / 0 `global-error.tsx`**.

## How the columns were classified

- **Async server work?** — read the file. "Yes (DB)" = an async Server Component awaiting Supabase
  queries (`await supabase.from(...)`, `Promise.all([...])`) or a `src/lib/queries.ts` helper
  (`getAgents`, `getGpsMonitorDevices`, `getAllAiPrompts`, etc.). "Yes (cheap)" = async default but the
  only awaits are `getTranslations` / `requireProfile|requireRole` / `await searchParams` / `await params`
  with **no** data fetch — minimal, non-streaming latency. "No" = client component or fully static.
- **Needs new loading.tsx?** = Yes when the page (or its closest layout) does meaningful async server
  **DB** work and there is no `loading.tsx` covering it.
- **Segment-level error.tsx warranted?** — Yes = the segment does DB work that can fail in ways a closer,
  context-specific boundary should catch (detail pages keyed on `params`, finance/admin/GPS data). Group =
  the planned T1.6 route-group `error.tsx` boundary is sufficient (light pages, list pages already covered
  by the group). The root T1.6 boundaries are assumed; this column only flags where a **closer** boundary adds value.

---

## 1. Full segment table

### `(dashboard)` route group

The group has **`(dashboard)/loading.tsx`** (skeleton: title + 4 stat cards + panel). In the App Router a
single `loading.tsx` at the group root wraps the `{children}` of `(dashboard)/layout.tsx`, so it streams as
the fallback for **navigations into every dashboard segment that does not define its own closer `loading.tsx`**.
The dashboard `layout.tsx` itself is async (awaits `requireProfile()`); its own suspense fallback on a hard
load is the parent (root) boundary, not this file. "Needs new loading.tsx?" below is therefore "No (group)"
for segments adequately served by the shared skeleton, and "Yes" only where the shared generic skeleton is a
poor fit for a heavy/structurally-different page (detail pages, map) and a tailored skeleton is worth adding.

| Segment | Async server work? | Has loading.tsx? | Needs new loading.tsx? | Segment error.tsx warranted? | Confidence |
|---|---|---|---|---|---|
| `dashboard` | Yes (DB) — async SC, `Promise.all([stats, activeAgents, alerts, timeline, activeMissions, charts])` | No (group) | No (group skeleton is tailored to this page) | Group | High |
| `cases` | Yes (DB) — async SC, Supabase cases query + `Promise.all([count, clients])`; inner `<Suspense>` | No (group) | No (group) | Group | High |
| `cases/intake` | Yes (cheap) — async SC, only `requireRole` + `getTranslations`; renders intake client UI, no DB | No (group) | No (group) | Group | Medium (client-side fetch happens inside intake component; page itself is light) |
| `cases/[id]` | Yes (DB) — heavy async SC, case record + 5+ `Promise.all` batches + storage signed URLs; inner `<Suspense fallback={IntelligenceOverviewSkeleton}>` | No | **Yes** (tailored detail skeleton; generic group skeleton poor fit) | **Yes** (param-keyed detail; not-found/fetch failures) | High |
| `clients` | Yes (DB) — async SC, `supabase.from("clients").select` ; inner `<Suspense>` | No (group) | No (group) | Group | High |
| `clients/[id]` | Yes (DB) — async SC, `Promise.all([...])` client + cases | No | **Yes** (tailored detail skeleton) | **Yes** (param-keyed detail) | High |
| `agents` | Yes (DB) — async SC, `getAgents()` from queries lib; inner `<Suspense>` | No (group) | No (group) | Group | High |
| `agents/[id]` | Yes (DB) — heavy async SC, `Promise.all([...])`, 10 awaits | No | **Yes** (tailored detail skeleton) | **Yes** (param-keyed detail) | High |
| `gps-devices` | Yes (DB) — async SC, `supabase.from(...).select` | No (group) | No (group) | Group | High |
| `gps-devices/[id]` | Yes (DB) — async SC, `Promise.all([device, agents])` + follow-up queries | No | **Yes** (tailored detail skeleton) | **Yes** (param-keyed detail) | High |
| `gps-monitor` | Yes (DB) — async SC, `getGpsMonitorDevices()` from queries lib | No (group) | **Yes** (real-time monitor; group stat-card skeleton is a poor structural fit) | **Yes** (live-data surface) | Medium (page server-fetches once; live updates likely client-side) |
| `gps903-discovery` | Yes (DB) — async SC, service-role queries + conditional fetch + `Promise.all([cases, agents])` | No (group) | No (group) | **Yes** (external-device discovery can fail distinctly) | Medium |
| `gps903-credentials` | Yes (DB) — async SC, `requireRole` + service-client `select` | No (group) | No (group) | **Yes** (credential fetch can fail) | High |
| `map` | Yes (DB) — async SC, `Promise.all([agents, geofences, emergencyAlerts, geofenceEvents, gpsDevices])` | No (group) | **Yes** (full-bleed map; generic skeleton is a poor fit) | **Yes** (map surface, Google Maps load) | Medium (server fetch one-shot; map itself is client) |
| `field` | Yes (DB) — async SC, agent lookup + `Promise.all([photos, vehicles, locations])` | No (group) | No (group) | Group | High |
| `field/[id]` | Yes (DB) — heavy async SC, case + `Promise.all([...])` + storage signed URLs | No | **Yes** (tailored detail skeleton) | **Yes** (param-keyed detail) | High |
| `evidence` | Yes (DB) — async SC, evidence query + per-row storage signed URLs; inner `<Suspense>` | No (group) | No (group) | Group | High |
| `emergency` | Yes (DB) — async SC, `requireRole` + emergency alerts `select` | No (group) | No (group) | **Yes** (emergency surface; warrants its own fail-closed boundary) | High |
| `timeline` | Yes (DB) — async SC, agent/case scoping + entries query + evidence signed URLs; inner `<Suspense>` | No (group) | No (group) | Group | High |
| `analytics` | Yes (DB) — async SC, `getAgents()` + analytics computations | No (group) | No (group) | Group | High |
| `reports` | Yes (DB) — async SC, scoped case query | No (group) | No (group) | **Yes** (reporting failures distinct from list) | Medium |
| `invoices` | Yes (DB) — async SC, `Promise.all([...])`; inner `<Suspense>` | No (group) | No (group) | **Yes** (finance data) | High |
| `expenses` | Yes (DB) — async SC, `Promise.all([expenses, cases])`; inner `<Suspense>` | No (group) | No (group) | **Yes** (finance data) | High |
| `payroll` | Yes (DB) — async SC, `Promise.all([payments, agents, cases])`; inner `<Suspense>` | No (group) | No (group) | **Yes** (finance data) | High |
| `audit` | Yes (DB) — async SC, paginated `query.range` + `Promise.all([entities, profiles])`; inner `<Suspense>` | No (group) | No (group) | **Yes** (admin/compliance surface) | High |
| `users` | Yes (DB) — async SC, profiles + `auth.admin.listUsers()` (service client) + agents; two inner `<Suspense>` | No (group) | No (group) | **Yes** (admin + service-role calls fail distinctly) | High |
| `settings` | Yes (cheap) — async SC, only `requireRole(["admin"])` + `getTranslations`; no DB | No (group) | No (light) | Group | High |
| `settings/profile` | Yes (cheap) — async SC, `requireProfile` + `getTranslations` only; no DB on page | No (group) | No (light) | Group | High |
| `settings/ai-prompts` | Yes (DB) — async SC, `getAllAiPrompts()` + `Promise.all(getAiPromptVersions(...))` | No (group) | No (group) | **Yes** (settings data fetch) | High |

### `(auth)` route group

Layout `(auth)/layout.tsx` is async but only awaits `getTranslations` (cheap, no DB).

| Segment | Async server work? | Has loading.tsx? | Needs new loading.tsx? | Segment error.tsx warranted? | Confidence |
|---|---|---|---|---|---|
| `login` | No — `'use client'` component, `useActionState` + `useSearchParams`; own inner `<Suspense>` fallback | No | No (client; no server await) | Group | High |
| `login/verify` | Yes (cheap) — async SC, only `await searchParams`; renders client form inside `<Suspense>` | No | No (no DB; self-Suspended) | Group | High |
| `register` | No — sync default export, static/client form, no await | No | No | Group | High |

### `(portal)` route group

Layout `(portal)/portal/layout.tsx` is async, awaits `requireProfile("/portal/login")` + role redirect + translations (cheap, no DB).

| Segment | Async server work? | Has loading.tsx? | Needs new loading.tsx? | Segment error.tsx warranted? | Confidence |
|---|---|---|---|---|---|
| `portal` | Yes (DB) — async SC, client lookup + `Promise.all([cases, invoices])` | No | **Yes** (no group loading.tsx exists for portal) | Group (T1.6 portal boundary) | High |
| `portal/cases/[id]` | Yes (DB) — async SC, client + case + `Promise.all([invoices, messages, myView])` | No | **Yes** (param-keyed detail; no portal loading.tsx) | **Yes** (param-keyed detail) | High |

### `(portal-auth)` route group

Layout `(portal-auth)/layout.tsx` is async but only awaits `getTranslations` (cheap, no DB).

| Segment | Async server work? | Has loading.tsx? | Needs new loading.tsx? | Segment error.tsx warranted? | Confidence |
|---|---|---|---|---|---|
| `portal/login` | No — `'use client'` component, `useActionState` + `useSearchParams`; own inner `<Suspense>` | No | No (client) | Group | High |
| `portal/login/verify` | Yes (cheap) — async SC, only `await searchParams`; client form inside `<Suspense>` | No | No (no DB; self-Suspended) | Group | High |

### Root segments

| Segment | Async server work? | Has loading.tsx? | Needs new loading.tsx? | Segment error.tsx warranted? | Confidence |
|---|---|---|---|---|---|
| `app/page.tsx` (marketing home) | Yes (cheap) — async SC, only `getTranslations("home")` / `("meta")`; no DB | No | No (light, no DB) | Group (covered by global-error / root boundary) | High |
| `app/privacy/page.tsx` | No — sync default export, fully static content | No | No | Group | High |
| `app/layout.tsx` (root) | Yes (cheap) — async, awaits `getLocale()` + `getMessages()` (i18n bootstrap), no DB | n/a (root) | No (root-level; T1.6 `global-error.tsx` covers) | n/a | High |

---

## 2. Existing `loading.tsx` confirmation

- **Confirmed present:** exactly one — `src/app/(dashboard)/loading.tsx` (a `Skeleton`-based fallback:
  one `h-9 w-64` title bar, a 4-cell stat-card grid, and an `h-80` panel).
- **Verified no others exist.** Verification command:
  `find /Users/thomas/agent-tracker/src/app \( -name "loading.tsx" -o -name "error.tsx" -o -name "global-error.tsx" \)`
  returned **only** `src/app/(dashboard)/loading.tsx`. No `error.tsx` and no `global-error.tsx` exist anywhere
  under `src/app/`. A direct `find ... -name loading.tsx | wc -l` returned `1`.

---

## 3. Phase-2 work list

### (i) Segments that get a NEW `loading.tsx`

These do meaningful async **server DB** work and either have no group-level fallback (portal group has none) or
the shared `(dashboard)/loading.tsx` generic skeleton is a poor structural fit (detail pages, map, monitor):

| New `loading.tsx` for | Reason | Task group |
|---|---|---|
| `(dashboard)/cases/[id]` | Heavy param-keyed detail; tailored skeleton | T2.1 |
| `(dashboard)/clients/[id]` | Param-keyed detail; tailored skeleton | T2.1 |
| `(dashboard)/agents/[id]` | Heavy param-keyed detail; tailored skeleton | T2.2 |
| `(dashboard)/field/[id]` | Heavy param-keyed detail + signed URLs; tailored skeleton | T2.2 |
| `(dashboard)/gps-devices/[id]` | Param-keyed detail; tailored skeleton | T2.3 |
| `(dashboard)/gps-monitor` | Live monitor; group stat-card skeleton ill-fitting | T2.3 |
| `(dashboard)/map` | Full-bleed map surface; generic skeleton ill-fitting | T2.3 |
| `(portal)/portal` | No portal-group `loading.tsx` exists at all | T2.7 |
| `(portal)/portal/cases/[id]` | No portal loading.tsx; param-keyed detail | T2.7 |

**Total NEW `loading.tsx`: 9.** All other dashboard list/index pages are intentionally left to the shared
`(dashboard)/loading.tsx` group skeleton (no new file). Auth, portal-auth, root home, privacy, settings, and
cases/intake do no DB work (or are client) and need no new `loading.tsx`.

> Note (Medium-confidence items): `gps-monitor`, `map`, and `cases/intake` server-fetch once and then hand off
> to client components for live/interactive behavior. They are listed for a tailored skeleton because the
> first server render still awaits DB; confirm during T2.3 whether a bespoke skeleton beats the group default.

### (ii) Segments warranting a segment-level `error.tsx` (closer than the T1.6 group boundary)

Mapped to T2.x groups. "Group" segments in the table rely on the T1.6 route-group `error.tsx` and get **no**
closer boundary.

| Segment-level `error.tsx` for | Reason | Task group |
|---|---|---|
| `(dashboard)/cases/[id]` | Param-keyed detail, not-found/fetch failure | T2.1 |
| `(dashboard)/clients/[id]` | Param-keyed detail | T2.1 |
| `(dashboard)/agents/[id]` | Param-keyed detail | T2.2 |
| `(dashboard)/field/[id]` | Param-keyed detail + storage signed URLs | T2.2 |
| `(dashboard)/evidence` | (optional) storage-heavy; **deferred — Group** | T2.2 |
| `(dashboard)/gps-devices/[id]` | Param-keyed detail | T2.3 |
| `(dashboard)/gps-monitor` | Live-data surface | T2.3 |
| `(dashboard)/map` | Map surface (Google Maps load can fail) | T2.3 |
| `(dashboard)/gps903-discovery` | External-device discovery failures | T2.3 |
| `(dashboard)/gps903-credentials` | Credential fetch failures | T2.3 |
| `(dashboard)/invoices` | Finance data | T2.4 |
| `(dashboard)/expenses` | Finance data | T2.4 |
| `(dashboard)/payroll` | Finance data | T2.4 |
| `(dashboard)/reports` | Reporting failures distinct from lists | T2.4 |
| `(dashboard)/emergency` | Emergency surface — fail-closed boundary | T2.5 |
| `(dashboard)/audit` | Admin/compliance surface | T2.5 |
| `(dashboard)/users` | Admin + service-role (`auth.admin.listUsers`) failures | T2.5 |
| `(dashboard)/settings/ai-prompts` | Settings data fetch | T2.5 |
| `(portal)/portal/cases/[id]` | Param-keyed portal detail | T2.7 |

**Total segment-level `error.tsx`: 18 recommended** (19 rows above minus the deferred/optional `evidence`,
which stays on the Group boundary). Auth (T2.6) and portal-auth need no segment-level `error.tsx` — they are
client/static or self-Suspended and rely on their group boundary.

> The T1.6 route-group `error.tsx` boundaries (one per group: `(dashboard)`, `(auth)`, `(portal)`,
> `(portal-auth)`) and the root `global-error.tsx` are assumed in place. Every "Group" segment depends on them;
> the segments above add a **closer** boundary on top of that baseline.

---

## 4. Summary line

**Segments audited: 38** (37 enumerated + root home + privacy; 5 layouts inspected for context).
**Needing a NEW `loading.tsx`: 9** (cases/[id], clients/[id], agents/[id], field/[id], gps-devices/[id],
gps-monitor, map, portal, portal/cases/[id]).
**Warranting a segment-level `error.tsx`: 18** (plus 1 optional/deferred — evidence).
**Low-confidence to double-check: 0 Low; 6 Medium** — `cases/intake`, `gps-monitor`, `gps903-discovery`,
`map`, `reports`, `gps903-credentials`/portal monitor edge — all flagged Medium because they either fetch once
server-side then go client-interactive, or have external/conditional fetch paths; re-confirm streaming fit
during T2.x. **Confirmed: no `loading.tsx` exists anywhere under `src/app/` other than
`(dashboard)/loading.tsx`; no `error.tsx` / `global-error.tsx` exist yet.**
