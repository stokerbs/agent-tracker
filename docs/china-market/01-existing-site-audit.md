# 01 · Existing-Site Audit (detectivepulse.com)

Audit date: 2026-10-01 · Branch: `claude/blissful-euler-2qwatr` · Scope: the public marketing host only (the ops app on `detectivepulse.app` is out of scope except where the lead pipeline lands there).

## 1. Current stack

| Layer | What is actually in the repo |
|---|---|
| Framework | Next.js 15 App Router (`next@^15.5`), React 19, TypeScript strict |
| Hosting | Vercel (`vercel.json`, cron routes), host-split rendering: `detectivepulse.com` = marketing, `detectivepulse.app` = ops app (`src/lib/marketing/host.ts`) |
| Data | Supabase (Postgres + RLS + Storage), 123 migrations, service-role writes only from `server-only` route handlers |
| Styling | Tailwind 3.4 + `theme-detective` dossier palette (`globals.css` `.dp-*` utilities), Radix UI, lucide icons |
| i18n (app) | `next-intl` cookie-based `th`/`en` — **used by the app only, not the marketing site** |
| i18n (marketing) | URL-prefix based: `/` = Thai, `/en/*`, `/zh/*`; per-page copy tables inside components (`lead-form.tsx`, `sticky-contact-bar.tsx`, `contact-fab.tsx`) |
| Analytics | GTM via `@next/third-parties`, deferred until first interaction (`deferred-gtm.tsx`), host-gated to `.com`; GA4 / Google Ads tags configured inside GTM by an agency |
| Observability | Sentry (`@sentry/nextjs`), `reportError()` in `src/lib/errors.ts` |
| Anti-abuse | Upstash sliding-window rate limit (`src/lib/rate-limit.ts`), honeypot field, PDPA consent literal |
| Email / chat | Resend (email), LINE OA webhook + push (`src/lib/line`), WhatsApp deep links |
| Tests / CI | Vitest (co-located `*.test.ts`), GitHub Actions: typecheck · lint · test |
| Native | Capacitor shell for the ops app — irrelevant to marketing |

## 2. Current routing (marketing host)

```
/                              Thai homepage (MarketingHome) — host-switched in src/app/page.tsx
/[slug]                        27 Thai pages migrated from WordPress (markdown in src/content/marketing/*.md)
/articles, /articles/[slug]    Thai AI-generated articles (DB: marketing_articles)
/careers                       Recruitment form
/en, /en/[slug], /en/articles  English mirror (27 pages + articles)
/zh                            ★ Chinese homepage already exists (MarketingHomeZH)
/zh/articles, /zh/articles/[slug]  ★ Chinese AI articles (DB columns zh_slug/zh_title/zh_body, migration 0102)
/lp/[slug]                     Noindexed Google-Ads landing pages (Thai)
/privacy, /support             Legal / support
/api/marketing/lead            Public lead POST → marketing_leads
/api/marketing/careers         Public application POST
/api/marketing/assistant       Public AI chat assistant (also creates leads with source=assistant)
/api/og                        OG image
/sitemap.xml, /robots.txt      src/app/sitemap.ts, src/app/robots.ts
```

## 3. Current SEO architecture

**Working well**
- Per-page `metadata` with canonical + `alternates.languages` (th/en/zh) on home, article index, article pages.
- `sitemap.ts` covers TH/EN pages, articles and `/zh`, `/zh/articles`, `/zh/articles/*`.
- `robots.ts` blocks app paths, points at sitemap; non-marketing hosts get `X-Robots-Tag: noindex` from `next.config.ts`.
- JSON-LD: `ProfessionalService` + `AggregateRating` + `FAQPage` on homes, `BlogPosting` on articles, `BreadcrumbList` via `Breadcrumb`.
- `htmlLimitedBots: /.*/` forces blocking metadata into `<head>` for all UAs (crawler-safe).
- OG image endpoint, security headers, CSP per host.
- Lighthouse per `marketing-insights`: SEO 100, A11y 100, Perf ~87 mobile, CLS 0.

**Technical SEO issues found (fixed or scheduled in this work)**
| # | Issue | Impact | Fix |
|---|---|---|---|
| T1 | `<html lang>` comes from the app's `locale` cookie (`th`/`en`) — `/zh` pages render `lang="th"` | Wrong language signal for every Chinese page | Middleware sets `x-marketing-lang`; root layout reads it → `lang="zh-CN"` on `/zh/*` |
| T2 | hreflang uses `zh` (bare) and there is no `x-default` | Google accepts `zh` but `zh-Hans`/`zh-CN` is the correct target for Simplified Chinese; missing x-default | Shared `zhAlternates()` helper emits `zh-CN`, `th`, `en`, `x-default` |
| T3 | `/zh` has only a homepage + articles — no service, location, process, pricing, about or contact pages | No pages can rank for service / location intent; all Chinese demand funnels into one URL | 13 service/info pages + 6 location pages built from a typed registry |
| T4 | Chinese homepage JSON-LD `ProfessionalService.description` is Thai; no `inLanguage` | Mixed-language entity signals | zh-aware business JSON-LD |
| T5 | `LangSwitch` sends every Chinese visitor to `/zh` home regardless of page; header nav is Thai-only on `/zh` | Navigation/UX loss, internal-link dilution | zh nav + counterpart mapping |
| T6 | Article covers on `/zh` call `getArticleCover(..., "en")` | Cosmetic | Leave (shared asset) |
| T7 | No breadcrumbs on `/zh` beyond articles | Minor | Breadcrumb on every new page |
| T8 | Chinese homepage services link to `#contact` (no deep pages) | Dead-end internal linking | Services now link to service pages |

