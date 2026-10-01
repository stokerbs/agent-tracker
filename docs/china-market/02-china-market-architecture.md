# 02 · China Market Architecture

## Decision 1 — URL prefix: keep `/zh`, redirect `/cn/*`

The brief asks for `/cn/`. The repo already serves `/zh` (homepage + articles) and it is in the sitemap, hreflang graph and Search Console. `zh` is the ISO-639-1 **language** code; `cn` is a **country** code and would split signals (one Chinese site under two prefixes). Keeping `/zh` avoids a migration, preserves existing indexing, and matches `/en`.

- All new Chinese pages live under `/zh/...` with the exact slugs requested in the brief.
- `next.config.ts` 301s `/cn` and `/cn/:path*` → `/zh/:path*`, so every `/cn/...` URL in the brief resolves.
- hreflang target: `zh-CN` (Simplified, mainland) + `x-default`.

## Decision 2 — one domain, one codebase

`detectivepulse.com/zh` on the existing Vercel deployment. A `.cn` domain or ICP-licensed mainland hosting is **not** justified in Phase 1: the business is Thai-registered, the audience includes overseas Chinese (Singapore/Malaysia/HK/Taiwan/diaspora) who use Google, and Baidu indexes foreign-hosted sites. Revisit only if measured mainland traffic proves ICP/TTFB is the bottleneck (see 15 · Technical plan §Baidu).

## Decision 3 — positioning per segment

| Segment | Chinese entry page | Primary CTA | Secondary |
|---|---|---|---|
| A · Relationship | `/zh/relationship-investigation` | 微信咨询 | 提交案件资料 |
| B · Find a person | `/zh/find-person-thailand` | 微信咨询 | 提交案件资料 |
| C · Background verification | `/zh/background-check` | 微信咨询 | 提交案件资料 |
| D · Business due diligence (B2B, premium) | `/zh/business-due-diligence` | 提交案件资料 (requirements) | 微信 / 邮件 |
| E · On-site verification | `/zh/on-site-verification` | 提交案件资料 | 微信咨询 |

Consumer segments (A/B/C) are driven to WeChat first (fast trust, 1:1). B2B segments (D/E) are driven to the structured intake first (they need a written scope and quotation), with WeChat/email as secondary.

## Funnel → system mapping

```
DISCOVERY        Google / Baidu organic (/zh pages, articles), referrals, partner links
TRUST            about, how-it-works, case-studies, deliverables, policies, verifiable facts
CHINESE WEBSITE  /zh/* (19 pages + articles)
CONSULTATION     WeChat (QR + ID), email, structured intake form
QUALIFICATION    marketing_leads row with service/country/location/budget/urgency → stage=qualified
QUOTATION        stage=quotation_sent, quoted_value
PAYMENT          stage=payment_pending → paid (existing 50 % deposit process)
CASE ONBOARDING  stage=case_created → links to cases (existing ops app)
```

## Codebase architecture

```
src/lib/marketing/zh/
  pages.ts            typed registry: 13 service/info pages (slug, meta, H1, sections, FAQ, CTA)
  locations.ts        6 location pages with unique local context
  alternates.ts       hreflang helper (zh-CN / th / en / x-default)
  lead-ref.ts         Case Lead ID generator  (CN-YYMMDD-XXXX)
  intake-schema.ts    zod schema shared by form + API (server is the authority)
  pipeline.ts         13 pipeline stages + transitions + labels
src/lib/marketing/analytics.ts   typed track() wrapper over GTM dataLayer
src/components/marketing/zh/
  wechat-cta.tsx      QR + ID modal (primary CTA), analytics-instrumented
  zh-intake-form.tsx  structured intake (loading/error/empty/success states)
  zh-page.tsx         page renderer (hero, sections, deliverables, FAQ, CTA band)
  zh-nav.tsx          Chinese header nav + mobile sticky (WeChat primary)
src/app/(marketing)/zh/
  page.tsx            homepage (repositioned copy)
  [slug]/page.tsx     service / info / location pages from the registry
  articles/*          (existing)
src/app/api/marketing/zh-intake/route.ts   multipart intake API
supabase/migrations/0124_marketing_leads_pipeline.sql
src/app/(dashboard)/leads/*                admin pipeline view + stage action
```

Everything is server-rendered (SSG via `generateStaticParams`, `dynamicParams=false`), so Chinese pages are plain HTML for crawlers with zero client JS beyond the CTA/form islands.

## Trust system (where each element lives)

| Element | Page | Status |
|---|---|---|
| Company information, Thailand office | `/zh/about`, footer | **Requires confirmation** (no address/registration in repo) |
| Years of experience (since 2016) | StatBand, about | Present in site — confirm |
| Completed cases | StatBand | Present (1,953+) — confirm or remove |
| Verified reviews | home | Fastwork 4.8★/63 — confirm source link |
| Anonymised case studies | `/zh/case-studies` | Template shipped, **zero published until DP supplies real cases** (page noindexed while empty) |
| Example report screenshots | `/zh/how-it-works` | Placeholder slot — requires redacted samples |
| Coverage | `/zh/bangkok` … `/zh/samui` | Built |
| Communication process | `/zh/how-it-works` | Built |
| Confidentiality / privacy / terms / refund | `/zh/about` → `/privacy`; refund rule (deposit non-refundable) from existing FAQ | Chinese privacy/terms page **requires legal review** |

## Compliance guardrails baked into the copy

- No promise of database access, phone records, bank records, location tracking of phones, or "any information".
- Each service page has a "我们不做什么" (what we don't do) block.
- No surveillance tactics are described; methods are described at the level of "lawful observation, open-source research, on-site visits, document review".
- No paid-media code paths. Analytics is organic/referral attribution only.
