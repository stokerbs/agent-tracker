# PROJECT_RULES

## Branch naming
Use a Conventional-Commits-style prefix matching the change type:
feature/* (or feat/*)
fix/*
hotfix/*
refactor/*
perf/*
chore/*

## Pull Request Checklist
- [ ] Security reviewed
- [ ] QA approved
- [ ] Tests passing
- [ ] Documentation updated
- [ ] No secrets committed

## Coding Standards
- Strict TypeScript
- Small reusable components
- Server-side authorization
- Audit logging for sensitive actions

## Code Organization
These conventions are intentional — follow the existing pattern rather than
flattening everything into one location.

- **Components.** Route-specific components are co-located inside their `app/`
  segment, next to the `page.tsx` that uses them (e.g.
  `cases/[id]/intelligence-tab.tsx`). Only components shared across routes live
  in `src/components/`.
- **Server actions.** A feature's `"use server"` actions are split by domain
  concern, not crammed into one file — e.g. `cases/` has `actions.ts`,
  `board-actions.ts`, `gps-actions.ts`, and `[id]/message-actions.ts`. Keep a
  file per cohesive concern; don't merge unrelated concerns.
- **Tests.** Unit tests are co-located next to their source (`foo.ts` →
  `foo.test.ts`). Cross-cutting / integration tests that span multiple modules
  (and have no single source file to sit beside) live in `src/__tests__/`.
