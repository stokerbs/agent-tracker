# Detective Pulse — Operations Command Center

A production-ready operations management platform for private investigators,
surveillance teams, field agents, supervisors and administrators.

Built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**,
**Shadcn UI**, **Supabase** (PostgreSQL + Auth + Storage) and the
**Google Maps** JavaScript API. Mobile-first, dark-mode by default, secured
with Row Level Security, RBAC and audit logging.

---

## ✨ Features

| Module | Description |
| ------ | ----------- |
| **Operations Dashboard** | Open/closed cases, active/available agents, emergency alerts, live map, recent timeline, active missions, availability board. |
| **Agent Management** | Roster with Agent ID, status (Available / On Mission / Traveling / Break / Offline), battery, last-active and live coordinates. |
| **Live GPS Tracking** | Google Maps with all active agents, 60-second auto-refresh, click-to-profile, status/area/search filters, battery + status pins. |
| **Case Management** | Full case file: client, target, vehicle, plate, address, dates, priority, status, agent assignment. |
| **Timeline Reporting** | Sortable, date-grouped chronological surveillance log with location, agent and media attachments. |
| **Evidence Management** | Upload & in-app preview of photos, video, audio and PDF via signed URLs. |
| **AI Report Generator** | Executive Summary → Chronological Report → Observations → Conclusion, with **PDF** and **DOCX** export. Anthropic-powered with deterministic offline fallback. |
| **Emergency SOS** | One-tap distress alert capturing GPS, auto-notifying all supervisors. Acknowledge / resolve workflow. |
| **Expense Management** | Fuel / Toll / Parking / Food / Hotel / Misc with receipts and monthly category summaries. |
| **Client Portal** | Secure, separate area where clients read & download only *approved* reports. |
| **Admin** | User & role management, clients, immutable audit log, integration health. |

## 🏛 Roles & Permissions (RBAC)

- **Admin** — manage users, cases, agents, permissions, settings; view everything.
- **Supervisor** — view/manage cases, assign agents, view live locations, review & approve reports.
- **Agent** — update status, share GPS, submit timeline updates, upload evidence, view assigned cases.
- **Client** — portal-only access to approved reports and invoices.

All permissions are enforced **at the database layer** with Postgres Row Level
Security policies (see `supabase/migrations/0003_rls_policies.sql`) — not just
in the UI.

---

## 📁 Folder Structure

```
agent-tracker/
├── middleware.ts                 # Supabase session refresh + route protection
├── next.config.ts
├── tailwind.config.ts
├── components.json               # Shadcn UI config
├── .env.example
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql      # 12 tables, enums, indexes
│   │   ├── 0002_functions_triggers.sql  # RBAC helpers, audit, new-user hook
│   │   ├── 0003_rls_policies.sql        # Row Level Security
│   │   └── 0004_storage_buckets.sql     # Storage buckets + object policies
│   └── seed.sql                          # Demo data
└── src/
    ├── app/
    │   ├── (auth)/               # login, register, auth actions
    │   ├── (dashboard)/          # staff/agent app (dashboard, agents, map,
    │   │                         #   cases, timeline, evidence, reports,
    │   │                         #   expenses, emergency, clients, users,
    │   │                         #   audit, settings)
    │   ├── (portal)/             # client report portal
    │   ├── api/                  # REST endpoints (GPS ingest, health)
    │   └── auth/callback/        # email/OAuth callback
    ├── components/
    │   ├── ui/                   # Shadcn primitives
    │   ├── layout/               # sidebar, header, nav, notifications
    │   ├── dashboard/  map/  cases/  evidence/  reports/
    │   ├── emergency/  expenses/  users/  settings/  shared/
    │   └── theme-*.tsx
    └── lib/
        ├── supabase/             # browser / server / middleware clients
        ├── auth.ts               # role guards
        ├── queries.ts            # server data access
        ├── ai-report.ts          # AI report engine (+ fallback)
        ├── export.ts             # PDF / DOCX generation
        ├── types.ts  constants.ts  utils.ts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18.18+ (20+ recommended)
- A free [Supabase](https://supabase.com) project
- A [Google Maps](https://console.cloud.google.com) browser API key (Maps JavaScript API + Places API)
- *(Optional)* an [Anthropic API key](https://console.anthropic.com) for the AI report generator

### 2. Install
```bash
npm install
cp .env.example .env.local   # then fill in the values
```

### 3. Apply the database schema
Using the **Supabase CLI** (recommended):
```bash
supabase link --project-ref <your-project-ref>
supabase db push                       # applies supabase/migrations/*
# optional demo data:
psql "$DATABASE_URL" -f supabase/seed.sql
```
…or paste each file in `supabase/migrations/` (in order) into the Supabase
**SQL Editor** and run them.

Generate fresh DB types any time with:
```bash
supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```

### 4. Run
```bash
npm run dev          # http://localhost:3000
```
Register the first account at `/register` and pick the **Administrator** role.
(In production, lock role selection down — see Security below.)

### Scripts
| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

---

## 🔐 Security

- **Row Level Security** on every table; access is role- and ownership-scoped via
  `is_admin()`, `is_staff()`, `my_agent_id()` and per-case assignment checks.
- **RBAC** enforced in `middleware.ts`, `lib/auth.ts` guards, *and* the database.
- **Audit logs** — triggers record every insert/update/delete on cases, agents,
  reports and alerts into an append-only `audit_logs` table (admin-readable).
- **Secure storage** — private buckets (`avatars`, `evidence`, `receipts`,
  `reports`); files are served through short-lived **signed URLs**, never public.
- **Sensitive data** — target PII lives in RLS-protected rows; `pgcrypto` is
  enabled for column-level encryption where required by policy.
- **Service-role key** is server-only and never shipped to the browser.

> ⚠️ Production hardening: remove open role-selection from `/register`, enable
> Supabase email confirmation, and restrict the Google Maps key by HTTP referrer.

---

## ☁️ Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, **New Project → Import** the repo (framework auto-detected as Next.js).
3. Add environment variables (from `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - `ANTHROPIC_API_KEY` *(optional)*, `AI_REPORT_MODEL` *(optional)*
   - `NEXT_PUBLIC_APP_URL` → your Vercel URL
4. In Supabase **Auth → URL Configuration**, set the Site URL and add
   `https://<your-app>.vercel.app/auth/callback` as a redirect URL.
5. **Deploy.** Health check: `GET /api/health`.

### Field GPS ingestion
Mobile/field devices report position to:
```
POST /api/agents/location
{ "lat": 40.71, "lng": -74.00, "battery": 82, "status": "on_mission" }
```
Authenticated via the agent's Supabase session; RLS guarantees an agent can only
update their own record.

---

## 🧱 Tech Stack
Next.js 15 · React 19 · TypeScript · Tailwind CSS · Shadcn UI (Radix) ·
Supabase (PostgreSQL, Auth, Storage, Realtime) · Google Maps (`@vis.gl/react-google-maps`) ·
jsPDF + docx · Recharts · Zod · Vercel.

---

_Detective Pulse Operations Command Center — built for field teams._