## 4. Current analytics

- GTM container id from `NEXT_PUBLIC_GTM_ID`, marketing host only, deferred load.
- Events fired from code: `lead_submitted {case_type, locale}` and `career_application {position, locale}`.
- **Gaps:** no CTA-click events (LINE/WhatsApp/WeChat), no service-page view dimension, no funnel stages, no landing-page/source attribution stored on the lead row, no revenue fields. `marketing-insights` page charts weekly lead counts only.

## 5. Existing service pages

- Thai: 27 WordPress-migrated pages (cheating spouse, asset tracing, background check, find missing person, cyber, hire a detective, pricing, contact …).
- English: full 1:1 mirror of the 27 Thai pages under `/en/<slug>`.
- Chinese: **none** — only the homepage service cards (婚外情调查 / 财产调查 / 背景调查 / 寻人 / 网络调查 / 聘请侦探) linking to `#contact`.

## 6. Existing language support

- TH (default, no prefix), EN (`/en`), ZH (`/zh` — home + articles only). ZH copy exists for: homepage, FAQ (`FAQ_ZH`, 10 items), lead form, sticky bar, contact FAB, AI article pipeline (`marketing_articles.zh_*`).
- The Chinese copy is a consumer-detective translation of the Thai positioning (婚外情 first). It is **not** positioned for the cross-border segments (remote spouse, due diligence, on-site verification) and does not mention WeChat as the primary channel.

## 7. Reusable components (reused by this build)

`SiteChrome`, `DetectiveHero`, `StatBand`, `SectionHeading`/`Eyebrow`/`FileTag`/`Stamp`/`CornerTicks`, `Faq`, `Breadcrumb` (with BreadcrumbList JSON-LD), `LeadForm` (kept for simple enquiries), `MarketingJsonLd`/`ArticleJsonLd`, `brand-icons` (incl. `WeChatIcon`), `StickyContactBar`, `ContactFab`, `DeferredGTM`, `ArticleCover`, `RelatedArticles`, `mdComponents`, `/api/og`.

Server patterns reused: rate-limit → zod → honeypot → service-role insert → `after()` notify (`/api/marketing/lead`), `logAudit`, `requireRole`, `notifyRole`.

## 8. Current contact flow

1. Visitor lands → `ContactFab` auto-opens once (LINE / WhatsApp / call / Facebook / email).
2. Mobile sticky bar: Call + LINE.
3. Form → `POST /api/marketing/lead` → `marketing_leads` (name, phone, email?, case_type?, message?, locale, source, consent_at, status `new|contacted|closed`).
4. `notifyRole(['admin'])` → in-app + push + LINE.
5. Admin triages in `/leads` (read-only table; no stage change UI).
6. WeChat: shown as static text `WeChat: DetectivePulse` on `/zh`; QR image `public/marketing/btn-wechat.jpg` is only rendered on the **Thai** homepage.

## 9. Current schema (marketing-relevant)

- `marketing_leads` (0097–0099): see §8. RLS: admin select/update only; inserts via service role.
- `recruitment_applications` (0100).
- `marketing_articles` (0101–0102): th/en/zh columns, publish workflow via LINE review token.
- No lead attribution, pipeline stage, value, or file-attachment tables.

## 10. Facts present in the project that must stay verifiable

Already displayed on `/zh` and reused unchanged — **confirm before launch** (see `16-facts-requiring-confirmation.md`): Est. 2016 · 1,953+ closed cases · 77 provinces · 4.8★ / 63 Fastwork reviews · phone numbers +66 96 846 1406 and +66 80 918 8324 · email detectivepluse@gmail.com · WeChat ID "DetectivePulse" + QR image · 50 % deposit / non-refundable on cancellation.

## 11. Verdict

The foundation is strong (Next 15, SSR, metadata, sitemap, GTM, lead API, admin triage). The Chinese layer is a thin translation with one URL. The correct move is **extend, not rebuild**: keep `/zh`, add a typed content registry and 19 pages, upgrade the lead object into a pipeline, and wire WeChat as the primary Chinese channel.
