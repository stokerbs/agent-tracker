# 14 · 90-Day Implementation Backlog

Owners: **Growth** (Chinese market owner), **Eng** (frontend-builder / backend-api-builder / data-migration-author agents), **DP** (Detective Pulse management — facts, cases, policies), **Legal** (Thai/Chinese legal review), **Sec/QA** (security-reviewer / qa-test-engineer gates).

## Phase 1 — Days 1–14 (this PR delivers the engineering scope)

| ID | Task | P | Owner | Depends | Expected impact | Success metric | Status |
|---|---|---|---|---|---|---|---|
| E-1 | Audit existing site | P0 | Eng | – | correct architecture decisions | audit doc accepted | ✅ this PR |
| E-2 | Keep `/zh`, 301 `/cn/*` | P0 | Eng | E-1 | no index split | `/cn/x` → 301 → `/zh/x` | ✅ |
| E-3 | Chinese registry + 19 pages | P0 | Eng | E-2 | rankable pages per intent | all 19 URLs 200, in sitemap | ✅ |
| E-4 | Repositioned homepage | P0 | Eng | E-3 | trust + clarity | bounce ↓, WeChat CTA CTR | ✅ |
| E-5 | `<html lang=zh-CN>`, hreflang zh-CN + x-default | P0 | Eng | – | correct language targeting | GSC international targeting report clean | ✅ |
| E-6 | WeChat CTA + placements + sticky | P0 | Eng | – | primary conversion path | `wechat_id_copied` ≥ 5 % of zh sessions | ✅ |
| E-7 | Intake form + API + files + lead_ref | P0 | Eng | DB-1 | qualified leads | ≥ 80 % of intakes have all required fields | ✅ |
| DB-1 | Migration 0124 (pipeline, attribution, files bucket) | P0 | Eng (data-migration-author) | – | CRM + attribution | migration applied on prod | ✅ applied 2026-10-01 |
| E-8 | Admin pipeline controls + audit log | P0 | Eng | DB-1 | stage tracking | 100 % of zh leads staged within 24 h | ✅ |
| E-9 | Analytics events + spec | P0 | Eng | – | funnel measurement | events visible in GA4 debug | ✅ code; **GTM tags by Growth** |
| F-1 | Confirm all facts in `16-facts-requiring-confirmation.md` | P0 | DP | – | no false claims | register fully ticked | ⏳ |
| F-2 | Confirm WeChat account/QR + Chinese-speaking responder + hours | P0 | DP | – | CTA actually converts | reply SLA ≤ 24 h met | ⏳ |
| L-1 | Chinese privacy policy + terms + refund page | P0 | Legal | – | trust, PDPA/PIPL | page live, linked from form | ⏳ |
| G-1 | Chinese company profile (web `/zh/about` ✅ + PDF) | P1 | Growth + DP | F-1 | B2B trust | PDF downloadable | ⏳ |
| O-1 | Apply migration, set `NEXT_PUBLIC_WECHAT_ID/QR`, verify bucket policies | P0 | DevOps | DB-1 | live | prod smoke test | ⏳ |
| Q-1 | Security + QA review of this PR | P0 | Sec/QA | all E-* | production-ready | both gates pass | see PR |

## Phase 2 — Days 15–30

| ID | Task | P | Owner | Depends | Impact | Metric |
|---|---|---|---|---|---|---|
| C-1 | Update AI article generator prompt with 30-topic plan + compliance rules; publish 10 zh articles | P0 | Growth + Eng (ai-engineer) | E-3 | organic reach | 10 published, indexed | ✅ engine (`zh/topics.ts`, `article-selection.ts`, banned-phrase guard); publishing = approve drafts in LINE/`/review` ⏳ |
| C-2 | 3 anonymised case studies supplied by DP → `case-studies.ts` (page auto-indexes) | P0 | DP + Growth | F-1 | trust | 3 live | ⏳ needs DP input (template in doc 13) |
| C-3 | Redacted sample report images for `/zh/how-it-works` | P1 | DP | – | trust | asset live |
| S-1 | Location pages QA with DP for local accuracy (Bangkok, Pattaya, Phuket, Chiang Mai) | P1 | DP | E-3 | truthfulness | sign-off |
| S-2 | Internal-link pass: tag articles with a service for `RelatedArticles` | P1 | Eng | C-1 | crawl depth | every article links to 1 service | ✅ migration 0125, article → service box, service → 相关文章 |
| S-3 | Submit sitemap in GSC; Bing Webmaster; test Baidu site submission (free) | P0 | Growth | E-3 | indexing | 19 URLs indexed in Google | GSC ✅ (2026-10-01) · Bing/Baidu ⏳ |
| A-1 | GTM: GA4 tags for all events; conversions; dimensions | P0 | Growth | E-9 | measurement | GA4 report populated |
| A-2 | `/marketing-insights` funnel panel (stages, rates, revenue by source) | P1 | Eng | DB-1 | decisions | panel live | ✅ |
| K-1 | SERP competitor sheet + Baidu Index / GKP validation of keyword map | P1 | Growth | – | focus | sheet complete |

## Phase 3 — Days 31–60

| ID | Task | P | Owner | Depends | Impact | Metric |
|---|---|---|---|---|---|---|
| C-4 | Articles 11–20 based on K-1 data | P1 | Growth | K-1 | organic | 20 published |
| B-1 | Partner database + outreach sequence; 100 contacts | P1 | Growth + DP | G-1 | B2B pipeline | 10 partner calls |
| B-2 | `/zh/partners` landing page + partner intake | P1 | Eng | B-1 | B2B leads | page live |
| B-3 | B2B service sheets (PDF, zh/en) | P2 | Growth | G-1 | B2B trust | 7 sheets |
| A-3 | Conversion review: CTA placement, form drop-off, WeChat reply time | P1 | Growth | A-1 | conversion | lead→quote ≥ 40 % |
| L-2 | NDA + service agreement templates (zh/en) | P1 | Legal | – | B2B closing | templates in use |
| P-1 | Payment rails for CNY/USD clients (requires confirmation) | P1 | DP | – | quote→paid | documented on /zh/pricing |

## Phase 4 — Days 61–90

| ID | Task | P | Owner | Depends | Impact | Metric |
|---|---|---|---|---|---|---|
| R-1 | 90-day review: traffic, qualified leads, services requested, conversion, revenue by segment | P0 | Growth | A-2 | focus | report |
| R-2 | Expand the winning cluster (pages + 10 articles) | P1 | Growth | R-1 | growth | +30 % qualified leads |
| R-3 | Conversion-page improvements from data | P1 | Eng | R-1 | conversion | quote→paid ↑ |
| R-4 | Hua Hin page if confirmed; more locations only with real coverage | P2 | DP + Eng | S-1 | local SEO | page live |
| R-5 | Paid media: re-verify Baidu / Xiaohongshu / Google Ads (zh) policies in writing; proceed only where explicitly permitted | P2 | Growth | R-1 | scale | written policy check |
| R-6 | WeChat Official Account eligibility & cost | P2 | DP | F-2 | retention | decision |
