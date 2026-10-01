# 15 · Technical Implementation Plan

## What this PR changes (branch `claude/blissful-euler-2qwatr`)

| Area | Files | Notes |
|---|---|---|
| Content registry | `src/lib/marketing/zh/{types,pages,locations,registry,nav,home,company,case-studies}.ts` | typed; tests enforce slugs, SEO limits, lawful-scope invariants, unique location copy |
| Routes | `src/app/(marketing)/zh/page.tsx`, `src/app/(marketing)/zh/[slug]/page.tsx` | SSG, `dynamicParams=false`, metadata + hreflang |
| Components | `src/components/marketing/zh/{zh-page,zh-intake-form,wechat-cta,contact-links,zh-page-view,zh-json-ld,zh-case-studies}.tsx`, `site-nav.tsx`, patched `site-chrome.tsx`, `sticky-contact-bar.tsx`, `lang-switch.tsx`, `marketing-home-zh.tsx` | Chinese nav/footer/sticky only on `/zh/*` |
| SEO | `middleware.ts` (+ `x-marketing-lang`), `src/app/layout.tsx` (`<html lang>`), `next.config.ts` (`/cn/*` 301), `src/app/sitemap.ts`, `zh/alternates.ts` | |
| Lead pipeline | `supabase/migrations/0124_marketing_leads_pipeline.sql`, `src/lib/database.types.ts`, `src/app/api/marketing/zh-intake/route.ts`, `src/lib/rate-limit.ts` (`zh_intake`), `src/lib/marketing/zh/{intake-schema,lead-ref,pipeline}.ts` | service-role writes only; admin RLS reads; private bucket |
| Admin | `src/app/(dashboard)/leads/{page,actions,lead-pipeline-controls}.tsx` | stage/value editing, signed file URLs, audit log |
| Analytics | `src/lib/marketing/analytics.ts` | typed `track()` |
| Tests | `src/lib/marketing/zh/*.test.ts` | lead-ref, schema, registry, pipeline, alternates |
| Docs | `docs/china-market/*`, `docs/DATABASE.md`, `.env.example` | |

## Deployment steps (DevOps)
1. Apply migration 0124 (`supabase db push` or the project's migration runner). Verify: `select stage, lead_ref from marketing_leads limit 1;` and the `lead-files` bucket exists with `public=false`.
2. Set env on Vercel: `NEXT_PUBLIC_WECHAT_ID` (confirmed ID), optionally `NEXT_PUBLIC_WECHAT_QR` (if replacing `/marketing/btn-wechat.jpg`).
3. Deploy; smoke test: `/zh`, `/zh/contact` (submit a test intake with a file → `/leads` shows it with a `CN-…` ref and a stage selector), `/cn/pricing` → 301.
4. GSC: submit sitemap; URL-inspect 3 zh pages; confirm `<html lang="zh-CN">` and hreflang in the rendered HTML.
5. GTM: add GA4 event tags per `12-analytics-events.md`.

## Technical SEO checklist (status)
- [x] Chinese metadata per page · [x] H1/H2 structure · [x] canonical · [x] hreflang `zh-CN`/`th`/`en`/`x-default` · [x] `<html lang="zh-CN">` · [x] sitemap · [x] robots (unchanged) · [x] structured data (ProfessionalService zh, Service, FAQPage, BreadcrumbList) · [x] internal linking (nav, footer, related, CTA) · [x] breadcrumbs · [x] images: existing optimised assets only · [x] SSR/SSG · [ ] Core Web Vitals re-measure after deploy (expected unchanged: no new client JS on the critical path) · [ ] indexability check in GSC after deploy.

## Baidu considerations (decision: no `.cn`, no ICP in Phase 1)
- Baidu crawls foreign-hosted sites; TTFB from Vercel's HK/SG edge is acceptable. Submit via Baidu Webmaster (free) once the site has a Baidu account holder (requires a mainland phone/ID — **requires confirmation**).
- `zh-CN` + Simplified characters + descriptive `<title>` matter more than hosting location for Baidu's ranking of foreign sites.
- Revisit ICP/mainland CDN only if Baidu organic becomes a measurable channel (Phase 4 data).

## Security posture (for the security-reviewer gate)
- Public intake: rate-limited (3/h/IP), zod-validated server-side, honeypot, consent literal, file count/type/size validated **before** any write, storage key is a UUID (user filename only stored as a sanitised display string), private bucket with no anon policies, service-role client used only inside the route handler.
- Admin surface: `requireRole(['admin'])` on page and actions; RLS policies for select/update on `marketing_leads` and select/delete on `marketing_lead_files`; signed URLs are 10-minute and audited (`LEAD_FILE_VIEW`); pipeline edits audited (`LEAD_STAGE_CHANGE`).
- No secrets added; env vars are `NEXT_PUBLIC_*` display values only.
- Analytics payloads carry no PII.

## Out of scope / follow-ups
Chinese privacy/terms page (legal), partner page, insights funnel panel, article generator prompt update, PDF company profile, payment rails documentation.
