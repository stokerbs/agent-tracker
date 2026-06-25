# Detective Pulse System Architecture

Purpose

Operations Center for private investigators.

Primary stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Google Maps
- Capacitor
- Claude API

Golden Rules

1. Never bypass Supabase RLS.
2. Never trust client-side validation.
3. Never expose secrets.
4. Every feature requires loading, error and empty states.
5. Every feature requires logging.
6. Every feature requires tests.
7. Every change should be production-ready.

Core Modules

- Authentication
- Operations Dashboard
- Cases
- Timeline
- Evidence
- Reports
- AI Reports
- Live GPS
- Emergency SOS
- Notifications
- Client Portal
- Expenses
- Native Mobile

Architecture Workflow

Plan

↓

Build

↓

Security Review

↓

QA Review

↓

Merge
