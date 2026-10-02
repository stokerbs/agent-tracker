# Detective Pulse — SEO + Growth Marketing Audit (detectivepulse.com)

Audit date: 2026-10-02 · Auditor: Chief Architect session (Claude Code) · Scope: the public marketing host `detectivepulse.com` only (Thai root, `/en`, `/zh`, `/lp`, `/articles`). The ops app on `detectivepulse.app` is out of scope.

Primary business objective used to weigh every recommendation: **more qualified LINE / WhatsApp / WeChat / phone enquiries that turn into paid investigation cases**, not traffic.

---

## 0. How this audit was done, and what could NOT be checked

**Observed facts come from three sources:**

1. **The deployed site's source code** in this repository (`stokerbs/agent-tracker`, branch `main` up to PR #272). The marketing site is this Next.js 15 application, host-switched on `detectivepulse.com` (`src/lib/marketing/host.ts`, `src/app/page.tsx`). Every page, title, description, canonical, hreflang, JSON-LD, redirect, robots rule, sitemap entry, CTA, form field and analytics event was read from code, not inferred.
2. **Google web-search results** for the target queries (English, Thai, Chinese), including `site:detectivepulse.com`, which show what Google currently indexes and which competitors occupy the SERPs.
3. **Prior internal documents** in the repo (`docs/china-market/*`, the `/marketing-insights` dashboard constants) and the Google Ads / Search Console signals that the engineering team encoded into `src/lib/marketing/article-gen.ts` (the keyword pool is annotated as coming from the real Ads search-term report and the live GSC query report).

**What could not be checked (explicitly missing data):**

| Data | Status | Why it matters |
|---|---|---|
| Live HTTP fetch of detectivepulse.com (headers, rendered HTML, robots.txt, sitemap.xml, 404 behaviour, redirect chains, TTFB) | **Blocked** — the session's egress proxy denies the domain. Behaviour is derived from `next.config.ts`, `robots.ts`, `sitemap.ts` and route files. | Any discrepancy between code and the deployed environment (env vars, Vercel settings) is invisible here. |
| Live fetch of competitor sites | **Blocked** (same proxy). Competitor analysis uses SERP titles/snippets only. | Competitor word counts, backlinks, schema and CRO details are hypotheses. |
| Google Search Console (queries, impressions, clicks, positions, coverage, CWV field data) | **Not available.** A GSC property exists (verification tag in `src/app/page.tsx`). | Ranking and indexing claims below are labelled as hypotheses. |
| Google Analytics 4 / GTM container config / Google Ads account | **Not available.** GTM id is an env var; tags were configured by an agency. | Conversion rate, traffic, CPL, ROAS cannot be stated. |
| Backlink data (Ahrefs/Semrush/Majestic) | **Not available.** | Authority score is an estimate. |
| Google Business Profile existence/state, review count, citations | **Not available / not found in search snippets.** | Local SEO section is a plan, not a measurement. |
| Keyword search volumes | **Not available.** Demand is labelled High / Medium / Low from SERP composition and the Ads/GSC annotations in code. | Do not read any number below as a search volume. |
| `marketing_articles` and `marketing_leads` database rows (how many AI articles are published, how many leads per week) | **Not available** (Supabase, not accessible). | Content-velocity and lead-volume statements are not made. |

Throughout the report each item is tagged **[Observed]**, **[Hypothesis]** or **[Recommendation]**.

---

# PART 1 — Executive Summary

The site is technically far better than most Thai PI sites: server-rendered Next.js, canonical + hreflang on every page, sitemap/robots, ProfessionalService + FAQPage + BlogPosting + BreadcrumbList JSON-LD, security headers, a lead API with rate-limiting and PDPA consent, a LINE-notified lead pipeline, and a well-structured Chinese section built in the last cycle. The problem is not the plumbing. The problem is that **the Thai and English money pages are still WordPress-era blog posts**, the **trust layer is thin and partly self-contradictory**, and **the conversion channels that actually produce cases (LINE, WhatsApp, phone) are not measured at all on the Thai/English site**.

The ten most important findings:

1. **[Observed] The pages that should sell are rendered as articles.** All 27 Thai pages and 27 English pages (including infidelity, background check, asset search, missing person, cyber, contact) use the same `[slug]/page.tsx` article template: breadcrumb "Home › บทความ", "Case File" eyebrow, `BlogPosting` schema, no service-specific CTA block, no FAQ, no deliverables, no pricing anchor, no `Service` schema, and a "related articles" block that always links the same first three pages. Google is told these are blog posts; visitors experience them as blog posts.
2. **[Observed] Several Thai and English pages advertise data no lawful Thai investigator can obtain**, e.g. "เช็ครายการเดินบัญชี STATEMENT ได้จากทุกธนาคาร" (bank statements from every bank), credit-bureau status, immigration entry/exit history, phone call history and SIM registration, parents' names from the civil registry (`/เช็คประวัติบุคคล/`, `/บริการตรวจสอบการใช้โทร/`, `/en/phone-usage-investigation`, homepage "About" paragraph, FAQ "เงินในบัญชีธนาคาร"). This directly contradicts the compliance stance of the Chinese section ("我们不做什么"), exposes the business under PDPA and the Computer Crime Act, undermines E-E-A-T, and is a Google Ads policy risk ("Enabling dishonest behavior" covers services that obtain phone/financial records). This is the single most urgent fix.
3. **[Observed] Heavy keyword cannibalisation in Thai.** Four pages target infidelity (`/นักสืบชู้สาว/`, `/นักสืบคดีชู้สาว-รับสืบค/`, `/สิ่งที่ควรรู้ก่อนการจ้/`, `/จ้างนักสืบตามแฟน/`), three target background checks, two target finding people, and eight overlap on "hire a detective / detective agency / detective services". Ten of the 27 Thai pages have no H2, no internal links and 1,400–2,400 Thai characters of 2023-style SEO filler (three contain empty bullet points).
4. **[Observed] No indexable Bangkok page in Thai or English.** The only Bangkok page is `/lp/detective-bangkok`, which is `noindex`. "นักสืบกรุงเทพ" is in the firm's own Ads keyword list; "private investigator Bangkok" is the highest-intent English query. The Chinese section has six location pages; Thai and English have none.
5. **[Observed] 80%+ of real conversion actions are untracked on TH/EN.** Only the form submit fires `lead_submitted`. LINE, WhatsApp, phone, Facebook and email clicks in the hero, FAB, sticky bar, exit popup and content pages fire nothing. The `track()` helper and `contact_click` event exist but are wired only in `/zh` components. The `marketing_leads` row for TH/EN form leads stores no landing page, referrer or UTM (the columns exist since migration 0124, only the Chinese intake fills them).
6. **[Observed] The trust layer argues against itself.** The FAQ says "Detective Pulse เป็นฟรีแลนซ์นักสืบเอกชน ไม่มีที่ตั้งสำนักงาน" (freelance, no office) while the hero claims "รางวัลการันตีความสำเร็จมากมาย" (many awards) with no award named; `/privacy` and `/support` are the Field-Agent app's policies (the lead form's PDPA consent links to a policy about GPS tracking of agents); there is no legal entity name, no about page, no named investigator, no case study in Thai or English; the Fastwork 4.8★/63 figure is not linked to its source.
7. **[Observed] Brand and NAP inconsistency.** The firm appears as "Detective Pulse", "Detectivepulse", "DetectivePulse" and "นักสืบ Sherlock" (title and body of `/เช็คประวัติบุคคล/`); email and LINE id are `detectivepluse` (typo of pulse) and Facebook is `Detectivepluse.th`; three different LINE URLs are used (`lin.ee/SSqk98x` ×14, `lin.ee/49Hessi` ×13, `page.line.me/detectivepluse`); Google's cached snippets still show the retired number 080 918 8324.
8. **[Observed] English content is translated Thai consumer content, not content for foreigners.** The queries foreigners actually type ("Thai girlfriend background check", "is my Thai girlfriend married", "romance scam Thailand investigator", "due diligence Thailand company", "private investigator Pattaya/Phuket") are owned by bangkokinvestigators.com, siamspy.com, thailand-pi.com, thailandprivateinvestigators.com and absolute-investigation.com, who publish exactly those pages and blog posts. `/en` has none of them, no pricing, no process, no payment-from-abroad explanation, and its sticky mobile bar offers LINE, not WhatsApp.
9. **[Observed] Internal linking is leaking.** 51 of 92 in-content links are absolute `https://detectivepulse.com/%e0…/` URLs with a trailing slash, each of which 308-redirects (trailing slashes are stripped by Next). Homepage links reach only 12 of the 27 Thai pages; the related-articles block repeats the same three; the nav has three links. The strongest page-level signal the site can control is being wasted.
10. **[Observed] The Chinese build is the model to copy.** `/zh` has 15 service/info pages + 6 location pages built from a typed registry with H1, sections, deliverables, "what we don't do", FAQ (FAQPage schema), `Service` schema, hreflang with `x-default`, WeChat-first CTA, a structured intake form that writes attribution onto the lead row, and a lead→quote→paid funnel in `/marketing-insights`. The fastest route to a strong Thai and English site is to generalise that registry to TH/EN rather than keep patching markdown.

Net assessment: a solid engine with the wrong body on it. Fixing items 1, 2, 4, 5 and 9 is mostly engineering work inside this repo and can be done in 30 days. Items 6 and 8 need the owner's input (facts, photos, cases, an about page) and a copywriter.

---

# PART 2 — Current SEO Health (diagnostic scores, 0–100)

Scores are diagnostic only; they are not predictions of rankings.

| Area | Score | Why |
|---|---|---|
| **Technical SEO** | **74** | [Observed] SSR for everything; blocking metadata forced into `<head>` (`htmlLimitedBots: /.*/`); canonical + `alternates.languages` on every route; sitemap covers TH/EN/ZH pages + articles; robots blocks app paths; non-marketing hosts get `X-Robots-Tag: noindex`; `/lp/*` and `/review/*` noindexed; legacy WP paths 301; HSTS/CSP; OG image endpoint. Deductions: all pages render dynamically because the root layout calls `headers()` (no static/ISR cache for TH/EN, so TTFB for overseas visitors depends on a Singapore-region lambda every time) [Observed]; sitemap `lastModified` is `new Date()` for every static page on every request, which makes lastmod meaningless to Google [Observed]; 51 internal links point at redirecting URLs [Observed]; Thai inner pages omit `x-default` hreflang while the homes include it [Observed]; `/privacy` and `/support` are indexable and in the sitemap but describe the mobile app, and the root layout's default title/description are "Operations Command Center" (any marketing route that forgets its own metadata inherits app copy) [Observed]; Lighthouse mobile perf is recorded internally as ~87 with CLS 0 (not independently verified here). |
| **On-page SEO** | **42** | [Observed] 25 of 27 Thai `seoTitle`s equal the H1 and carry no brand; 2 Thai pages have an empty `seoTitle` (falls back to title); 8 Thai descriptions exceed 160 characters (167–251); 10 Thai pages have zero H2s; the title/description of `/เช็คประวัติบุคคล/` promote a different brand ("นักสืบ Sherlock"); no image alt beyond cover; headings are not built around intent; the Thai slug `/private-investigator/` is an English slug on the Thai site that competes with `/en/private-investigator`. English titles are better formed ("… in Thailand \| Detective Pulse") but the pages are still articles. |
| **Content** | **38** | [Observed] Thai service pages are 1,400–5,500 Thai characters (roughly 250–900 words equivalent) of generic 2023 SEO copy; no pricing page, no process page, no about page, no case studies, no FAQ outside the home; AI article pipeline exists (Tue/Fri drafts, owner approval on LINE) but targets single keywords, not clusters, and the English/Thai versions are literal siblings of each other. Positive: the Chinese pages are genuinely useful and segment-specific. |
| **Local SEO** | **18** | [Observed] No Google Business Profile found in search snippets for the brand; FAQ states there is no office; no address in JSON-LD; `areaServed` = Thailand only; no Bangkok page; NAP variants (see finding 7); only review source is Fastwork, not Google. |
| **Authority** | **22 (estimate)** | No backlink data. [Hypothesis] Low: the domain's visible footprint is its own pages, a Fastwork profile and a Facebook page; competitors appear in law-firm directories, expat press (The Pattaya News) and "best PI in Bangkok" listicles (cleverthai.com, top10bangkok.net, topbestbrand.com) where Detective Pulse does not appear in the snippets retrieved. |
| **Conversion (CRO)** | **58** | [Observed] Strengths: LINE/WhatsApp/phone in hero, one-tap sticky bar on mobile, FAB with all channels, lead form with case type, AI intake assistant that creates leads, exit-intent, LINE push to admins, reviews and stat band. Weaknesses: four overlapping overlays on mobile (auto-opening FAB at 1.8 s, AI bot, sticky bar, exit popup at 40 s); no response-time promise; no pricing anchor; "no office/freelance" statement; unverifiable "awards"; no case studies; English mobile sticky bar lacks WhatsApp; zero click tracking so none of this can be optimised. |
| **International SEO** | **56** | [Observed] Clean `/`, `/en`, `/zh` structure; `x-default` → `/en`; `<html lang>` fixed by middleware for `/zh` and `/en`; 1:1 EN mirror; ZH segment pages. Deductions: EN is a translation, not localisation (finding 8); no EN location pages; EN has LINE-first CTAs in places; no explanation of remote engagement/payment; no Russian/Japanese consideration yet. |
| **AI visibility (GEO/AEO)** | **33** | [Observed] FAQPage + ProfessionalService + AggregateRating JSON-LD exist; but the entity is inconsistent (names, "Sherlock", typo handles), there is no about/organisation page, no `foundingDate`/`founder`/`address` on TH/EN schema, no author entity, no original data, and the site's own statements about what it can access contradict each other. AI assistants currently answer "private investigator Thailand" questions from competitors' explanatory content. |

---

# PART 3 — Critical Problems (actively hurting rankings, leads or conversions)

🔴 **Critical**

| # | Problem | Evidence | Impact |
|---|---|---|---|
| C1 | Service claims that imply unlawful data access (bank statements, credit bureau, immigration records, phone/SIM history, civil-registry data, "ทะเบียนบ้านเดียวกัน") | `src/content/marketing/754.md` (เช็คประวัติบุคคล) bullet list; `497.md` + `en/phone-usage-investigation.md` entire page; `marketing-home.tsx` About paragraph ("สืบประวัติการเดินทางเข้าออกประเทศ … เช็คการใช้งานโทรศัพท์"); `faq.ts` answer 2 ("เงินในบัญชีธนาคาร"); EN FAQ "funds in bank accounts"; ZH FAQ "银行账户资金". | Legal exposure (PDPA B.E. 2562, Computer Crime Act), Google Ads "Enabling dishonest behavior" policy risk, loss of trust with the exact clients (lawyers, corporates, foreigners) who pay the most, and a direct contradiction with `/zh` compliance copy that a bilingual reader can see. |
| C2 | Money pages rendered as blog posts (no service template, `BlogPosting` schema, breadcrumb to "บทความ", generic related block) | `src/app/(marketing)/[slug]/page.tsx`, `en/[slug]/page.tsx` | Weak relevance signals for transactional queries; no page-level CTA/FAQ/deliverables; identical UX for "contact" and "how to be a detective" pages. |
| C3 | Thai cannibalisation clusters (infidelity ×4, background ×3, find person ×2, hire/agency/services ×8) | Inventory in Appendix A | Google splits signals across near-duplicates; none of them is deep enough to win; internal links are diluted. |
| C4 | No indexable Bangkok / location pages in TH or EN | `landing-pages.ts` (`detective-bangkok` is noindex); no TH/EN location routes | The highest-intent local queries in both languages have no landing page. |
| C5 | Conversion actions not measured on TH/EN (LINE/WhatsApp/phone/FB/email clicks), no attribution on TH/EN leads | `lead-form.tsx` (only `lead_submitted`), `contact-fab.tsx`, `sticky-contact-bar.tsx`, `exit-intent.tsx`, `detective-hero.tsx` (no events); `api/marketing/lead/route.ts` writes no `landing_page/utm_*` | Impossible to know which pages, keywords or campaigns create cases; Ads optimisation is blind to chat leads. |

🟠 **High**

| # | Problem | Evidence | Impact |
|---|---|---|---|
| H1 | Trust contradictions and gaps (freelance/no office vs "awards"; no legal name, team, case studies, linked reviews; app privacy policy used for marketing consent) | `faq.ts`, `marketing-home.tsx` hero subtitle, `src/app/privacy/page.tsx` | Lower conversion especially for international and B2B clients; E-E-A-T weakness. |
| H2 | Internal linking: 51 absolute trailing-slash links (308), related block = same 3 pages, nav = 3 links, 10 Thai pages with no contextual inbound links | `src/content/marketing/*.md`, `[slug]/page.tsx` `related = getMarketingPages().slice(0,3)` | Wasted PageRank, poor crawl prioritisation of service pages. |
| H3 | English content does not match foreign-client intent; no EN pricing/process/payment/remote-engagement pages | `src/content/marketing/en/*` | International leads go to competitors who answer those questions. |
| H4 | Brand/NAP inconsistency (Detective Pulse / Detectivepulse / Sherlock; `detectivepluse` handles; 3 LINE URLs; retired phone still in Google snippets) | grep results; `site:` snippets | Entity confusion for Google/AI; split LINE analytics; users dialling a dead number. |
| H5 | Four overlapping conversion overlays on mobile | `site-chrome.tsx` mounts `ContactFab` (auto-opens at 1.8 s) + `AssistantWidget` + `StickyContactBar` + `ExitIntent` (40 s timer on mobile) | Friction and INP risk on the device most Thai clients use; no data to prove any of them helps. |

🟡 **Medium**

| # | Problem | Evidence |
|---|---|---|
| M1 | Metadata quality: 8 Thai descriptions > 160 chars; 2 empty `seoTitle`; Thai titles without brand; H1 = title everywhere | Appendix A |
| M2 | `/privacy`, `/support` indexable + in sitemap but about the app; root-layout default metadata is app copy | `sitemap.ts`, `layout.tsx` |
| M3 | Fully dynamic rendering of TH/EN pages (root `headers()`), sitemap lastmod always "now" | `layout.tsx`, `sitemap.ts` |
| M4 | AI article pipeline publishes TH/EN/ZH triplets of one keyword; TH/EN versions are near-literal translations of each other with no local angle; no cluster/pillar logic; Chinese CTA rules exist but Thai/English CTA lines are identical on every article | `article-gen.ts` |
| M5 | Thai `/private-investigator/` (English slug) duplicates `/en/private-investigator` intent on the Thai host | `1008.md` |
| M6 | Stock cover images (70–207 KB JPG/PNG, served via `next/image`) are the only imagery; no real photos of reports, equipment, team | `public/marketing/articles/*` |

🟢 **Low**

| # | Problem |
|---|---|
| L1 | `/careers` and `/en/careers` in sitemap at priority 0.5 (fine, but they dilute the "service" picture of a 60-URL sitemap) |
| L2 | Thai inner pages omit `x-default` hreflang; EN FAQ answer 3 lists LINE before WhatsApp |
| L3 | Review dates on the homepage are in `DD/MM/YYYY` without a locale label; English visitors may misread them |

---

# PART 4 — Quick Wins (1–4 weeks)

All of these are inside this repository unless marked **Owner**.

1. **Remove or rewrite every unlawful-access claim (C1).** Delete the bank/credit-bureau/immigration/civil-registry/phone-record bullets from `754.md`, rewrite `497.md` + `en/phone-usage-investigation.md` into "Digital footprint & phone-number OSINT (lawful, open-source)" or 301 them to the cyber page, rewrite the homepage About paragraph and FAQ answer 2 (TH/EN/ZH). Add a short "What we do / what we never do" block (mirror `/zh` `notOffered`). Half a day of editing.
2. **Wire `contact_click` on every CTA (C5).** Add `track({event:"contact_click", channel, page, placement})` to `DetectiveHero` CTAs, `ContactFab`, `StickyContactBar`, `ExitIntent`, `AssistantWidget` footer links and markdown links to LINE/WhatsApp/tel (via `mdComponents`). Mark `contact_click` (line/whatsapp/phone) and `lead_submitted` as GA4 conversions and import them into Google Ads. One day.
3. **Store attribution on TH/EN leads (C5).** In `lead-form.tsx` and `/api/marketing/lead`, capture `landing_page` (first page of session, from `sessionStorage`), `referrer`, `utm_*`, `gclid` into the existing columns from migration 0124. The assistant route should do the same. One day.
4. **Fix internal link hygiene (H2).** Rewrite the 51 absolute `https://detectivepulse.com/%e0…/` links in content to relative, non-trailing-slash paths; make `RelatedArticles` pick pages by category (the `article-category.ts` classifier already exists) instead of `.slice(0,3)`; add a "Services" dropdown to the TH/EN nav mirroring the `/zh` nav; add a services + locations footer for TH/EN like `SiteFooterLinks` does for `/zh`. Two days.
5. **Normalise the brand and NAP (H4).** One LINE URL everywhere (pick the OA link that reports analytics), replace "นักสืบ Sherlock" in `754.md`, decide on "Detective Pulse" as the only spelling, add `email`, `foundingDate`, `sameAs` (Facebook, Fastwork, LINE OA, YouTube) to the TH/EN `ProfessionalService` JSON-LD. Request re-indexing of the contact page and home in GSC so snippets drop the old number. Half a day + **Owner** (confirm LINE OA).
6. **Metadata pass (M1).** Trim the 8 long Thai descriptions to ≤155 chars, fill the 2 empty `seoTitle`s, append " | Detective Pulse" to Thai titles, differentiate title from H1 where the H1 is a headline. Half a day.
7. **Publish an indexable Thai Bangkok page and an English Bangkok page (C4)** using the `/zh/bangkok` location-page structure (who hires us in Bangkok, districts, how fast we start, local FAQ). Keep `/lp/detective-bangkok` for Ads. Two days once copy exists.
8. **Replace "freelance, no office" with a precise, honest statement (H1).** E.g. "ทีมนักสืบประจำกรุงเทพฯ นัดพบลูกค้าได้ที่ … / ประชุมออนไลน์ได้ทุกช่องทาง" plus the legal entity name and registration number if the business is registered (**Owner** must confirm; see `docs/china-market/16-facts-requiring-confirmation.md`). Remove "รางวัลการันตี" unless an award can be named.
9. **Add WhatsApp to the EN mobile sticky bar and make WhatsApp the first CTA on every `/en` page** (foreign clients rarely have LINE). One hour.
10. **Tame the overlays (H5):** do not auto-open the FAB when the sticky bar is visible (mobile); delay the exit-intent fallback to ≥90 s or disable it on mobile; load the AI assistant launcher only after first interaction. Measure with the new `contact_click` events before re-enabling. Half a day.
11. **Noindex `/privacy` and `/support` or rewrite them for the marketing site**, and point the lead-form consent to a marketing privacy notice in Thai/English/Chinese. Half a day (copy needs **Owner**/counsel review).
12. **Create a Google Business Profile as a service-area business** (no address shown, service area = Bangkok + provinces) and request reviews from the Fastwork clients who are willing. **Owner**; see Part 9.

---

# PART 5 — Keyword Strategy

Volumes are not available. "Demand" is a relative estimate from SERP composition, competitor page coverage, and the Ads/GSC-derived keyword pool in `article-gen.ts` (which the team annotated as "proven organic winners … sit just off page 1": เช็คประวัติบุคคลจากชื่อนามสกุล, จ้างนักสืบออนไลน์, ตามหาคนจากชื่อ, นักสืบไอที). Business value = likelihood the searcher becomes a paid case.

Legend: Intent T = transactional, C = commercial investigation, I = informational, L = local, S = service-specific. Competition is an estimate (H/M/L). Page column: **E** existing (consolidate/upgrade), **N** new.

## 5.1 Thai keyword map

| Keyword | Intent | Demand | Competition | Business value | Recommended page | E/N | Priority |
|---|---|---|---|---|---|---|---|
| นักสืบเอกชน | T/C | High | H (detectives.in.th, spy-bangkok, thai-detective, Fastwork) | High | `/` (home) | E | P1 |
| จ้างนักสืบ | T | High | H | High | `/จ้างนักสืบ/` → upgrade to service hub "จ้างนักสืบ: ขั้นตอน ราคา เลือกอย่างไร" | E | P1 |
| นักสืบกรุงเทพ / นักสืบเอกชน กรุงเทพ | L/T | High | M | Very high | `/นักสืบกรุงเทพ/` | **N** | P1 |
| นักสืบชู้สาว / สืบชู้ / จับชู้ | S/T | High | H | Very high | `/นักสืบชู้สาว/` (consolidate 3 duplicates into it) | E | P1 |
| สืบแฟน / จ้างนักสืบตามแฟน / สืบสามี / สืบภรรยา | S/T | High | M | Very high | `/จ้างนักสืบตามแฟน/` (pre-marriage + partner behaviour) with sections for สามี/ภรรยา | E | P1 |
| ตามหาคน / สืบตามหาคน / จ้างนักสืบตามหาคน / ตามหาคนจากชื่อ | S/T | High | M | High | `/สืบตามหาคน/` (merge `/จ้างนักสืบตามหาคน/`) | E | P1 |
| เช็คประวัติบุคคล / เช็คประวัติบุคคลจากชื่อนามสกุล / รับสืบประวัติ | S/T | High | M | High | `/เช็คประวัติบุคคล/` (merge 2 duplicates; rewrite lawfully) | E | P1 |
| สืบทรัพย์ / สืบทรัพย์สิน / สืบทรัพย์ลูกหนี้ / สืบทรัพย์ก่อนฟ้อง | S/T | Medium | M (law firms) | Very high (B2B/lawyer) | `/สืบทรัพย์สิน/` (merge `/วิธีสืบทรัพย์ก่อนฟ้อง-เ/`, `/บริการสืบประวัติบุคคลด/`) | E | P1 |
| นักสืบ ราคา / ค่าจ้างนักสืบ / จ้างนักสืบ ราคาเท่าไหร่ | C | High | M | Very high | `/ราคานักสืบ/` new pricing page (absorb `/วิธีการคิดราคาจ้างนักส/`, `/จ้างนักสืบ-ราคาถูก/`) | **N** | P1 |
| นักสืบไอที / สืบออนไลน์ / ตามหาคนโกงออนไลน์ | S/T | Medium | L–M | High | `/นักสืบไอที/` (absorb `/บริการสืบค้นข้อมูลไอที/`, phone page) | E | P1 |
| ตรวจสอบพฤติกรรม / ติดตามบุคคล / ติดตามพฤติกรรม | S | Medium | M | High | section inside infidelity + new "ติดตามพฤติกรรม (เฝ้าสังเกต)" page | **N** | P2 |
| จ้างนักสืบออนไลน์ | T | Medium | L | High | `/จ้างนักสืบออนไลน์/` keep, rewrite as "จ้างนักสืบออนไลน์ปลอดภัยอย่างไร ไม่โดนหลอก" | E | P2 |
| บริษัทนักสืบ / บริษัทนักสืบเอกชน ที่ไหนดี | C | Medium | H | Medium | `/บริษัทนักสืบ/` (merge `/บริษัทนักสืบมืออาชีพที/`, `/บริการนักสืบชั้นนำเพื่/`, `/บริการนักสืบ/`) | E | P2 |
| นักสืบพัทยา / นักสืบภูเก็ต / นักสืบเชียงใหม่ | L | Low–Med | L | High per lead | `/นักสืบพัทยา/` etc. only with genuine local content (see Part 6) | **N** | P2 |
| หลักฐานฟ้องชู้ / ฟ้องชู้ ต้องมีหลักฐานอะไร / เรียกค่าทดแทนชู้ | I→T | Medium | M (law firms) | High | `/สิ่งที่ควรรู้ก่อนการจ้/` rewrite as "หลักฐานฟ้องชู้ที่ศาลรับฟัง" with lawyer-consult CTA | E | P2 |
| วิธีจับได้ว่าแฟนนอกใจ / สัญญาณแฟนนอกใจ | I | High | H (lifestyle media) | Medium | article → links to infidelity page | N (article) | P3 |
| เช็คประวัติก่อนแต่งงาน / สืบประวัติแฟนก่อนแต่ง | S/T | Medium | L | High | `/จ้างนักสืบตามแฟน/` section + article | E | P2 |
| สืบประวัติพนักงาน / เช็คประวัติก่อนรับเข้าทำงาน | S (B2B) | Medium | M (HR vendors) | High | new "ตรวจสอบประวัติพนักงาน (B2B)" page | **N** | P2 |
| ตรวจสอบคู่ค้า / สืบประวัติบริษัท / ตรวจสอบบริษัทก่อนลงทุน | S (B2B) | Low–Med | M | Very high | new "ตรวจสอบธุรกิจและคู่ค้า" page | **N** | P2 |
| นักสืบ pantip / จ้างนักสืบ pantip | C | Medium | n/a | Medium | not a page: participate honestly on Pantip + an article "สิ่งที่คนถามใน Pantip ก่อนจ้างนักสืบ" | — | P3 |

## 5.2 English keyword map

| Keyword | Intent | Demand | Competition | Business value | Recommended page | E/N | Priority |
|---|---|---|---|---|---|---|---|
| private investigator Thailand / Thailand private investigator / private detective Thailand | T/C | High | H (thailand-pi, thailandprivateinvestigators, siamspy, bondrees, sang-pi, hanuman, trueinvestigation) | Very high | `/en/private-investigator-thailand` pillar (currently `/en` home + `/en/private-investigator` share it) | **N** (+ redirect `/en/private-investigator`) | P1 |
| private investigator Bangkok / Bangkok private investigator / private detective Bangkok | L/T | High | H | Very high | `/en/private-investigator-bangkok` | **N** | P1 |
| hire private investigator Thailand / hire a private detective in Thailand | T | Medium | M | Very high | `/en/hire-a-private-detective` upgrade | E | P1 |
| infidelity investigator Thailand / cheating spouse investigator Thailand / cheating Thai wife / cheating Thai girlfriend | S/T | High | H | Very high | `/en/cheating-spouse-investigator` upgrade (merge `/en/catch-a-cheating-partner`, `/en/evidence-for-adultery-lawsuit`) | E | P1 |
| Thai girlfriend background check / is my Thai girlfriend married / Thai girlfriend investigation | S/T | High | H (bangkokinvestigators, siamspy, thailandpi.com own it) | Very high | `/en/thai-partner-verification` | **N** | P1 |
| background check Thailand / Thailand background check service / criminal record check Thailand | S/T | High | H | High | `/en/background-check` upgrade (lawful scope stated) | E | P1 |
| locate person Thailand / find someone in Thailand / missing person Thailand / find lost relative Thailand | S/T | Medium | M | High | `/en/find-missing-person` upgrade (merge `/en/trace-people-and-debtors`) | E | P1 |
| surveillance Thailand / surveillance services Bangkok | S | Medium | M | High | `/en/surveillance-thailand` | **N** | P2 |
| private investigator Thailand cost / how much does a private investigator cost in Thailand / PI Thailand prices | C | Medium | M (thailand-pi, trueinvestigation have pricing pages) | Very high | `/en/pricing` (absorb `/en/private-detective-pricing`, `/en/affordable-private-detective`) | **N** | P1 |
| due diligence Thailand / company verification Thailand / verify Thai company / business partner check Thailand | S (B2B) | Medium | M (law firms, Wymoo, aseaneyes) | Very high | `/en/due-diligence-thailand` | **N** | P2 |
| romance scam Thailand investigation / online dating scam Thailand verify / Thai dating scam | I→T | Medium | M | High | `/en/romance-scam-investigation` + articles | **N** | P2 |
| asset search Thailand / asset tracing Thailand / debtor assets Thailand | S | Low–Med | M | High | `/en/asset-investigation` upgrade (merge `/en/asset-background-check`, `/en/trace-assets-before-lawsuit`) | E | P2 |
| private investigator Pattaya / Phuket / Chiang Mai / Koh Samui / Hua Hin | L | Medium | M–H (pattayapi, pattayaprivateinvestigator, thailand-pi city pages) | High | `/en/private-investigator-pattaya` etc. — only where the firm genuinely operates and with unique content | **N** | P2 |
| pre-marriage background check Thailand / marry Thai woman check | S | Low–Med | L–M | High | section in partner-verification + article | E | P2 |
| process server Thailand / document retrieval Thailand | S | Low | L | Medium (lawyer referrals) | `/en/process-serving-thailand` if offered | N (if real) | P3 |
| how private investigators work in Thailand / is it legal to hire a PI in Thailand / what can a PI legally do in Thailand | I | Medium | L–M (law-firm pages) | Medium–High (trust) | `/en/how-it-works` + `/en/what-investigators-can-legally-do-in-thailand` | **N** | P1 |

## 5.3 Grouping summary

- **Transactional / commercial (build first):** home, Bangkok (TH/EN), infidelity (TH/EN), partner verification (EN), background check (TH/EN), find person (TH/EN), asset search (TH/EN), pricing (TH/EN), hire-a-detective hub (TH/EN).
- **Informational that leads to cases:** evidence for adultery suits (TH), what PIs can legally do (EN/TH), how to hire safely online (TH), cost explainer (both), romance-scam red flags (EN), finding a debtor before suing (TH), pre-employment checks under PDPA (TH B2B).
- **Local:** Bangkok first; Pattaya/Phuket/Chiang Mai second, only with real operating evidence; Khon Kaen/Surat Thani as service-area mentions, not pages (see Part 6).
- **Service-specific long tail:** handled as sections/FAQs inside the service pages rather than separate URLs, to avoid rebuilding the cannibalisation problem.

---

# PART 6 — Website Architecture

## 6.1 Principles

- Keep every currently-indexed Thai URL that has a clear single intent; **upgrade** it to a service template instead of moving it (the WordPress slugs were deliberately preserved and are indexed).
- **Consolidate** near-duplicates with 301s into the strongest page (strongest = the one already in the homepage service grid / nav).
- Create **new** Thai and English pages only where a distinct intent has no page (Bangkok, pricing, about, process, partner verification, due diligence, surveillance, romance scam, case studies).
- Location pages only where Detective Pulse can show real local operation (team, cases, local FAQ). Six Chinese location pages already set this standard; Thai/English should follow only for Bangkok now, then Pattaya/Phuket/Chiang Mai when there is content. Khon Kaen and Surat Thani: **no pages** (doorway risk, little evidence of demand); mention them in a "พื้นที่ให้บริการ / Service areas" section with real examples of provincial cases.
- One registry (the `/zh` `ZhPage` type) for all three languages so TH/EN pages get H1, sections, deliverables, "what we don't do", FAQ + FAQPage, `Service` schema, CTA variants and related links for free.

## 6.2 Target hierarchy

```
detectivepulse.com/                               Thai home (นักสืบเอกชน)
├─ /นักสืบชู้สาว/                                  ← 301: /นักสืบคดีชู้สาว-รับสืบค/
├─ /จ้างนักสืบตามแฟน/                              (สืบแฟน · สืบสามี · สืบภรรยา · เช็คก่อนแต่ง)
├─ /สิ่งที่ควรรู้ก่อนการจ้/  → rewrite "หลักฐานฟ้องชู้"  (I→T support page, links to ชู้สาว)
├─ /เช็คประวัติบุคคล/                              ← 301: /บริการตรวจสอบประวัติบุ/, /บริการสืบประวัติบุคคลด/
├─ /สืบตามหาคน/                                    ← 301: /จ้างนักสืบตามหาคน/
├─ /สืบทรัพย์สิน/                                  ← 301: /วิธีสืบทรัพย์ก่อนฟ้อง-เ/
├─ /นักสืบไอที/                                    ← 301: /บริการสืบค้นข้อมูลไอที/, /บริการตรวจสอบการใช้โทร/
├─ /ติดตามพฤติกรรม/                 NEW            (surveillance / behaviour monitoring, lawful scope)
├─ /ตรวจสอบประวัติพนักงาน/          NEW (B2B)
├─ /ตรวจสอบธุรกิจและคู่ค้า/         NEW (B2B)
├─ /จ้างนักสืบ/                                    hub: ขั้นตอน · วิธีเลือก  ← 301: /การหานักสืบเชี่ยวชาญ-คำ/, /จ้างนักสืบออนไลน์/ (or keep as article)
├─ /ราคานักสืบ/                     NEW            ← 301: /วิธีการคิดราคาจ้างนักส/, /จ้างนักสืบ-ราคาถูก/
├─ /นักสืบกรุงเทพ/                  NEW
├─ /นักสืบพัทยา/ /นักสืบภูเก็ต/ /นักสืบเชียงใหม่/   NEW, phase 2, only with local content
├─ /เกี่ยวกับเรา/                   NEW            ← 301: /บริษัทนักสืบมืออาชีพที/, /บริการนักสืบชั้นนำเพื่/
├─ /ขั้นตอนการทำงาน/                NEW
├─ /ผลงาน/  (case studies)          NEW            + /ผลงาน/<slug>
├─ /ติดต่อนักสืบ/                                  (contact, keep)
├─ /บทความ → /articles                            ← keep; move "นักสืบ", "บริษัทนักสืบ", "บริการนักสืบ", "private-investigator" into the article hub as informational posts (canonical to themselves, de-emphasised)
├─ /careers, /privacy (marketing), /support (noindex or app-only)
│
├─ /en                                            English home → treat as pillar for "private investigator Thailand"
│  ├─ /en/private-investigator-thailand           NEW pillar (or make /en itself the pillar and 301 /en/private-investigator → /en)
│  ├─ /en/private-investigator-bangkok            NEW
│  ├─ /en/private-investigator-pattaya | -phuket | -chiang-mai   NEW, phase 2
│  ├─ /en/cheating-spouse-investigator            ← 301: /en/catch-a-cheating-partner, /en/evidence-for-adultery-lawsuit
│  ├─ /en/thai-partner-verification               NEW (Thai girlfriend/boyfriend/fiancé verification, pre-marriage)
│  ├─ /en/background-check                        ← 301: /en/personal-background-check-service
│  ├─ /en/find-missing-person                     ← 301: /en/trace-people-and-debtors
│  ├─ /en/surveillance-thailand                   NEW
│  ├─ /en/asset-investigation                     ← 301: /en/asset-background-check, /en/trace-assets-before-lawsuit
│  ├─ /en/due-diligence-thailand                  NEW (B2B)
│  ├─ /en/romance-scam-investigation              NEW
│  ├─ /en/cyber-investigation                     ← 301: /en/social-media-investigation, /en/phone-usage-investigation, /en/online-fraud-investigation (or keep fraud as article)
│  ├─ /en/hire-a-private-detective                hub  ← 301: /en/hire-a-detective-online, /en/how-to-find-a-good-detective
│  ├─ /en/pricing                                 NEW  ← 301: /en/private-detective-pricing, /en/affordable-private-detective
│  ├─ /en/how-it-works                            NEW (remote engagement, payment, updates, evidence delivery)
│  ├─ /en/about                                   NEW  ← 301: /en/trusted-detective-agency, /en/leading-detective-services, /en/what-is-a-detective-agency, /en/detective-services-overview
│  ├─ /en/case-studies  + /en/case-studies/<slug> NEW
│  ├─ /en/contact                                 keep
│  └─ /en/articles                                keep (qualities-of-a-good-detective, private-investigator, investigate-partner-before-marriage move here as posts)
│
├─ /zh …                                          keep as built (15 pages + 6 locations + articles)
└─ /lp/*                                          Ads landing pages, noindex (add EN variants)
```

## 6.3 Doorway-page test applied to the requested pages

| Proposed page | Distinct intent? | Enough unique content? | Verdict |
|---|---|---|---|
| `/private-investigator-thailand` (EN) | Yes (country-level commercial) | Yes: services overview, coverage map, how remote clients engage, legal boundaries, pricing model | Build (or make `/en` the pillar) |
| `/private-investigator-bangkok` (TH+EN) | Yes (local) | Yes: districts, typical Bangkok cases, start time, meeting options, Bangkok FAQ | Build |
| Pattaya / Phuket / Chiang Mai | Yes (local; strong foreign demand in Pattaya/Phuket) | Only if the firm has operated there and can describe it (travel/accommodation cost rules, typical cases, local constraints) | Build phase 2, one at a time, copy the `/zh` location model |
| Khon Kaen / Surat Thani | Weak (little evidence of search demand; expat concentration low) | Unlikely | Do not build; service-area section only |
| `/services/infidelity-investigation`, `/surveillance`, `/background-check`, `/missing-person`, `/address-tracing`, `/corporate-investigation` | Yes each | Yes if written as service pages (deliverables, process, FAQ, boundaries). Address tracing folds into missing-person; corporate = due diligence + employee screening | Build as listed in 6.2 (flat slugs to preserve existing URLs) |
| `/pricing` | Yes (commercial) | Yes: pricing model, factors, deposit rule, examples of ranges if the owner agrees to publish ranges | Build TH + EN |
| `/case-studies` | Yes (trust) | Only with real anonymised cases | Build template now, index when ≥3 cases exist (same rule as `/zh/case-studies`) |
| `/blog` | Already `/articles` | — | Keep `/articles` |
| `/contact` | Exists | — | Upgrade |

---

# PART 7 — Page-by-Page Recommendations

Each block: current problem → target → recommended rewrite. Titles ≤ 60 characters where possible; descriptions ≤ 155.

## 7.1 Thai homepage `/`

- **Current problem [Observed]:** Title "นักสืบเอกชนมืออาชีพ รับงานสืบทั่วราชอาณาจักร | Detective Pulse" is fine; hero subtitle claims unnamed awards; About paragraph lists unlawful-sounding services; nav has 3 links; "freelance/no office" FAQ; reviews not linked; WeChat QR on the Thai home (should live on `/zh`).
- **Target keyword:** นักสืบเอกชน · **Secondary:** จ้างนักสืบ, นักสืบกรุงเทพ, สืบชู้สาว, เช็คประวัติ, ตามหาคน · **Intent:** T/C.
- **SEO Title:** นักสืบเอกชน Detective Pulse | สืบชู้สาว เช็คประวัติ ตามหาคน ทั่วไทย
- **Meta Description:** นักสืบเอกชนมืออาชีพ ตั้งแต่ปี 2016 รับสืบชู้สาว เช็คประวัติบุคคล ตามหาคน สืบทรัพย์ ทั่วประเทศ ปรึกษาฟรีทาง LINE ตอบภายใน 1 ชม. เป็นความลับ 100%
- **H1:** นักสืบเอกชนมืออาชีพ กรุงเทพฯ และทั่วประเทศ
- **H2 structure:** บริการของเรา · ทำไมลูกค้ากว่า 1,900 เคสไว้ใจเรา · ขั้นตอนการทำงาน 5 ขั้น · ตัวอย่างเคส (ไม่เปิดเผยตัวตน) · พื้นที่ให้บริการ · รีวิวจากลูกค้า (Fastwork ยืนยัน) · คำถามที่พบบ่อย · ปรึกษาฟรี
- **Content changes:** rewrite About paragraph to lawful scope; name the entity/team; add response-time promise only if the owner commits to it; move WeChat block to `/zh`; link the Fastwork badge to the profile; add the "what we never do" line.
- **CTA:** Primary LINE (TH), secondary phone; tertiary form.
- **Internal links:** 6 service cards → upgraded service pages; new links to ราคานักสืบ, นักสืบกรุงเทพ, ขั้นตอนการทำงาน, เกี่ยวกับเรา, ผลงาน.

## 7.2 `/นักสืบชู้สาว/` (infidelity, Thai)

- **Problem:** article template; title = H1; three duplicates; no FAQ/CTA block; mixes "ก่อนแต่งงาน" intent that belongs to `/จ้างนักสืบตามแฟน/`.
- **Target:** นักสืบชู้สาว · **Secondary:** สืบชู้, จับชู้, สืบสามี, สืบภรรยา, หลักฐานฟ้องชู้, นักสืบชู้สาว ราคา · **Intent:** T.
- **SEO Title:** นักสืบชู้สาว สืบชู้ จับชู้ เก็บหลักฐานใช้ในศาล | Detective Pulse
- **Meta:** นักสืบชู้สาวมืออาชีพ ติดตามพฤติกรรมสามี-ภรรยาอย่างแนบเนียน หลักฐานภาพ/วิดีโอพร้อมไทม์ไลน์ ใช้ประกอบคดีฟ้องหย่า-ฟ้องชู้ เป็นความลับ ปรึกษาฟรี
- **H1:** นักสืบชู้สาว — ติดตามพฤติกรรม เก็บหลักฐานอย่างมืออาชีพ
- **H2:** สัญญาณที่ลูกค้ามักสังเกตก่อนจ้าง · เราทำงานอย่างไร (เฝ้าสังเกตในที่สาธารณะ ไม่ใช้อุปกรณ์ติดตามหรือเจาะโทรศัพท์) · สิ่งที่คุณจะได้รับ · หลักฐานแบบไหนที่ศาลรับฟัง (ปรึกษาทนาย) · ค่าใช้จ่ายและมัดจำ · ตัวอย่างเคส · คำถามที่พบบ่อย · ปรึกษานักสืบชู้สาว
- **CTA:** LINE + phone sticky; form prefilled caseType=สืบชู้สาว.
- **Internal links:** → ราคานักสืบ, หลักฐานฟ้องชู้ article, จ้างนักสืบตามแฟน, นักสืบกรุงเทพ, ผลงาน; ← from home, nav, every infidelity article.

## 7.3 `/จ้างนักสืบตามแฟน/` (partner / pre-marriage, Thai)

- **Title:** จ้างนักสืบตามแฟน สืบแฟน เช็คประวัติก่อนแต่งงาน | Detective Pulse · **Meta:** สงสัยแฟนนอกใจ หรืออยากมั่นใจก่อนแต่งงาน? นักสืบเอกชนช่วยติดตามพฤติกรรมและเช็คประวัติอย่างถูกกฎหมาย รายงานชัดเจน เป็นความลับ ปรึกษาฟรี · **H1:** จ้างนักสืบตามแฟน — รู้ความจริงก่อนตัดสินใจ · **H2:** สืบแฟน vs สืบคู่สมรส ต่างกันอย่างไร · เช็คประวัติก่อนแต่งงานตรวจอะไรได้บ้าง (ตามกฎหมาย) · ขั้นตอน · ค่าใช้จ่าย · FAQ · **Keyword:** สืบแฟน · **Intent:** T.

## 7.4 `/เช็คประวัติบุคคล/` (background check, Thai)

- **Problem [Observed]:** "นักสืบ Sherlock" brand in title/description/body; unlawful bullets; two duplicates.
- **Title:** เช็คประวัติบุคคลจากชื่อ-นามสกุล ถูกกฎหมาย | Detective Pulse · **Meta:** บริการเช็คประวัติบุคคล ตรวจสอบตัวตน ประวัติการทำงาน คดีความ ความน่าเชื่อถือ จากแหล่งข้อมูลที่เข้าถึงได้ตามกฎหมาย ก่อนร่วมงาน คบหา หรือทำธุรกิจ · **H1:** เช็คประวัติบุคคล ตรวจสอบก่อนไว้ใจใคร · **H2:** เช็คอะไรได้บ้าง (และอะไรที่ไม่มีใครเช็คให้ได้ถูกกฎหมาย) · กรณีที่ลูกค้าใช้บ่อย · ข้อมูลที่ต้องเตรียม · ระยะเวลาและราคา · FAQ · **Keyword:** เช็คประวัติบุคคล · **Intent:** T.

## 7.5 `/สืบตามหาคน/` (find a person, Thai)

- **Title:** สืบตามหาคน ตามหาคนหาย ลูกหนี้ คนโกง ทั่วไทย | Detective Pulse · **Meta:** นักสืบตามหาคนหาย ญาติพลัดพราก ลูกหนี้หลบหนี คนโกงออนไลน์ ประเมินความเป็นไปได้ฟรีจากข้อมูลที่คุณมี ทำงานเป็นระบบ อัปเดตต่อเนื่อง · **H1:** สืบตามหาคน — จากชื่อ รูป หรือเบาะแสเล็ก ๆ · **H2:** ตามหาคนประเภทไหนได้บ้าง · ต้องมีข้อมูลอะไร · เราทำอย่างไร · กรณีที่ควรแจ้งตำรวจก่อน · ราคา · FAQ · **Keyword:** ตามหาคน · **Intent:** T.

## 7.6 `/สืบทรัพย์สิน/` (asset search, Thai)

- **Title:** สืบทรัพย์สินลูกหนี้ ก่อนฟ้อง-บังคับคดี | Detective Pulse · **Meta:** บริการสืบทรัพย์ลูกหนี้ บ้าน ที่ดิน รถยนต์ กิจการ จากแหล่งข้อมูลที่เข้าถึงได้ตามกฎหมาย รายงานพร้อมหลักฐานใช้ประกอบการบังคับคดี ร่วมงานกับทนายความ · **H1:** สืบทรัพย์สิน — รู้ว่าลูกหนี้มีอะไร ก่อนเสียเวลาฟ้อง · **H2:** ทรัพย์สินที่สืบได้และวิธีสืบ · ทำงานร่วมกับทนายอย่างไร · กรณีศึกษา · ราคา · FAQ · **Keyword:** สืบทรัพย์ · **Intent:** T (lawyer channel).

## 7.7 `/นักสืบไอที/` (cyber / online, Thai)

- **Title:** นักสืบไอที สืบออนไลน์ ตามหาคนโกงออนไลน์ | Detective Pulse · **Meta:** สืบข้อมูลบนโซเชียลและออนไลน์อย่างถูกกฎหมาย ตรวจสอบตัวตน บัญชีปลอม ตามรอยคนโกงออนไลน์ ไม่เจาะระบบ ไม่ดักข้อมูล รายงานพร้อมหลักฐาน · **H1:** นักสืบไอที — สืบบนโลกออนไลน์ภายใต้กฎหมาย · remove all phone-record content.

## 7.8 `/จ้างนักสืบ/` (hire hub, Thai) and `/ราคานักสืบ/` (pricing, new)

- Hub **Title:** จ้างนักสืบ ขั้นตอน ราคา และวิธีเลือกให้ปลอดภัย | Detective Pulse · **H1:** จ้างนักสืบอย่างไรให้ได้ผลและไม่โดนหลอก · **H2:** 5 ขั้นตอน · เอกสาร/ข้อมูลที่ควรเตรียม · สัญญาณนักสืบปลอม · ราคา (ลิงก์) · FAQ.
- Pricing **Title:** ราคานักสืบเอกชน ค่าจ้างนักสืบคิดอย่างไร 2026 | Detective Pulse · **Meta:** ค่าจ้างนักสืบขึ้นกับประเภทงาน พื้นที่ ระยะเวลา และจำนวนทีม อธิบายโครงสร้างราคา มัดจำ 50% และสิ่งที่รวม/ไม่รวม ขอใบเสนอราคาฟรี · **H1:** ราคานักสืบเอกชน — โครงสร้างค่าใช้จ่ายที่โปร่งใส · **Recommendation [Owner]:** publish at least "starting from" ranges per service or a per-day band; competitors already publish 5,000–20,000 THB/day figures in SERP snippets, so a "ขอราคา" page with no numbers loses the click.

## 7.9 `/นักสืบกรุงเทพ/` (new) and `/en/private-investigator-bangkok` (new)

- **TH Title:** นักสืบกรุงเทพ นักสืบเอกชน กรุงเทพฯ และปริมณฑล | Detective Pulse · **H1:** นักสืบเอกชน กรุงเทพฯ — ทีมประจำ เริ่มงานได้ทันที · **H2:** งานที่รับบ่อยในกรุงเทพ · ย่านที่ทำงานประจำ · เริ่มงานได้เร็วแค่ไหน · นัดพบลูกค้าได้ที่ไหน · ปริมณฑล (นนทบุรี ปทุมธานี สมุทรปราการ) · FAQ.
- **EN Title:** Private Investigator Bangkok — Discreet, English-Speaking | Detective Pulse · **Meta:** Bangkok-based private investigators for infidelity, partner verification, background checks and surveillance. English-speaking case manager, WhatsApp updates, written report with photos. Free consultation. · **H1:** Private Investigator in Bangkok · **H2:** What foreign clients hire us for in Bangkok · Districts we work daily (Sukhumvit, Silom, Sathorn, Ratchada, Thonglor…) · How fast we can start · How you brief us from abroad · Pricing model · FAQ.

## 7.10 `/en` home and `/en/private-investigator-thailand`

- **Problem [Observed]:** `/en` title "Private Investigator in Thailand | Detective Pulse" is right, but Google's indexed title for `/en/` is the Thai home title (stale or duplicate signal); LINE is the first CTA; no process/payment/remote information; FAQ "freelance, no office".
- **SEO Title:** Private Investigator Thailand — Discreet, Nationwide | Detective Pulse · **Meta:** Professional private investigators in Thailand since 2016. Infidelity, Thai partner verification, background checks, missing persons, surveillance and due diligence. WhatsApp updates, written reports. Free consult. · **H1:** Private Investigators in Thailand You Can Brief From Anywhere · **H2:** Services · Why international clients choose us · How a remote case works (consult → quote → 50% deposit → updates → report) · Service areas · Case examples · Reviews · FAQ · Talk to an investigator.
- **CTA:** WhatsApp primary, phone secondary, form; LINE as tertiary.
- **Decision:** make `/en` itself the "private investigator Thailand" pillar and 301 `/en/private-investigator` to it; avoid two pages for one intent.

## 7.11 `/en/cheating-spouse-investigator`

- **Title:** Infidelity Investigator Thailand — Cheating Partner Surveillance | Detective Pulse · **Meta:** Discreet infidelity investigations across Thailand. Lawful surveillance in public places, photo/video evidence with timestamps, daily WhatsApp updates, written report. Free, confidential consultation. · **H1:** Infidelity & Cheating Partner Investigations in Thailand · **H2:** Signs clients report · How we work (and what we never do) · What you receive · Using evidence in a Thai or foreign divorce (consult a lawyer) · Timeline and pricing · Case example · FAQ.

## 7.12 `/en/thai-partner-verification` (new)

- **Title:** Thai Girlfriend / Partner Background Check | Detective Pulse · **Meta:** Verify a Thai partner's real name, age, marital status, work and living situation through lawful checks and discreet visits. Honest report, WhatsApp updates, no contact with the subject. · **H1:** Thai Partner Verification — Know Before You Commit · **H2:** What we verify (identity consistency, marital status via lawful means, employment, residence, lifestyle) · What we cannot verify legally · Red flags from our files (anonymised) · How to brief us from abroad · Pricing · FAQ (“Will she know?”, “What if she is married?”).

## 7.13 `/en/background-check`, `/en/find-missing-person`, `/en/asset-investigation`, `/en/cyber-investigation`

Same template; each gets a lawful-scope block, deliverables, pricing link, FAQ, case example. Titles: "Background Check Thailand — Lawful, Verified | Detective Pulse"; "Find a Missing Person in Thailand — Locate Services | Detective Pulse"; "Asset Search & Debtor Tracing Thailand | Detective Pulse"; "Cyber & Online Investigation Thailand | Detective Pulse".

## 7.14 `/en/pricing`, `/en/how-it-works`, `/en/about`, `/en/case-studies`, `/en/due-diligence-thailand`, `/en/surveillance-thailand`, `/en/romance-scam-investigation`

- Pricing **Title:** Private Investigator Cost in Thailand — Pricing Guide | Detective Pulse · publish bands (**Owner**).
- How it works **Title:** How to Hire Us From Abroad — Process, Payment, Reports | Detective Pulse · H2: Consultation · Case assessment · Quotation · Payment (bank transfer, Wise, card if available — **Owner** to confirm) · Deployment · Updates · Evidence delivery · Final report · Confidentiality & data retention.
- About **Title:** About Detective Pulse — Private Investigators in Thailand Since 2016 · must contain legal entity, founder/lead investigator (first name + role is enough), team size, languages, ethics statement.
- Due diligence **Title:** Due Diligence & Company Verification Thailand | Detective Pulse · H2: Registry checks (DBD) · Physical verification · Director/shareholder background · Supplier/factory visits · Report format · Pricing.
- Surveillance **Title:** Surveillance Services Thailand — Lawful, Discreet | Detective Pulse.
- Romance scam **Title:** Romance Scam Investigation Thailand — Verify Before You Send Money | Detective Pulse.

## 7.15 `/ติดต่อนักสืบ/` and `/en/contact`

- Add channel-by-urgency guidance, response-time commitment (**Owner**), what to prepare, a short reassurance about confidentiality, and the form with caseType preselect via query string (`?case=ชู้สาว`) so service pages can deep-link.

## 7.16 Pages to demote into `/articles` (keep URL, add canonical to self, link from hub)

`/นักสืบ/` (qualities of a detective), `/บริษัทนักสืบ/`, `/บริการนักสืบ/`, `/private-investigator/`, `/การฉ้อโกงออนไลน์และบทบ/`, `/en/qualities-of-a-good-detective`, `/en/private-investigator`, `/en/investigate-partner-before-marriage` (fold into partner verification), `/en/online-fraud-investigation`.

---
# PART 8 — Content Plan

## 8.1 Audit of existing content

- **[Observed]** 27 Thai pages (WordPress migration), 27 English mirrors, an unknown number of AI-generated TH/EN/ZH articles (drafted Tue/Fri, published on owner approval), 15 + 6 Chinese registry pages, 6 Thai Ads landing pages (noindex).
- **[Observed]** Thai body length: 1,399–5,544 non-whitespace characters; median ≈ 2,400 (≈ 350–500 Thai words). English mirrors: 72–658 words; median ≈ 310 words. Ten Thai pages have no H2; two contain empty bullet points left from the WP export (`/วิธีสืบทรัพย์ก่อนฟ้อง-เ/` ×3, `/นักสืบคดีชู้สาว-รับสืบค/` ×1); no page has a body image, table, checklist or example.
- **[Observed]** The AI pipeline targets one keyword per article in three languages with identical structure and a fixed CTA line; the Thai keyword list is sensible (it is the firm's own Ads/GSC winners) but there is no notion of pillar vs supporting article and no interlinking rule for TH/EN (only `/zh` has `service` → page linking, migration 0125).
- **[Hypothesis]** The informational pages ("นักสืบที่ดีควรมีคุณสมบัติ", "บริษัทนักสืบคืออะไร", "What is a detective agency") attract students and curious readers, not clients; they should not sit in the service tier.

## 8.2 Cluster model (traffic potential × commercial intent × authority × conversion)

For every cluster: pillar → supporting articles → CTA. Internal-link rule: each supporting article links to its pillar in the first 150 words and once in the conclusion with a descriptive anchor; each pillar links to all its supporting articles in a "อ่านเพิ่มเติม / Further reading" block; pricing and how-it-works are linked from every pillar.

| Cluster | Pillar (TH / EN) | Supporting articles (examples) | Target keywords | Intent | CTA |
|---|---|---|---|---|---|
| 1. Private investigation Thailand | `/` + `/จ้างนักสืบ/` · `/en` + `/en/hire-a-private-detective` | What a Thai PI can and cannot legally do · How to hire a PI online safely · How investigations are priced · 5 signs of a fake detective · What to prepare before your first consultation | นักสืบเอกชน, จ้างนักสืบ, private investigator Thailand, hire PI Thailand | T/C/I | LINE / WhatsApp consult |
| 2. Infidelity | `/นักสืบชู้สาว/` · `/en/cheating-spouse-investigator` | หลักฐานฟ้องชู้ที่ศาลรับฟัง · ฟ้องชู้เรียกค่าทดแทนได้เท่าไร (ปรึกษาทนาย) · สัญญาณนอกใจที่ลูกค้าเล่าให้เราฟังบ่อยที่สุด · Infidelity evidence and Thai divorce law (lawyer-reviewed) · Can I use Thai surveillance evidence in my home country? | สืบชู้, หลักฐานฟ้องชู้, cheating spouse Thailand | T/I | infidelity consult |
| 3. Partner verification & romance scams (EN-led) | `/en/thai-partner-verification`, `/en/romance-scam-investigation` · TH: `/จ้างนักสืบตามแฟน/` | Is my Thai girlfriend married? How marital status is verified lawfully · 9 romance-scam patterns we see from Thailand (anonymised) · Verifying someone you met online before visiting Thailand · Pre-marriage checks: what matters, what doesn't · Sin sod and family verification | Thai girlfriend background check, romance scam Thailand | T/I | WhatsApp consult |
| 4. Background checks | `/เช็คประวัติบุคคล/` · `/en/background-check` | เช็คประวัติจากชื่อ-นามสกุลทำได้แค่ไหน (PDPA) · ตรวจสอบประวัติพนักงานก่อนรับเข้าทำงานอย่างถูกกฎหมาย (HR) · Criminal record checks in Thailand: what exists and who can request it · Tenant/landlord verification for expats | เช็คประวัติบุคคล, background check Thailand | T/I | consult |
| 5. Missing persons & tracing | `/สืบตามหาคน/` · `/en/find-missing-person` | ตามหาคนจากชื่อ: ข้อมูลขั้นต่ำที่ต้องมี · ตามหาลูกหนี้ที่หนี · Finding a lost relative in Thailand (adoption, old friends, biological parents) · When to go to the police first | ตามหาคน, find someone in Thailand | T/I | consult |
| 6. Surveillance / behaviour | `/ติดตามพฤติกรรม/` · `/en/surveillance-thailand` | What lawful surveillance looks like in Thailand · How a 3-day surveillance is planned · Surveillance report sample (redacted) | ติดตามบุคคล, surveillance Thailand | T/I | consult |
| 7. Corporate / due diligence (B2B) | `/ตรวจสอบธุรกิจและคู่ค้า/`, `/ตรวจสอบประวัติพนักงาน/` · `/en/due-diligence-thailand` | How to check a Thai company on DBD (and what it won't tell you) · Factory/supplier physical verification checklist · Partner background before a Thai JV · Investment scams targeting foreigners in Thailand | due diligence Thailand, ตรวจสอบบริษัท | B2B | intake form |
| 8. Asset tracing | `/สืบทรัพย์สิน/` · `/en/asset-investigation` | สืบทรัพย์ก่อนฟ้อง vs หลังมีคำพิพากษา · ทรัพย์สินที่สืบได้ตามกฎหมาย · Working with a Thai lawyer on enforcement | สืบทรัพย์, asset search Thailand | T (lawyer) | consult |
| 9. Foreigners needing investigations in Thailand | `/en/how-it-works` | Paying a Thai investigator from abroad · How evidence is delivered securely · Time zones and daily updates · Confidentiality and PDPA for foreign clients | hire investigator Thailand from abroad | I→T | WhatsApp |

## 8.3 Twenty-four article ideas that can lead to cases

TH = Thai, EN = English, (B) = both languages with distinct angles, not translations.

1. (B) What a private investigator in Thailand can legally do — and the 7 things no honest firm will promise (PDPA, Computer Crime Act) — the trust cornerstone, also an AI-answer magnet.
2. TH หลักฐานฟ้องชู้ที่ศาลรับฟัง: ภาพ วิดีโอ ไทม์ไลน์ และข้อควรระวัง (lawyer-reviewed).
3. TH ฟ้องชู้เรียกค่าทดแทน ต้องเตรียมอะไรบ้าง (links to a partner law firm).
4. TH ค่าจ้างนักสืบ 2026: โครงสร้างราคาจริง ไม่ใช่ "แล้วแต่งาน".
5. EN How much does a private investigator cost in Thailand? Real pricing factors and typical bands.
6. EN Is my Thai girlfriend married? How marital status is verified lawfully in Thailand.
7. EN 9 romance-scam patterns we see from Thailand, anonymised from real files.
8. EN Verifying someone you met online before you fly to Thailand: a 48-hour checklist.
9. TH จ้างนักสืบออนไลน์อย่างไรไม่โดนหลอก: 6 สัญญาณนักสืบปลอม (Fastwork/LINE scams are a real problem).
10. TH เช็คประวัติบุคคลจากชื่อ-นามสกุล ทำได้แค่ไหนภายใต้ PDPA.
11. TH ตรวจสอบประวัติพนักงานก่อนรับเข้าทำงาน: วิธีที่ HR ทำได้ถูกกฎหมาย (B2B).
12. EN Criminal record checks in Thailand: what exists, who can request it, what a PI adds.
13. TH ตามหาคนจากชื่อ: ข้อมูลขั้นต่ำที่นักสืบต้องมี และกรณีที่ควรแจ้งตำรวจก่อน.
14. EN Finding a lost relative in Thailand (biological parents, old friends, adoptees).
15. TH สืบทรัพย์ลูกหนี้ก่อนฟ้อง vs หลังพิพากษา: ต่างกันอย่างไร ทนายใช้ข้อมูลอะไร.
16. EN How to check a Thai company on the DBD registry — and what it cannot tell you.
17. EN Supplier/factory verification in Chonburi–Rayong: a physical-check checklist (B2B, links to `/zh/chonburi` too).
18. EN Investment scams targeting foreigners in Thailand: condo, "guaranteed return", crypto.
19. (B) What a surveillance day actually looks like — planning, lawful limits, report format (with a redacted sample).
20. TH สัญญาณนอกใจที่ลูกค้าเล่าให้เราฟังบ่อยที่สุด (และสัญญาณที่มักเข้าใจผิด).
21. EN Hiring a Thai investigator from abroad: payment, updates, evidence delivery, confidentiality.
22. TH นักสืบไอที ทำอะไรได้บ้างโดยไม่ผิดกฎหมาย: OSINT, บัญชีปลอม, คนโกงออนไลน์.
23. EN Private investigator in Pattaya vs Bangkok: how cases differ (publish only when the Pattaya page exists).
24. (B) Case study series: "Case file #N" anonymised (see Part 8.5).

Not recommended: generic "history of detectives", "how to become a detective", "famous detectives" — traffic without cases (the existing `/นักสืบ/` and `/en/qualities-of-a-good-detective` fall in this bucket).

## 8.4 Six-month content calendar

Cadence: 2 service-page upgrades/new pages per week in month 1–2 (engineering + copy), then 1 pillar/service page + 2 articles per week. The existing Tue/Fri AI draft pipeline is kept but re-pointed at this calendar (replace `KEYWORD_TOPICS` order with the list below and require the human editor to add one firm-specific paragraph before approval).

| Month | Service / pillar work | Articles | Trust assets |
|---|---|---|---|
| **1 (Oct)** | Lawful-scope rewrite of all affected pages; service template for TH/EN; upgrade infidelity, background, find-person, asset, cyber (TH+EN); `/ราคานักสืบ`, `/en/pricing`; `/นักสืบกรุงเทพ`, `/en/private-investigator-bangkok` | #1, #4, #5, #9 | About page (TH/EN) with legal entity + team; link Fastwork reviews; GBP created |
| **2 (Nov)** | `/en/thai-partner-verification`, `/en/how-it-works`, `/ขั้นตอนการทำงาน`, consolidation 301s, nav/footer overhaul | #2, #6, #7, #10, #21 | First 3 case studies (TH/EN); redacted sample report PDF (gated or inline) |
| **3 (Dec)** | `/en/due-diligence-thailand`, `/ตรวจสอบธุรกิจและคู่ค้า`, `/ตรวจสอบประวัติพนักงาน`, `/en/surveillance-thailand`, `/ติดตามพฤติกรรม` | #11, #12, #16, #19 | Case studies 4–6; lawyer partner quotes on legal articles |
| **4 (Jan)** | `/en/romance-scam-investigation`; Pattaya pages (TH/EN) if content exists | #3, #8, #13, #18 | GBP reviews drive; expat-press outreach |
| **5 (Feb)** | Phuket pages (TH/EN); `/en/asset-investigation` deep dive; FAQ expansion per service | #14, #15, #17, #20 | Case studies 7–9; YouTube explainer per cluster |
| **6 (Mar)** | Chiang Mai pages; refresh month-1 pages with GSC query data; prune/merge any AI articles with zero impressions | #22, #23, #24, + 1 data piece: "Thailand PI case mix 2025–26" from anonymised internal stats | Annual "state of PI in Thailand" PR piece |

## 8.5 Case-study strategy and template

**Why:** case studies are the only content type that simultaneously proves Experience (E-E-A-T), answers "can you really do this?", carries long-tail keywords (city + service + situation), and converts (reader sees their own situation). Competitors mostly publish testimonials, not structured cases; the Chinese section already has a `ZH_CASE_STUDIES` type and page (currently empty, noindexed) — extend the same type to TH/EN.

**Privacy rules:** no names, exact dates, exact locations below district level, licence plates, photos of subjects, or any detail that could identify client or subject; change non-material facts; aggregate where possible; owner signs off every case.

**Template (one file per case, rendered in all three languages where relevant):**

```
Case file №  · Service · City/Region · Duration · Outcome tag
1. Situation            — who the client was (type only), what they knew, what they feared
2. Client objective     — the decision they needed to make
3. Investigation approach — lawful methods used, team size, days, what was deliberately not done
4. Challenges           — what made it hard (and how risk was managed)
5. Outcome              — what was established (not "we caught them"), what the client received
6. Lessons              — advice for someone in the same situation
7. Relevant service     — link to the service page + pricing
8. CTA                  — "Describe your situation — free, confidential assessment" (LINE / WhatsApp / WeChat by language)
```

Initial set: Bangkok infidelity (Thai client); Pattaya partner verification (foreign client, remote); locating a missing relative in Isan; pre-marriage verification; business-partner verification before a JV; a 3-day surveillance with a "nothing found" outcome (honesty signal). Index `/ผลงาน` and `/en/case-studies` only when ≥3 exist (same rule already coded for `/zh`).

---

# PART 9 — Local SEO Plan (Google Maps / Local)

**[Observed]** No Google Business Profile for Detective Pulse surfaced in the searches run; the site states there is no office; JSON-LD has no address or geo; the only review source is Fastwork. **[Hypothesis]** The firm is not in the map pack for "นักสืบ กรุงเทพ" or "private investigator Bangkok".

**Reality check:** Google allows service-area businesses (SAB) with a hidden address; they can rank in the local pack for the areas they serve, but they still need a verifiable business address for verification (video verification is typical) and the business name must be the real-world name ("Detective Pulse", not "Detective Pulse นักสืบเอกชน กรุงเทพ"). If the firm is a registered company with a registered address, that address can be used for verification and hidden.

## 9.1 Google Business Profile set-up (Owner + Dev)

1. Create/claim GBP as **service-area business**; primary category "Private investigator" (exists in Google's category list), secondary "Security service" only if real; service areas: Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, then Chonburi (Pattaya), Phuket, Chiang Mai.
2. Services list = the upgraded service pages (infidelity investigation, background check, missing person, asset search, surveillance, due diligence) with the same wording as the site H1s.
3. Description (750 chars) in Thai with one English sentence; must include since 2016, nationwide, confidentiality, free consultation, response time.
4. Photos: team (faces optional, badges/equipment acceptable), report mock-ups, Bangkok skyline/office meeting room, LINE/WhatsApp QR; avoid stock images.
5. Enable messaging; add booking link to `/ติดต่อนักสืบ/`; add UTM `?utm_source=google&utm_medium=gbp` to the website link.
6. Products/posts: weekly post per service with the case-study link.
7. Q&A: seed the 10 FAQ questions and answer them.

## 9.2 Reviews

- **Review velocity target:** 2–4 Google reviews/month. Sensitive clients: ask only clients who closed with a positive outcome, offer a short template ("professional, discreet, fast"), never mention case type. Many PI clients will refuse; corporate/lawyer clients are more willing.
- Keep Fastwork reviews linked (`sameAs`) and mention the platform on the site; move the review widget's "63 reviews" claim to link to the live profile so it can be verified.
- Review keywords to encourage naturally: "นักสืบ", "กรุงเทพ", "ชู้สาว"-free wording like "สืบข้อมูล", "เป็นความลับ".

## 9.3 NAP and citations

- One canonical NAP: **Detective Pulse**, +66 96 846 1406, detectivepluse@gmail.com (consider a branded `@detectivepulse.com` mailbox for trust), LINE OA id, website. Use it identically on GBP, Facebook, Fastwork, LINE OA, YouTube, Apple Business Connect, Bing Places.
- Citations worth having (Thai): Google Maps, Facebook, LINE OA, Fastwork, Wongnai? (no), Yellow Pages Thailand (thaiyellowpages), Thailand Business Directory (dataforthai lists registered companies automatically — only if registered), Pantip profile, Blockdit. English: Bing Places, Apple Maps, Yelp (weak in TH), ExpatDen/Thaiger business listings where available, international PI directories (PInow, WAD, CII, ICS "find a local PI") — some are paid; evaluate individually.
- Add `LocalBusiness`-compatible fields to `ProfessionalService` JSON-LD: `address` (at least `addressLocality: "Bangkok", addressCountry: "TH"`), `areaServed` as a list of `City`/`AdministrativeArea`, `openingHoursSpecification`, `foundingDate`, `email`, `sameAs`.

## 9.4 Location pages and local ranking strategy

- **Bangkok (TH + EN) now**: unique content as in Part 7.9; embed a Google Map of the service area only if a verified GBP exists; local FAQ; Bangkok case studies.
- **Pattaya, Phuket, Chiang Mai (phase 2)**: justified — Pattaya/Phuket have dense foreign demand (competitors run dedicated city sites), Chiang Mai has expat/retiree demand. Build only with evidence of operation (cases, travel-cost rules, local team).
- **Khon Kaen, Surat Thani**: not justified as pages; mention in a service-area section with a provincial case example each (Isan tracing is a real use case).
- **Local link signals**: Bangkok law firms, expat communities, co-working spaces, chambers of commerce (see Part 12).

## 9.5 Ranking plan for the four local targets

| Target | Lever |
|---|---|
| private investigator Bangkok | `/en/private-investigator-bangkok` + GBP + 3 Bangkok case studies + expat-press mention |
| private investigator Thailand | `/en` pillar + how-it-works + partner-verification cluster + directory links |
| นักสืบ กรุงเทพ | `/นักสืบกรุงเทพ/` + GBP + Thai reviews + Pantip presence |
| นักสืบเอกชน กรุงเทพ | same page, H2 variant, internal anchors from every Thai service page ("นักสืบเอกชน กรุงเทพ") |

---

# PART 10 — International Growth

## 10.1 Structure (keep)

**[Observed]** `/` (th), `/en`, `/zh` with `alternates.languages` and `x-default → /en` on homes; `<html lang>` corrected via middleware; `/cn/*` 301 → `/zh/*`. **[Recommendation]** Keep this. Do not move Thai under `/th/` — the Thai URLs are indexed and the migration risk outweighs any tidiness gain. Add `x-default` to Thai inner pages for consistency and make `hreflang` reciprocal everywhere (ZH pages already reference TH/EN; TH/EN reference ZH only where `zhSlugForEn` maps).

## 10.2 English: localisation, not translation

- Rewrite EN money pages for the foreign client's questions (Part 7.10–7.14). Each EN page should answer: can I brief you from abroad, how do I pay, how do I get updates, is it legal, will the subject know, what do I receive, how long, how much.
- CTAs: WhatsApp first everywhere on `/en` (hero, sticky, FAB order, exit intent, articles); email second for corporate.
- Add currency hints (THB with approximate USD/EUR) on pricing; state time zone (GMT+7) and typical response window.
- Payment proof: list accepted methods (**Owner** to confirm: Thai bank transfer, Wise, PayPal/card?) and the deposit rule, with a receipt/invoice statement (company receipt if registered).
- English-language reviews: ask foreign clients for Google reviews in English; display them on `/en`.

## 10.3 Which further languages are commercially justified

| Language | Evidence | Verdict |
|---|---|---|
| Chinese (zh-CN) | Built; Chinese SERP shows Taiwanese/HK agencies and Thai law firms targeting "泰国私家侦探"; clear cross-border demand (relationship, due diligence, scams) | **Keep investing**; follow `docs/china-market/14-90-day-backlog.md`. Index `/zh/case-studies` as soon as 3 cases exist. |
| Russian | Large Russian-speaking communities in Pattaya and Phuket; demand for partner checks, business/real-estate verification, locating people; few competitors publish Russian pages (hypothesis — not verified by crawl) | **Next after EN depth**, Phase 2 (months 4–6): `/ru` with 5 pages (home, infidelity, partner verification, due diligence/real-estate verification, how-it-works/pricing) and Telegram/WhatsApp CTA. Requires a Russian-speaking case manager. |
| Japanese | Large Japanese expat/corporate base in Bangkok (Sukhumvit/Sriracha); demand is mostly corporate compliance and infidelity; Japanese firms (tantei-com) already market Thai services in Japanese; high service expectations | **Phase 3**, only with a Japanese-speaking manager; start with one B2B page + LINE JP. |
| German | Moderate (Pattaya/Hua Hin/Phuket retirees); many Germans search in English | **Not now**; serve via EN with a German FAQ paragraph. |

## 10.4 China market opportunity (separate assessment)

**[Observed]** The Chinese section already positions for five segments (relationship, find person, background, due diligence, on-site verification), WeChat-first, with compliance guardrails and a structured intake. **[Recommendation by channel]:**

| Channel | Relevance to this business | Verdict |
|---|---|---|
| Chinese landing pages on detectivepulse.com (Google zh-CN) | High: overseas Chinese (SG/MY/HK/TW/diaspora) and VPN users search Google; the pages exist | **Yes — keep and deepen** (cases, pricing bands, redacted sample report, Chinese reviews). |
| Baidu SEO | Medium: Baidu indexes foreign-hosted sites but ranks them poorly without ICP/mainland hosting; Baidu Webmaster needs a mainland identity | **Low-effort only**: submit sitemap via Baidu Webmaster if an account can be obtained; do not buy mainland hosting yet (per `02-china-market-architecture.md`). Revisit after 6 months of `/zh` GSC data. |
| WeChat presence (personal/business account + QR) | Very high: it is the conversion channel; already the primary CTA | **Yes**: ensure the QR/ID are verified, add a WeChat Official Account only if content publishing capacity exists (eligibility for a Thai entity must be checked — item in `16-facts`). |
| Xiaohongshu | Medium-low: discovery for young Chinese women (relationship topics) but strict content rules; investigation services ads likely disallowed | **Experiment only**: 1 post/week of educational content ("在泰国如何核实对方身份") driving to WeChat, 8-week test, kill if no leads. |
| Chinese-language support | Essential for the segment; without it the pages produce leads that cannot be served | **Yes** (part-time Mandarin case manager or vetted translator with NDA). |
| Baidu/WeChat/XHS paid ads | Policy-restricted for investigation services | **No** until written policy confirmation. |

---

# PART 11 — Conversion Optimisation

## 11.1 Funnel view: Google → landing page → trust → understanding → contact → consultation

For each stage, the question "what could stop this visitor from contacting Detective Pulse?" and the fix.

| Stage | Friction observed | Fix |
|---|---|---|
| Landing (service page) | Page looks like a blog post; no immediate "what you get / how / how much"; CTA only in hero or at the bottom; on mobile the FAB auto-opens within 2 s and the AI launcher sits bottom-left — two floating buttons plus a sticky bar after 500 px scroll | Service template with a sticky in-page CTA card (LINE/WhatsApp/phone + "ประเมินฟรี"), deliverables and price band above the fold on mobile; one floating launcher only; FAB auto-open removed when the sticky bar is present |
| Trust | "Freelance, no office"; unnamed awards; no faces, no entity, no cases; reviews unlinked; app privacy policy | About page; legal entity + lead investigator; linked Fastwork + Google reviews; 3 case studies; "what we never do" block; marketing privacy notice in TH/EN/ZH |
| Service understanding | Scope is vague ("งานสืบทุกประเภท"); unlawful promises create doubt in informed readers | Per-service "ทำได้ / ไม่ทำ" lists; process steps with durations; sample report image |
| Pricing | "Depends — contact us" everywhere; competitors show day rates | Pricing page with bands and the 50 % deposit rule; "ขอใบเสนอราคาภายใน 1 ชม." if feasible |
| Contact | 5 channels + form + AI bot; English visitors pushed to LINE; no response-time promise; exit popup at 40 s on mobile | Language-aware channel order (TH: LINE › phone › form; EN: WhatsApp › email › form; ZH: WeChat › intake); response-time statement (Owner); exit popup desktop only |
| Consultation | Unknown hand-off quality; the AI assistant collects case details (good) but the lead row has no attribution | Attribution + lead_quality fields; LINE OA rich menu mirroring services; scripted first reply with assessment questions (already in the assistant prompt) |

## 11.2 Homepage rebuild

**Current structure [Observed]:** Hero → Stat band → Video → About → Services → Why us → Process → Reviews → Articles → FAQ → Contact (+ WeChat QR). **Verdict:** the order is reasonable; the content inside the blocks is the problem. Recommended structure:

```
Hero (who / what / where / proof / CTA)
Trust bar (since 2016 · 1,900+ cases · Fastwork 4.8★ linked · เป็นความลับ · ตอบใน X ชม.)
Services (6 cards → service pages, each with one deliverable line)
Why Detective Pulse (lawful methods · nationwide team · written reports · confidentiality; name the entity and lead investigator)
How investigation works (5 steps with durations + deposit rule)
Case studies (3 anonymised cards)
Service areas (Bangkok + provinces with examples; links to location pages)
Reviews (linked Fastwork + Google)
FAQ (keep, fix answers 2 and 9)
Final CTA (form + channels, language-aware)
```

Keep the video but move it under "Why" (it is not a trust proof by itself). Move the WeChat QR to `/zh` only.

**Recommended copy (Thai):**

- Hero headline: **นักสืบเอกชนมืออาชีพ กรุงเทพฯ และทั่วประเทศ**
- Subheadline: สืบชู้สาว เช็คประวัติ ตามหาคน สืบทรัพย์ ด้วยวิธีที่ถูกกฎหมาย รายงานพร้อมหลักฐานชัดเจน เป็นความลับ 100% ตั้งแต่ปี 2016
- Primary CTA: ปรึกษาฟรีทาง LINE
- Secondary CTA: โทร 096-846-1406
- Trust bar: ตั้งแต่ปี 2016 · ปิดกว่า 1,900 เคส · 4.8★ จาก 63 รีวิว (Fastwork) · 77 จังหวัด · ตอบกลับภายใน 1 ชั่วโมง (เวลาทำการ) [Owner confirms]

**Recommended copy (English):**

- Hero headline: **Private Investigators in Thailand — Discreet, Lawful, Nationwide**
- Subheadline: Infidelity, Thai partner verification, background checks, missing persons and due diligence. Brief us from anywhere, get WhatsApp updates and a written report with evidence.
- Primary CTA: Chat on WhatsApp
- Secondary CTA: Request a free assessment
- Trust bar: Since 2016 · 1,900+ cases closed · 4.8★ on Fastwork · English-speaking case manager · Reply within 1 hour (GMT+7, business hours) [Owner confirms]

The five questions the homepage must answer are then answered in the first screen: who (named firm, since 2016), what (six services), where (Bangkok + nationwide), why trust (lawful, cases, reviews, written reports), how to contact (LINE/WhatsApp/phone).

## 11.3 Trust funnel for international clients (`/en/how-it-works`)

Explain all eight steps explicitly — yes to every item in the brief:

1. **Initial consultation** — WhatsApp/email, free, what to share, confidentiality.
2. **Case assessment** — feasibility and lawful scope stated in writing; honest "we cannot" answers.
3. **Quotation** — fixed scope, day rates, expenses policy, currency, validity.
4. **Payment** — 50 % deposit, methods (bank transfer/Wise/other — confirm), receipt/invoice, refund rule.
5. **Investigator deployment** — team size, start date, what the client should not do (no contacting the subject).
6. **Daily updates** — channel, timing (GMT+7), format.
7. **Evidence delivery** — secure link, photo/video with timestamps, retention period, deletion on request.
8. **Final report** — language (EN/ZH/TH), structure, lawyer-friendly format, follow-up call.

Add a "Scam-proofing" note: how to verify Detective Pulse itself (registered entity, long-standing Fastwork profile, GBP, video call option). International clients fear being scammed by a PI as much as by the subject.

## 11.4 CRO backlog (concrete)

1. Service-page sticky CTA card (mobile bottom sheet with LINE/WhatsApp/phone + case type prefill).
2. Language-aware channel ordering everywhere (one source of truth, e.g. `CONTACT_CHANNELS[lang]`).
3. Remove FAB auto-open on mobile; keep ping animation; one floating launcher (merge AI assistant into the FAB panel as "แชทกับผู้ช่วย").
4. Exit-intent desktop only; mobile replaced by an inline "ยังไม่พร้อมคุย? รับเช็กลิสต์เตรียมตัวก่อนจ้างนักสืบ" lead magnet.
5. Lead form: add "ช่องทางที่สะดวกให้ติดต่อกลับ" (LINE/call/WhatsApp/email) and "เวลาที่สะดวก"; keep PDPA checkbox; prefill from service page.
6. Response-time commitment and "ใครจะติดต่อกลับ" (named case manager role).
7. Pricing bands on pricing page + "ราคาเริ่มต้น" on service cards.
8. Case study cards on home and each service page.
9. Reviews: link out, add 2–3 English reviews, add Google reviews when available.
10. Measure everything with `contact_click` + GA4 funnels; run one change at a time for 2–3 weeks given low volumes (no A/B tooling needed; use before/after by week).

# PART 12 — Marketing Strategy (integrated)

## 12.1 Channel analysis

| Channel | Opportunity | Target audience | Funnel role | Content strategy | Difficulty | Business value | Verdict |
|---|---|---|---|---|---|---|---|
| Google SEO (TH) | High — Thai SERPs are held by thin competitor sites, directories and Fastwork; a well-structured service site can win | Thai individuals, lawyers, HR | Acquisition + conversion | Parts 5–8 | Medium | Very high | **Core** |
| Google SEO (EN) | High but harder — 10+ established EN competitors with pricing pages and blogs | Foreigners in/with ties to Thailand | Acquisition | Localised EN pages, partner-verification cluster, how-it-works | Medium-high | Very high (higher ticket) | **Core** |
| Google Ads (TH/EN) | High — already running (agency); PI services are allowed (the spyware policy explicitly excludes PI services) | Same | Acquisition, instant | Dedicated LPs (exist for TH; add EN), call/chat conversion import | Medium | High | **Core, fix tracking first** |
| Google Maps / GBP | Medium-high — nobody in the Thai niche does it well; SAB possible | Bangkok searchers | Trust + acquisition | Reviews, posts, Q&A | Low-medium (verification) | High | **Build now** |
| LINE OA | Very high — it is the Thai conversion channel; also retention for referrals | Thai leads | Conversion + nurture | Rich menu by service, auto-reply with intake questions, monthly broadcast (educational, never case-specific) | Low | Very high | **Core** |
| WhatsApp (Business) | Very high for EN | Foreign leads | Conversion | Business profile, catalogue of services, quick replies in EN | Low | Very high | **Core** |
| Facebook page | Medium — Thai audience uses FB for recommendations; the page exists | Thai 25–55 | Trust + occasional acquisition | Weekly educational post, reviews, case-study teasers; no paid retargeting of sensitive topics | Low | Medium | **Maintain** |
| Instagram | Low — visual platform, sensitive service | — | — | Repurpose FB posts only | Low | Low | **Minimal** |
| TikTok | Medium (Thai) — "นักสืบ" explainer content performs; risk of trivialising; lead quality low | Thai 20–40 | Awareness | Short "สิ่งที่นักสืบทำไม่ได้" myth-busting, no case re-enactments | Medium | Low-medium | **Experiment 8 weeks** |
| YouTube | Medium — "private investigator Thailand" and "สืบชู้สาว" explainer searches; one video exists | Both | Trust + search | 6 explainer videos (one per cluster), embedded on service pages | Medium | Medium-high | **Yes, low cadence** |
| Reddit | Medium (EN) — r/Thailand, r/Bangkok, r/Pattaya threads on girlfriend checks and scams recur; promotional posts get removed | Foreign men 25–60 | Awareness + direct leads | Genuine, non-promotional answers from a verified account; link only when asked | Medium (moderation) | Medium | **Selective participation** |
| Quora | Low-medium | Global EN | Awareness/AI training data | Answer 20 evergreen questions once | Low | Low-medium | **One-off batch** |
| Pantip | Medium-high (TH) — "จ้างนักสืบ pantip" is a real query; threads like "จะจ้างนักสืบเพื่อฟ้องชู้มีแนะนำไหม" exist | Thai | Trust + leads | Helpful answers, no hard selling | Medium (community rules) | Medium-high | **Yes** |
| Expat communities (ExpatDen, Thaiger forums, FB expat groups, Pattaya News) | High | Foreigners | Trust + links | Guest explainer articles, scam-warning content | Medium | High | **Yes** |
| Law-firm partnerships | Very high — lawyers need lawful evidence, asset tracing, process serving; they are repeat referrers | Thai + international law firms | Referral (B2B) | Partner page, referral terms, co-branded articles, CLE-style briefing | Medium | Very high | **Priority** |
| Referral partners (translators, visa agents, relocation firms, wedding planners for cross-border couples, debt-collection agencies, HR consultancies) | High | — | Referral | Partner programme (ZH partner form exists — extend to TH/EN) | Medium | High | **Yes** |
| Chinese platforms (WeChat, XHS, Baidu) | See Part 10.4 | Chinese | — | — | High | Medium-high | **WeChat yes; others limited** |

## 12.2 Google Ads / paid search

**[Observed]** Ads are live (agency-managed GTM/GA4/Ads; Looker Studio report link; the keyword pool in code is derived from the Ads search-term report); six Thai `noindex` landing pages exist (`/lp/sued-choo-sao`, `tam-ha-kon`, `check-prawat`, `detective-bangkok`, `sued-sap-sin`, `detective-it`). No EN landing pages. Conversion tracking is form-only.

**Should paid search complement SEO?** Yes — PI demand is urgent and intent-dense; SEO for new service pages takes 2–4 months; Ads carries the gap and feeds keyword data back into the content plan. Reduce dependence over time by shifting budget from generic terms as organic positions arrive.

**Campaign clusters (separate TH and EN campaigns, exact + phrase, Search only, no Display):**

| Campaign | Example keywords | Negatives | Landing page | Message angle |
|---|---|---|---|---|
| TH · นักสืบชู้สาว | สืบชู้สาว, จับชู้, นักสืบชู้สาว, สืบแฟน, สืบสามี, สืบภรรยา | หนัง, ซีรีส์, นิยาย, ฟรี, แอป, โปรแกรม, ดักฟัง, แฮก, สมัครงาน, เงินเดือน | `/lp/sued-choo-sao` | "เก็บหลักฐานถูกกฎหมาย ใช้ในศาลได้ · เป็นความลับ · ปรึกษาฟรี" |
| TH · นักสืบกรุงเทพ | นักสืบกรุงเทพ, นักสืบเอกชน กรุงเทพ, บริษัทนักสืบ กรุงเทพ | same + ตำรวจ, สมัคร | `/lp/detective-bangkok` | "ทีมประจำกรุงเทพ เริ่มงานได้ทันที" |
| TH · เช็คประวัติ | เช็คประวัติบุคคล, ตรวจสอบประวัติ, สืบประวัติ | เช็คประวัติตัวเอง, ประวัติอาชญากรรม ออนไลน์ ฟรี, ตำรวจ | `/lp/check-prawat` | lawful, before you trust |
| TH · ตามหาคน | ตามหาคน, สืบหาคน, ตามหาลูกหนี้, ตามคนโกง | ตามหาหมา/แมว, ละคร, เพลง | `/lp/tam-ha-kon` | free feasibility check |
| TH · สืบทรัพย์ | สืบทรัพย์, สืบทรัพย์ลูกหนี้, สืบทรัพย์ก่อนฟ้อง | กรมบังคับคดี, ประมูล | `/lp/sued-sap-sin` | for lawyers and creditors |
| EN · PI Thailand | private investigator thailand, private detective thailand, hire private investigator thailand | jobs, salary, course, license, how to become, movie, novel, free | **new** `/lp/en/private-investigator-thailand` | "Brief us from anywhere · WhatsApp updates · written report" |
| EN · PI Bangkok | private investigator bangkok, bangkok private detective | same | **new** `/lp/en/private-investigator-bangkok` | Bangkok team, start within 24 h |
| EN · Infidelity | infidelity investigator thailand, cheating spouse thailand, cheating thai girlfriend/wife | app, spy app, tracker, free | **new** `/lp/en/infidelity` | lawful surveillance, evidence with timestamps |
| EN · Partner verification | thai girlfriend background check, verify thai girlfriend, thai fiancée check | dating site, visa, tourism | **new** `/lp/en/partner-verification` | know before you commit |
| EN · Background/Due diligence | background check thailand, due diligence thailand company, verify thai company | jobs, employment screening software | **new** `/lp/en/background-check` | lawful, written report, fast |
| EN · Missing person | find someone in thailand, locate person thailand, missing person thailand | tsunami, news, police hotline | **new** `/lp/en/find-a-person` | free feasibility assessment |

**Conversion tracking (must precede any budget increase):** import GA4 conversions `contact_click` (line/whatsapp/phone, deduplicated per session), `lead_submitted`, `assistant_lead_created` (add), and later offline conversions from `marketing_leads.stage` (qualified / paid) via `gclid` stored on the lead row. Use value-based bidding only once stage data exists.

**Policy notes [Observed from Google's policy pages]:** private investigation services are explicitly excluded from the spyware/surveillance prohibition, but ads must not promise phone records, location tracking of a person's phone, hacking, or access to private accounts; the current site copy in C1 would fail an ad review if a reviewer read the landing pages. Fix C1 before scaling.

## 12.3 Retargeting (privacy-conscious)

- **Google Ads:** Google's personalised-advertising policy treats relationship status, marital infidelity and "personal hardships" as sensitive interest categories; building remarketing lists from infidelity or partner-verification pages and showing ads that reference them is disallowed and ethically wrong (a shared family device could expose the user). **Allowed and recommended:** brand-only remarketing (no service named: "Detective Pulse — ปรึกษาฟรี เป็นความลับ") with a 7-day window, excluding the infidelity/partner pages from list creation entirely; or no remarketing at all.
- **Meta:** same restrictions (special ad categories and sensitive attributes). Use only broad brand awareness to lookalikes of page followers, never remarketing from the website on sensitive pages. Recommendation: skip Meta remarketing.
- **LINE OA:** the only retargeting that is both effective and respectful — people who added the OA opted in. Monthly educational broadcast, no case references; segment by the service they enquired about only inside 1:1 chat, never in broadcasts.
- Copy rule for any ad: never imply the viewer's situation ("สงสัยแฟนนอกใจ?" is fine on search ads where the user typed the intent; it is not fine on display/retargeting).

## 12.4 Backlink strategy

**[Not available]** backlink profile data. **[Hypothesis]** low authority; the realistic path is editorial, directory and partner links, not volume.

Twenty realistic opportunities/categories:

1. Thai law firms' "บริการ/พันธมิตร" pages (family law, debt recovery) — reciprocal partner pages.
2. International law firms in Bangkok with "private investigation" service pages (several already rank for the head term) — offer to be their execution partner and get credited.
3. Expat news: The Pattaya News, Pattaya Mail, Phuket News, Chiang Mai CityNews — sponsored or editorial scam-warning pieces (one competitor already did this).
4. Expat guides: ExpatDen, The Thaiger, Thailand Starter Kit, Coconuts — "how to verify a Thai partner / company" guest content.
5. "Best private investigators in Bangkok" listicles (cleverthai.com, top10bangkok.net, topbestbrand.com) — request inclusion with the entity facts.
6. International PI directories: PInow, WAD (World Association of Detectives — membership), CII, IKD, ICS "local PI" pages — some paid; pick two.
7. Fastwork profile (exists) — ensure the website link is present.
8. LINE OA, Facebook, YouTube, Apple Business Connect, Bing Places — entity links.
9. Thai business directories: Thai Yellow Pages, dataforthai (automatic if registered), Blockdit profile.
10. Chambers of commerce (Thai-Chinese, AustCham, BCCT, AMCHAM small-business member listings) — if the firm joins one for B2B credibility.
11. HR/recruitment communities (JobThai HR blog, HR Note Thailand) — pre-employment screening under PDPA guest article.
12. Debt-collection and credit-management associations' resource pages — asset-tracing explainer.
13. University legal clinics / law faculty blogs — evidence-admissibility article co-authored with a lawyer.
14. Thai personal-finance and relationship media (Sanook, Kapook, Praew) — expert quotes on infidelity evidence; they run such pieces.
15. Reddit/Quora/Pantip — nofollow but referral and AI-citation value.
16. Wedding/visa agencies serving cross-border couples — partner page links.
17. Real-estate due-diligence content partners (property lawyers, inspection firms) — "verify the developer" co-content.
18. Podcasts/YouTube channels for expats in Thailand — interview the lead investigator (link in show notes).
19. Scam-awareness NGOs/organisations and Thai police anti-scam campaigns (AOC 1441 content) — resource mentions where appropriate.
20. Original data piece ("Thailand PI case mix 2026", anonymised) pitched to news desks — the most scalable editorial-link asset.

Avoid: PBNs, bought guest posts on irrelevant sites, directory spam, exact-match anchor schemes.

## 12.5 Competitor analysis (SERP-based; sites not crawled)

| Competitor (domain) | Where they appear | Observed from snippets | Strengths (hypothesis) | Weaknesses (hypothesis) | Gap Detective Pulse can exploit |
|---|---|---|---|---|---|
| thailand-pi.com (Zele) | #1-type pages for "private investigator Thailand/Bangkok/Phuket", cost guide, Thai dating scams, company search, `/zh` page | City pages, pricing article, Chinese page, "since 2009", Google Reviews 5/5 claim | Mature content architecture; multilingual; reviews | Aggressive "#1" wording; template city pages | Honest lawful-scope content, Thai-language strength, LINE-native funnel, structured case studies |
| bangkokinvestigators.com | Thai girlfriend lies/scams blog, background checks, about page | Blog cluster on Thai girlfriend topics; testimonials; Pattaya News sponsored piece | Owns the romance/partner cluster in EN | Thin Thai presence | Partner-verification page + anonymised case data + bilingual trust |
| thailandprivateinvestigators.com / thailandinvestigators.com / bangkokinvestigators (network) | Service pages per city/service | Multiple sister domains | Many ranking URLs | Possible duplicate-network risk | Single strong entity with consistent NAP |
| siamspy.com | "#1 Private Investigator Thailand", Thai girlfriend background check, Q&A forum | Claims licensed & insured; forum content | Q&A/forum content = long-tail + AI citations | "Licensed" claim is unverifiable in a country with no PI licence | Publish the truth about licensing in Thailand (there is none) — an AI-answer winner |
| trueinvestigation.net | Pricing page, hire a PI | Public pricing (฿60–65k/week infidelity) | Transparent pricing | — | Thai-language pricing page + bands |
| sang-pi.com, hanumaninvestigation.com, absolute-investigation.com, pattayapi.com, bondrees.com | City/service pages, scam warning content | Pattaya/Phuket local sites; Bond Rees "98% success rate" | Local focus; global brands | Generic | Local pages with real local operations content |
| detectives.in.th (นักสืบแห่งประเทศไทย) | Thai head terms: นักสืบกรุงเทพ, นักสืบชู้สาว คืออะไร, จ้างนักสืบ ราคา | Large Thai article base, Bangkok page, pricing explainer | Thai topical authority | Dated design (hypothesis) | Better UX, LINE-first CRO, lawful positioning, case studies |
| spy-bangkok.com | นักสืบเอกชน กรุงเทพ | Title stuffed with pantip/ราคา keywords, "15 years" | Head-term presence | Keyword stuffing | Clean E-E-A-T |
| thai-detective.com (นักสืบณรงค์), sornor.net, bangkokdetective.com | Thai SERPs, Facebook | Personal-brand detectives; "35 years" | Personal trust | Weak sites | Named lead investigator + modern site |
| Fastwork.co | "จ้างนักสืบ … เริ่มต้น ฿500", infidelity gigs | Marketplace ranks for Thai transactional terms | Platform authority, reviews | Race to the bottom on price | Use Fastwork reviews as proof while positioning above the ฿500 gig tier |
| Law firms (siam-legal, chaninat & leeds, nitilawandwinner, skyinterlegal) | "private investigator Thailand", "นักสืบชู้สาว ฟ้องหย่า" | Investigation as a legal-service page | Authority, trust | Not operators | Partner with them; they need an executor |

**What Detective Pulse can do that competitors are not doing:**

1. Publish the honest legal boundary content in all three languages (nobody does this well; it is what lawyers, corporates and AI assistants cite).
2. Structured anonymised case files with outcomes including "nothing found".
3. Thai-native LINE conversion + English WhatsApp + Chinese WeChat from one entity with consistent facts.
4. Transparent pricing bands in Thai (competitors publish EN pricing; Thai SERP is "แล้วแต่งาน").
5. Lawyer-partner programme with a referral page and co-authored evidence content.
6. Measured funnel (clicks → leads → paid) — competitors are unlikely to have it; it compounds in Ads efficiency.

## 12.6 AI search / GEO / AEO

- **Entity clarity:** one name ("Detective Pulse"), one description, `Organization` + `ProfessionalService` with `@id`, `foundingDate`, `founder`/`employee` (lead investigator), `address` (locality), `areaServed` list, `knowsLanguage`, `sameAs` to Facebook, Fastwork, LINE OA, YouTube, GBP. Fix the `detectivepluse` typo handles' presentation (display "Detective Pulse" as the brand; keep the handles as identifiers).
- **Structured facts page** (`/เกี่ยวกับเรา`, `/en/about`): since, entity, team size, coverage, languages, response time, services, what we never do, deposit rule.
- **FAQ depth:** per-service FAQ (FAQPage) answering the literal questions people ask AI ("is it legal to hire a private investigator in Thailand", "how much does a PI cost in Thailand", "can a PI in Thailand get phone records" → "no").
- **Expert commentary:** author box on articles with the lead investigator's first name, role, years (Person schema); lawyer co-authors on legal pieces.
- **Original research:** annual anonymised case-mix statistics; "time-to-locate" medians; share of partner-verification cases with discrepancies — numbers AI assistants love to quote.
- **Definitions:** a glossary page (สืบทรัพย์, บังคับคดี, OSINT, due diligence) in TH/EN/ZH.
- **Location expertise:** Bangkok page with district knowledge (the `/zh/bangkok` copy is a good example).
- **Citations:** link out to PDPA, DBD, Thai police anti-scam resources — credibility signals.
- **Crawlability for AI bots:** `robots.ts` currently allows all user agents; keep GPTBot/Google-Extended/PerplexityBot/ClaudeBot allowed (no change needed, but do not block them).

## 12.7 Analytics and measurement architecture

**[Observed]** GTM (deferred) on the marketing host; events: `lead_submitted {case_type, locale}`, `career_application`, and the `/zh` set (`zh_page_view`, `wechat_cta_click`, `wechat_id_copied`, `contact_click`, `zh_intake_*`, `partner_*`). GA4 + Ads tags configured in GTM by an agency (not inspectable). `/marketing-insights` shows weekly leads (form vs AI chat), top case types, and a lead→quote→paid funnel built from `marketing_leads`.

**Target measurement model:**

| Layer | What | How |
|---|---|---|
| Site events (GTM dataLayer) | `contact_click {channel: line/whatsapp/phone/email/facebook/wechat, placement: hero/sticky/fab/exit/inline/footer/assistant, page, service, lang}`; `lead_submitted {service, lang, lead_ref}`; `assistant_opened`, `assistant_lead_created {service, lang, lead_ref}`; `pricing_viewed`; `case_study_viewed`; `cta_impression` optional | Extend `track()` union in `analytics.ts`; call from every CTA component; add `lead_ref` generation for TH/EN leads (reuse `lead-ref.ts` pattern) |
| GA4 | Conversions: `contact_click` (line/whatsapp/phone), `lead_submitted`, `assistant_lead_created`; custom dimensions: service, lang, placement, channel; explorations: landing page → contact; audiences only for brand remarketing (exclude sensitive pages) | GTM tag per event (agency) |
| Google Ads | Import GA4 conversions; store `gclid` on the lead row; upload offline conversions for `stage ∈ {qualified, paid}` with value | Dev: capture `gclid`/`utm_*` client-side into the lead POST; Owner/agency: offline import |
| Search Console | Weekly export of queries per page; feed `KEYWORD_TOPICS` and the content calendar | Owner/Dev |
| CRM (`marketing_leads`) | For every lead (form, assistant, LINE manual entry): source, channel, campaign, landing page, keyword (from Ads when available), service, location, lead_quality, quoted_value, stage, lost_reason, final_revenue, converted_at | Columns exist from 0124 except `lead_quality`, `lost_reason`, `gclid`, `channel`; add migration; fill for TH/EN |
| Dashboard | `/marketing-insights`: add leads by channel (LINE clicks vs form), CPL by campaign (import Ads cost via Looker or manual monthly), qualified rate, close rate, revenue by source, SEO-attributed revenue (source = organic) | Dev |

Core metric reported weekly: **qualified leads and revenue by source**, not sessions.

## 12.8 Lead attribution system (simple, implementable in this repo)

1. **Capture at first touch (client):** on first page view store `{landing_page, referrer, utm_source, utm_medium, utm_campaign, utm_term, gclid, fbclid, lang, first_seen}` in `sessionStorage`/`localStorage` (30-day). Already needed for the Chinese intake; make it a shared hook.
2. **Attach to every lead write:** `/api/marketing/lead`, `/api/marketing/assistant` (tool `submit_case`), `/api/marketing/zh-intake` — same payload. Manual LINE/WhatsApp/phone leads: admins add them in `/leads` with `source = line | whatsapp | phone | referral | gbp` and pick the campaign if the client mentions the ad.
3. **Lead ref in chat:** show a short `Lead ID` (e.g. `TH-251002-7KQ2`) on the form success screen and in the assistant hand-off so the admin can match the LINE conversation to the web lead (ZH already does this).
4. **Pipeline fields:** `stage` (new → contacted → qualified → quotation_sent → payment_pending → paid → case_created → closed_won / closed_lost), `lead_quality` (A/B/C), `lost_reason`, `quoted_value`, `final_revenue`, `service`, `target_location`.
5. **Formulas (weekly/monthly, by source and campaign):**
   - Cost per Lead = ad spend ÷ leads (paid sources); organic CPL = content cost ÷ organic leads
   - Qualified Lead Rate = qualified ÷ leads
   - Close Rate = paid ÷ qualified
   - CAC = spend ÷ paid cases
   - Revenue per Lead = Σ final_revenue ÷ leads
   - ROAS = Σ final_revenue (paid source) ÷ ad spend
   - SEO-generated revenue = Σ final_revenue where source ∈ {organic, gbp}
6. **Where it lives:** the existing `computeFunnel()` in `src/lib/marketing/zh/funnel.ts` generalised to all locales; one more panel in `/marketing-insights`.

---

# PART 13 — Implementation Roadmap

Owners: **Owner** (Detective Pulse management), **Dev** (this repo), **Copy-TH**, **Copy-EN**, **Agency** (Ads/GTM), **Legal** (Thai counsel).

## First 7 days

| Action | Priority | Impact | Difficulty | Time | Owner | Dependencies |
|---|---|---|---|---|---|---|
| Remove/rewrite unlawful-access claims (C1) on TH/EN pages, home About, FAQs | P0 | Very high (risk + trust) | Low | 1 day | Dev + Copy-TH | Owner sign-off on service scope |
| Wire `contact_click` on all CTAs; GA4 conversions; Ads import | P0 | Very high (measurement) | Low | 1–2 days | Dev + Agency | GTM access |
| Attribution fields on TH/EN leads + assistant leads | P0 | High | Low | 1 day | Dev | — |
| Brand/NAP normalisation (one LINE URL, remove "Sherlock", add sameAs/email/foundingDate to JSON-LD) | P1 | Medium-high | Low | 0.5 day | Dev | Owner confirms LINE OA link |
| Metadata pass (descriptions, empty titles, brand suffix) | P1 | Medium | Low | 0.5 day | Dev | — |
| Fix in-content absolute trailing-slash links; related-by-category block | P1 | Medium | Low | 1 day | Dev | — |
| WhatsApp-first on `/en` (hero/sticky/FAB/exit) | P1 | Medium | Low | 0.5 day | Dev | — |
| GSC: request re-index of home/contact; check Coverage for 308/404 anomalies; export queries | P1 | Medium | Low | 1 hour | Owner/Dev | GSC access |
| Decide and document the verifiable facts (entity, address for verification, awards, response time, payment methods) | P0 | High (unblocks trust work) | Low | 2 hours | Owner | — |

## Days 8–30

| Action | Priority | Impact | Difficulty | Time | Owner | Dependencies |
|---|---|---|---|---|---|---|
| Generalise the ZH registry (`ZhPage`) into a trilingual service-page template; render TH/EN service pages from it (hero, sections, deliverables, not-offered, FAQ + FAQPage, Service schema, CTA card, related) | P0 | Very high | Medium | 5–7 days | Dev | — |
| Rewrite 6 core TH service pages + 6 EN into the template (lawful scope, deliverables, FAQ, pricing link) | P0 | Very high | Medium | 6–8 days | Copy-TH, Copy-EN | Owner facts |
| Pricing pages TH/EN with bands | P0 | Very high | Low-medium | 2 days | Copy + Owner | Owner decides bands |
| Bangkok pages TH/EN | P0 | High | Medium | 3 days | Copy + Dev | — |
| About pages TH/EN (entity, team, ethics) | P0 | High | Low | 2 days | Owner + Copy | Facts |
| Consolidation 301s (Appendix C) via `next.config.ts` redirects; update sitemap/i18n maps | P1 | High | Low | 1 day | Dev | Template live |
| Nav "Services" dropdown + footer links for TH/EN | P1 | Medium-high | Low | 1 day | Dev | — |
| Overlay rationalisation (FAB auto-open off on mobile, exit desktop-only, single launcher) | P1 | Medium | Low | 1 day | Dev | contact_click live (to measure) |
| Marketing privacy notice TH/EN/ZH; noindex app `/privacy`,`/support` or move them | P1 | Medium | Low | 1 day + review | Dev + Legal | — |
| GBP creation + verification; Apple Business Connect; Bing Places | P1 | High | Medium (verification) | 1–3 weeks elapsed | Owner | Address for verification |
| EN Ads landing pages (6) + campaign restructure by cluster; negatives | P1 | High | Medium | 3 days | Dev + Agency | Tracking live |
| LINE OA rich menu by service + auto-reply intake questions | P1 | High | Low | 1 day | Owner | — |

## Days 31–90

| Action | Priority | Impact | Difficulty | Time | Owner | Dependencies |
|---|---|---|---|---|---|---|
| `/en/thai-partner-verification`, `/en/how-it-works`, `/ขั้นตอนการทำงาน`, `/en/due-diligence-thailand`, `/ตรวจสอบธุรกิจและคู่ค้า`, `/ตรวจสอบประวัติพนักงาน`, `/en/surveillance-thailand`, `/ติดตามพฤติกรรม`, `/en/romance-scam-investigation` | P1 | Very high | Medium | 3 weeks | Copy + Dev | Template |
| Case-study system (TH/EN/ZH) + first 6 cases; index at ≥3 | P1 | Very high (trust, conversion, E-E-A-T) | Medium | 2 weeks | Owner + Copy + Dev | Owner supplies cases |
| Redacted sample report (image/PDF) on how-it-works | P1 | High | Low | 2 days | Owner + Dev | — |
| Content calendar months 1–3 (12 articles) via the re-pointed AI pipeline + human paragraph | P1 | High | Medium | ongoing | Copy + Dev | Calendar in `KEYWORD_TOPICS` |
| Law-firm partner programme page (TH/EN) + outreach to 20 firms | P1 | Very high (B2B referrals) | Medium | 3 weeks | Owner | About page, case studies |
| Expat-press / expat-guide outreach (3 placements) | P2 | Medium-high | Medium | ongoing | Owner/Copy-EN | Lawful-scope content |
| Pantip/Reddit participation plan (2 h/week) | P2 | Medium | Low | ongoing | Owner | — |
| CRM fields (`lead_quality`, `lost_reason`, `gclid`, `channel`) + `/marketing-insights` panels for all locales + Ads cost import | P1 | High | Medium | 1 week | Dev | — |
| Offline conversion upload (qualified/paid) to Google Ads | P2 | High | Medium | 2 days + process | Agency + Dev | gclid captured |
| YouTube: 3 explainer videos embedded on service pages | P2 | Medium | Medium | 3 weeks | Owner | — |
| Pattaya pages TH/EN if evidence exists | P2 | Medium-high | Medium | 1 week | Copy + Dev | Owner input |

## Months 4–6

| Action | Priority | Impact | Difficulty | Time | Owner | Dependencies |
|---|---|---|---|---|---|---|
| Phuket, Chiang Mai pages (TH/EN) with local content | P2 | Medium-high | Medium | 2 weeks | Copy + Dev | Evidence |
| `/ru` pilot (5 pages) + Russian-speaking case manager | P2 | Medium-high | High | 4 weeks | Owner + Copy-RU + Dev | Staffing |
| Original data piece + PR push; glossary pages; author/Person schema | P2 | Medium-high (authority, AI citations) | Medium | 3 weeks | Owner + Copy | 6 months of case data |
| Refresh month-1 pages from GSC data; prune zero-impression AI articles; merge thin posts | P1 | High | Low | 1 week | Dev + Copy | GSC |
| `/zh` phase: index case studies, pricing bands, reviews, Baidu sitemap submission if account available | P2 | Medium | Medium | 2 weeks | Owner + Dev | 16-facts confirmed |
| Review programme steady state (2–4 Google reviews/month), GBP posts weekly | P1 | High | Low | ongoing | Owner | GBP live |
| Budget shift: reduce Ads on terms where organic reaches top 3; raise on EN partner-verification/due-diligence | P1 | High | Low | ongoing | Agency + Owner | Attribution data |

---

# PART 14 — TOP 20 ACTIONS (business impact × feasibility)

1. Remove every unlawful-access claim and add a "what we never do" block on every service page (TH/EN/ZH consistency).
2. Track LINE / WhatsApp / phone / email clicks as GA4 conversions and import them into Google Ads.
3. Store landing page, referrer, UTM and gclid on every TH/EN lead (form and AI assistant).
4. Convert the six core Thai and six core English service pages from the article template to a service template (deliverables, process, FAQ, Service schema, CTA card).
5. Publish Thai and English pricing pages with real bands and the deposit rule.
6. Publish `/นักสืบกรุงเทพ/` and `/en/private-investigator-bangkok`.
7. Publish About pages with the legal entity, lead investigator, team size and ethics; delete the unnamed "awards" claim; replace "freelance, no office" with an accurate statement.
8. Make WhatsApp the first CTA on all `/en` surfaces, including the mobile sticky bar.
9. Consolidate duplicate Thai/English pages with 301s into the core pages (Appendix C) and fix the 51 redirecting internal links.
10. Add a Services dropdown and services/locations footer for TH/EN; make related links category-based.
11. Normalise brand and NAP (one LINE URL, no "Sherlock", consistent "Detective Pulse", JSON-LD `sameAs`, email, foundingDate) and request re-indexing to drop the dead number.
12. Create a Google Business Profile (service-area), start a review programme, and link Fastwork/Google reviews from the site.
13. Build `/en/thai-partner-verification` and `/en/how-it-works` (remote engagement, payment, updates, evidence delivery, final report).
14. Ship the case-study system and publish the first six anonymised cases (index at three).
15. Create English Ads landing pages per cluster and restructure campaigns with negatives; stop sending EN traffic to the homepage.
16. Rationalise mobile overlays (no FAB auto-open, exit-intent desktop only, one launcher) and measure with the new events.
17. Launch the law-firm partner programme (page + 20 outreach emails) — the highest-value referral channel.
18. Re-point the AI article pipeline at the cluster calendar and require a firm-specific paragraph before approval; add Service-page linking for TH/EN articles.
19. Extend `/marketing-insights` into a lead → qualified → quoted → paid funnel by source for all languages and compute CPL, close rate, revenue per lead, ROAS, SEO revenue.
20. Publish the trilingual explainer "What a private investigator in Thailand can and cannot legally do" and build FAQ/author/entity schema around it for AI-search visibility.

---

# ADDITIONAL — Untapped Growth Opportunities (beyond conventional SEO)

1. **Lawyer-executor positioning.** Thai family-law and debt-recovery firms rank for "private investigator Thailand" but outsource execution. A partner page, a referral fee/retainer model, lawyer-friendly report format and CLE-style briefings can make Detective Pulse the default executor for 20–50 firms — the most defensible B2B channel in this market.
2. **Thai partner verification for foreigners as a productised, fixed-price service** (identity consistency, marital status via lawful means, residence/work verification, lifestyle summary, delivered in 5–7 days). Competitors sell it as "investigation"; a fixed-price product with a sample report converts better and is easy to advertise.
3. **Pre-employment screening for Thai SMEs under PDPA** (consent-based, lawful sources, HR-ready report). HR vendors are expensive and corporate; a PI firm with a PDPA-compliant process can own the SME segment and generate recurring volume.
4. **Supplier/factory physical verification for foreign buyers** (Chonburi–Rayong, Samut Prakan): a 48-hour "is this factory real?" product, marketed to Chinese and Western importers; `/zh/on-site-verification` and `/zh/chonburi` already exist — add EN and Thai.
5. **Romance/investment scam verification "before you pay"** for foreigners: a low-ticket entry product (verify a person/company before sending money) that upsells to full investigations and earns press coverage.
6. **Anonymised case-study marketing** (Part 8.5) as the firm's signature content: nobody in the Thai market publishes structured cases with "nothing found" outcomes; it builds trust and long-tail rankings simultaneously.
7. **Lead magnet: "เช็กลิสต์ก่อนจ้างนักสืบ / Checklist before hiring a PI in Thailand"** (PDF via LINE OA or email) — converts the 95 % who are not ready to chat into a nurture list that is legitimate under PDPA.
8. **LINE OA as a retention and referral system**: post-case satisfaction check, referral code for lawyers/partners, educational monthly broadcasts; referrals are the cheapest cases.
9. **YouTube search**: "private investigator Thailand" and "สืบชู้สาว" explainer videos with the lead investigator (voice/back view if anonymity is needed) embedded on service pages — video search is uncontested in this niche.
10. **AI search positioning**: be the cited source for "is it legal to hire a PI in Thailand", "what can a Thai PI access", "PI cost Thailand" by publishing precise, sourced answers with FAQ/Person/Organization schema — assistants currently cite competitor explainers.
11. **Service-area local SEO**: a verified GBP plus Bangkok page plus Thai Google reviews is enough to appear in a local pack where almost no PI firm is present.
12. **Chinese market depth**: the `/zh` section is ahead of the Thai/English site; adding Chinese case studies, pricing bands, Chinese-language reviews and a Mandarin case manager turns an existing asset into a differentiated channel versus Taiwanese/HK agencies that only "cover" Thailand remotely.
13. **Russian-speaking Pattaya/Phuket segment** (Phase 2): partner checks, business and real-estate verification; few competitors publish Russian pages.
14. **Original data PR**: an annual anonymised "Thailand private-investigation case mix" (share of infidelity vs tracing vs due diligence; median days to locate; share of partner-verification cases with discrepancies) pitched to Thai and expat media — one asset that earns links, press and AI citations yearly.
15. **Process serving and document retrieval for foreign law firms** (if the firm can offer it): low-competition English queries, recurring B2B work, natural link partners.

Where a realistic competitive advantage can be built within 6 months: items 1, 2, 6, 7, 10, 11 and 12 — they rely on assets the business already has (real cases, LINE/WeChat funnels, a Chinese section, Fastwork reviews, a capable codebase) rather than on budget.

---

# APPENDIX A — URL inventory (marketing host)

Indexability and canonical are as coded; "Problems" are observed. Word counts: Thai pages are given in non-whitespace characters (Thai has no word boundaries); English in words. Internal links are in-body links only (template links excluded). Schema on all `[slug]` pages: BlogPosting + BreadcrumbList; homes: ProfessionalService + AggregateRating + FAQPage; ZH pages: ProfessionalService + Service + FAQPage + BreadcrumbList.

## A.1 Thai (root) pages

| URL (decoded) | Title / H1 (same) | SEO title | Desc len | Body chars | H2/H3 | Int links | Intent | Target keyword | Problems |
|---|---|---|---|---|---|---|---|---|---|
| `/` | นักสืบเอกชน มืออาชีพ รับงานสืบทั่วราชอาณาจักร | นักสืบเอกชนมืออาชีพ รับงานสืบทั่วราชอาณาจักร \| Detective Pulse | 108 | — | many | 12+ | T | นักสืบเอกชน | unlawful About claims; awards claim; WeChat QR; 3-link nav |
| `/นักสืบชู้สาว/` | นักสืบชู้สาว งานสืบที่นักสืบถูกเรียกใช้มากที่สุดเป็น อันดับ 1 | same, no brand | 136 | 2,729 | 2/0 | 3 | T | นักสืบชู้สาว | article template; "อันดับ 1" claim; cannibalised ×3 |
| `/นักสืบคดีชู้สาว-รับสืบค/` | นักสืบคดีชู้สาว รับสืบคดีชู้สาว ติดตามพฤติกรรมสามี-ภรรยา สืบชู้ สืบกิ๊ | same | 230 (too long) | 2,429 | 0/0 | 0 | T | สืบชู้ | duplicate of above; no H2; empty bullet; no links → **301 to /นักสืบชู้สาว/** |
| `/สิ่งที่ควรรู้ก่อนการจ้/` | สิ่งที่ควรรู้ก่อนการจ้างนักสืบเพื่อเก็บหลักฐานเพื่อฟ้องชู้ | same | 251 (too long) | 1,399 | 0/0 | 0 | I→T | หลักฐานฟ้องชู้ | thinnest page; rewrite as evidence article |
| `/จ้างนักสืบตามแฟน/` | จ้างนักสืบตามแฟน ก่อนการตัดสินใจเริ่มต้นชีวิตคู่ | จ้างนักสืบตามแฟน ก่อนการตัดสินใจแต่งงาน | 126 | 2,661 | 2/0 | 3 | T | สืบแฟน | ok topic; needs template |
| `/เช็คประวัติบุคคล/` | เช็คประวัติบุคคลจากชื่อ นามสกุล ให้พวกเรานักสืบเอกชนมืออาชีพช่วยคุณ | …นักสืบ Sherlock ช่วยคุณได้ | 138 | 3,419 | 3/0 | 5 | T | เช็คประวัติบุคคล | wrong brand; unlawful bullets (bank statements, credit bureau, immigration, registry) |
| `/บริการตรวจสอบประวัติบุ/` | บริการตรวจสอบประวัติบุคคลอย่างละเอียด - เผยความจริงและความมั่นใจ | same | 168 | 2,021 | 0/0 | 0 | T | ตรวจสอบประวัติ | duplicate → **301 to /เช็คประวัติบุคคล/** |
| `/บริการสืบประวัติบุคคลด/` | บริการสืบประวัติบุคคลด้านทรัพย์สิน ตรวจสอบทรัพย์สินต่างๆ | same | 247 (too long) | 1,668 | 0/0 | 0 | T | สืบทรัพย์ | duplicate → **301 to /สืบทรัพย์สิน/** |
| `/สืบตามหาคน/` | สืบตามหาคน หายตัวไป ไม่ใช่เรื่องยากเมื่อคุณมีนักสืบเอกชน | same | 138 | 3,934 | 4/0 | 2 | T | ตามหาคน | template |
| `/จ้างนักสืบตามหาคน/` | จ้างนักสืบตามหาคน หาญาติ หาลูกหนี้ พวกเรารับจบ | จ้างนักสืบตามหาคน หาญาติ หาลูกหนี้ หาบุคคลสูญหาย | 129 | 2,253 | 2/0 | 3 | T | จ้างนักสืบตามหาคน | near-duplicate → merge into /สืบตามหาคน/ (keep as section) |
| `/สืบทรัพย์สิน/` | สืบทรัพย์สิน ของลูกหนี้ เรียกใช้งานนักสืบเอกชนได้ | same | 140 | 4,239 | 4/0 | 2 | T | สืบทรัพย์ | template |
| `/วิธีสืบทรัพย์ก่อนฟ้อง-เ/` | วิธีสืบทรัพย์ก่อนฟ้อง เริ่มต้นค้นหาความถูกต้องและประเมินมูลค่า | same | 167 | 1,997 | 0/0 | 0 | I | สืบทรัพย์ก่อนฟ้อง | 3 empty bullets; generic → 301 or rewrite as lawyer-facing article |
| `/นักสืบไอที/` | นักสืบไอที – รับสืบงานบนโลกออนไลน์ลักษณะไหนบ้าง | same + "?" | 140 | 4,115 | 4/5 | 2 | T | นักสืบไอที | template |
| `/บริการสืบค้นข้อมูลไอที/` | บริการสืบค้นข้อมูลไอทีจาก Facebook, LINE, Instagram และสื่อออนไลน์ด้วย | **empty** | 209 (too long) | 1,434 | 0/0 | 0 | T | สืบโซเชียล | duplicate → **301 to /นักสืบไอที/** |
| `/บริการตรวจสอบการใช้โทร/` | บริการตรวจสอบการใช้โทรศัพท์ ค้นประวัติการใช้งานอย่างละเอียด | **empty** | 170 | 1,578 | 0/0 | 0 | T | ตรวจสอบการใช้โทรศัพท์ | **unlawful service (call/SIM history)** → remove/301 |
| `/จ้างนักสืบ/` | จ้างนักสืบ มืออาชีพ มีวิธีและขั้นตอนแบบไหน ไปดูกันเลย | same | 125 | 2,941 | 2/0 | 6 | T/C | จ้างนักสืบ | hub candidate |
| `/จ้างนักสืบ-ราคาถูก/` | จ้างนักสืบ ราคาถูก งานดี นักสืบมืออาชีพ พูดคุยรายละเอียดก่อนรับงาน | จ้างนักสืบ ราคาถูก งานดี รวดเร็ว มืออาชีพ ปรึกษาได้ก่อนรับงาน | 131 | 2,899 | 2/0 | 4 | C | นักสืบ ราคาถูก | "cheap" positioning conflicts with trust → 301 to pricing |
| `/วิธีการคิดราคาจ้างนักส/` | วิธีการคิดราคาจ้างนักสืบเอกชน ทำไมราคาแตกต่างกัน? | same | 130 | 1,706 | 0/0 | 0 | C | ค่าจ้างนักสืบ | → 301 to pricing page |
| `/จ้างนักสืบออนไลน์/` | จ้างนักสืบออนไลน์ Detectivepulse \| สะดวก รวดเร็ว และน่าเชื่อถือ | same | 129 | 3,652 | 5/0 | 3 | T | จ้างนักสืบออนไลน์ | GSC winner per code comments; keep, rewrite |
| `/การหานักสืบเชี่ยวชาญ-คำ/` | การหานักสืบเชี่ยวชาญ คำแนะนำและวิธีการหานักสืบที่ไว้ใจได้ | same | 126 | 1,824 | 0/0 | 0 | I | หานักสืบ | → 301 to /จ้างนักสืบ/ |
| `/บริษัทนักสืบ/` | บริษัทนักสืบ คืออะไร รับงานแบบไหนบ้าง | บริษัทนักสืบ คืออะไร งานสืบแบบไหนที่รับจ้างทำบ้าง | 123 | 2,724 | 2/0 | 5 | I/C | บริษัทนักสืบ | keep as article |
| `/บริษัทนักสืบมืออาชีพที/` | บริษัทนักสืบมืออาชีพที่ไว้ใจได้ บริการสืบทุกประเภทของคดี | same | 225 (too long) | 2,295 | 0/0 | 0 | C | บริษัทนักสืบ | → 301 to /เกี่ยวกับเรา/ |
| `/บริการนักสืบ/` | บริการนักสืบ มีอะไรบ้าง และ เราควรเลือกบริษัทนักสืบจากอะไร ? | same | 133 | 4,184 | 4/0 | 3 | C | บริการนักสืบ | overlap with home; keep as article |
| `/บริการนักสืบชั้นนำเพื่/` | บริการนักสืบชั้นนำ เพื่อค้นหาข้อมูลและหลักฐานในคดีที่คุณต้องการ | same | 150 | 2,187 | 0/0 | 0 | C | บริการนักสืบ | → 301 to /เกี่ยวกับเรา/ |
| `/นักสืบ/` | นักสืบ ที่ดีควรมีคุณสมบัติ และ วิสัยทัศน์อย่างไร ? | same | 135 | 5,544 | 5/0 | 3 | I | นักสืบ | informational; demote to articles |
| `/private-investigator/` | Private Investigator (นักสืบเอกชน) รับสืบงานสำหรับบุคคลทั่วไป | same | 138 | 4,454 | 3/7 | 3 | C | private investigator | English slug on Thai site; duplicates /en intent |
| `/การฉ้อโกงออนไลน์และบทบ/` | การฉ้อโกงออนไลน์และบทบาทของนักสืบเอกชน | …นักสืบเอกชนนักสืบเอกชน (duplicated words) | 122 | 2,208 | 0/4 | 2 | I | โกงออนไลน์ | fix title; article |
| `/ติดต่อนักสืบ/` | ติดต่อนักสืบ เมื่อความจริง มีค่ากว่าความสบายใจ | ติดต่อนักสืบ Detectivepulse มืออาชีพในการไขความจริงทุกปัญหา | 139 | 2,900 | 6/0 | 2 | T | ติดต่อนักสืบ | empty link `[]()`; contact page as article |
| `/articles` | บทความทั้งหมด | บทความน่ารู้เกี่ยวกับงานนักสืบเอกชน \| Detective Pulse | 141 | — | — | all | I | — | mixes service pages and posts |
| `/careers`, `/privacy`, `/support` | — | — | — | — | — | — | — | — | privacy/support are app pages (noindex or rewrite) |
| `/lp/*` (6) | campaign pages | `${keyword} \| Detective Pulse` | — | — | — | — | T | Ads | noindex (correct) |

## A.2 English pages

| URL | SEO title | Desc len | Words | H2 | Int links | Problems / action |
|---|---|---|---|---|---|---|
| `/en` | Private Investigator in Thailand \| Detective Pulse | 172 (long) | — | — | 12+ | Google shows Thai title for `/en/` (check GSC); LINE-first; FAQ "no office" |
| `/en/private-investigator` | Private Investigator in Thailand for Individuals \| Detective Pulse | 162 | 658 | 3/7 | 4 | duplicates `/en` intent → 301 to `/en` |
| `/en/cheating-spouse-investigator` | Cheating Spouse Investigator in Thailand \| Detective Pulse | 160 | 205 | 2 | 1 | thin for the money page; upgrade |
| `/en/catch-a-cheating-partner` | Infidelity Investigators — Catch a Cheating Partner \| Detective Pulse | 166 | 378 | 0 | 1 | → 301 to cheating-spouse |
| `/en/evidence-for-adultery-lawsuit` | Evidence for an Adultery Lawsuit — What to Know \| Detective Pulse | 217 (long) | 287 | 0 | 1 | keep as article, lawyer-reviewed |
| `/en/investigate-partner-before-marriage` | Investigate a Partner Before Marriage \| Detective Pulse | 142 | 414 | 2 | 2 | fold into thai-partner-verification |
| `/en/background-check` | Background Check Services in Thailand \| Detective Pulse | 151 | 119 | 2 | 1 | 119 words for a core service — upgrade |
| `/en/personal-background-check-service` | Detailed Personal Background Check Service \| Detective Pulse | 172 | 348 | 0 | 1 | → 301 to background-check |
| `/en/asset-background-check` | Asset Background Check Service in Thailand \| Detective Pulse | 167 | 268 | 0 | 1 | → 301 to asset-investigation |
| `/en/asset-investigation` | Asset Investigation & Debtor Asset Search in Thailand \| Detective Pulse | 159 | 125 | 2 | 1 | upgrade |
| `/en/trace-assets-before-lawsuit` | How to Trace Assets Before Filing a Lawsuit \| Detective Pulse | 136 | 362 | 0 | 1 | article |
| `/en/find-missing-person` | Find a Missing Person in Thailand \| Detective Pulse | 142 | 116 | 2 | 1 | upgrade |
| `/en/trace-people-and-debtors` | Find Missing People, Relatives and Debtors \| Detective Pulse | 172 | 397 | 2 | 2 | → merge |
| `/en/cyber-investigation` | Cyber & Online Investigation in Thailand \| Detective Pulse | 155 | 114 | 2 | 1 | upgrade |
| `/en/social-media-investigation` | Social-Media & Online Investigation Service \| Detective Pulse | 188 (long) | 199 | 0 | 1 | → 301 to cyber |
| `/en/phone-usage-investigation` | Phone Usage Investigation Service \| Detective Pulse | 176 | 242 | 0 | 0 | **unlawful service** → remove/301 |
| `/en/online-fraud-investigation` | Online Fraud & the Role of the Private Investigator \| Detective Pulse | 149 | 302 | 0/4 | 2 | article |
| `/en/hire-a-private-detective` | Hire a Private Detective in Thailand \| Detective Pulse | 159 | 130 | 3 | 1 | hub; upgrade |
| `/en/hire-a-detective-online` | Hire a Private Detective Online in Thailand \| Detective Pulse | 174 | 563 | 5 | 3 | → merge into hub |
| `/en/how-to-find-a-good-detective` | How to Find a Skilled, Trustworthy Detective \| Detective Pulse | 138 | 324 | 0 | 1 | → merge into hub |
| `/en/private-detective-pricing` | Private Detective Pricing — Why Costs Differ \| Detective Pulse | 149 | 311 | 0 | 1 | → 301 to /en/pricing |
| `/en/affordable-private-detective` | Affordable Private Detective, Fast & Professional \| Detective Pulse | 176 | 382 | 2 | 4 | → 301 to /en/pricing |
| `/en/trusted-detective-agency` | Trusted Professional Detective Agency in Thailand \| Detective Pulse | 163 | 321 | 0 | 1 | → 301 to /en/about |
| `/en/leading-detective-services` | Leading Detective Services in Thailand \| Detective Pulse | 147 | 317 | 0 | 0 | → 301 to /en/about |
| `/en/detective-services-overview` | Detective Services & How to Choose an Agency \| Detective Pulse | 145 | 485 | 4 | 3 | → 301 to /en/about or hub |
| `/en/what-is-a-detective-agency` | What Is a Detective Agency & What Cases It Handles \| Detective Pulse | 165 | 375 | 2 | 4 | article |
| `/en/qualities-of-a-good-detective` | What Makes a Good Detective — Qualities & Vision \| Detective Pulse | 165 | 616 | 4 | 2 | article (low value) |
| `/en/contact` | Contact a Private Investigator in Thailand \| Detective Pulse | 145 | 72 | 1 | 0 | fine but thin; add process + response time |

## A.3 Chinese pages (built last cycle, for completeness)

`/zh` + `/zh/private-investigator-thailand`, `bangkok-investigation`, `relationship-investigation`, `background-check`, `find-person-thailand`, `business-due-diligence`, `on-site-verification`, `asset-investigation`, `how-it-works`, `pricing`, `case-studies` (noindex while empty), `about`, `partners`, `company-profile`, `contact`, + `/zh/bangkok`, `pattaya`, `phuket`, `chiang-mai`, `chonburi`, `samui`, + `/zh/articles/*`. Observed problems: none structural; facts still pending confirmation (`16-facts`).

## A.4 Technical checks summary

| Check | Result |
|---|---|
| robots.txt | Generated (`robots.ts`): allow `/`, disallow app paths, sitemap + host declared. OK. Consider adding `/review/`, `/lp/` (they are noindexed via meta; disallowing is optional). |
| XML sitemap | Generated: static + 27 TH + 27 EN + ZH + AI articles. **Issue:** `lastModified = now` for every static entry; `/privacy`, `/support` included. |
| Canonical | Every route sets canonical to the served, non-trailing-slash path. OK. |
| hreflang | Homes: th/en/zh-CN/x-default. TH/EN inner pages: th/en(/zh-CN) without x-default. ZH: zh-CN/th/en/x-default. Articles: th/en(/zh-CN). **Minor inconsistency.** |
| noindex | `/lp/*`, `/review/*`, `/zh/case-studies` (while empty); all non-marketing hosts via `X-Robots-Tag`. OK. |
| Redirects | `/cn/*→/zh/*`, WP cruft (`/sample-page`, `/home`, `/author/*`, `/category/*`, `/blog*`, `/feed*`) → 301. Trailing-slash URLs → 308 (Next default). Old WP URLs preserved. OK. |
| 404 | `dynamicParams=false` on TH/EN/LP/ZH routes → clean 404 for unknown slugs. OK. |
| URL structure | Thai percent-encoded slugs preserved (acceptable; do not change). |
| HTTP→HTTPS, www | HSTS preload header set; www stripping handled by host check (Vercel redirect assumed — **not verified**). |
| Rendering | Fully server-rendered; metadata forced into `<head>`; no client-only content. **Issue:** all routes dynamic because root layout reads `headers()`. |
| Core Web Vitals | **Field data not available.** Code-level: hero avoids opacity animation on LCP element; FAB panel absolutely positioned to avoid CLS; GTM deferred; fonts via `next/font` with Playfair `preload:false`; cover images 70–207 KB via `next/image`. Internal Lighthouse note: Perf ~87 mobile, CLS 0. **Hypothesis:** INP risk from four client overlays and backdrop-blur layers on low-end Android; TTFB risk for non-Asian visitors due to dynamic rendering in `sin1`. Fixes: static/ISR for TH/EN pages (move the host switch to middleware rewrite instead of `headers()` in the root layout), one overlay, test `backdrop-blur` removal on mobile. |

---

# APPENDIX B — Schema (JSON-LD) recommendations

Current: `ProfessionalService` (+`AggregateRating`), `FAQPage` on homes; `BlogPosting` on all `[slug]` pages; `BreadcrumbList`; ZH adds `Service`. Policy notes: Google shows FAQ rich results only for well-known authoritative government/health sites since 2023, but `FAQPage` remains valid structured data and useful for AI extraction; `AggregateRating` on a `ProfessionalService` is acceptable only if the reviews are genuinely about the business and visible on the page (they are — keep the count in sync with Fastwork and link the source); do not mark up third-party review snippets as `Review` unless they are displayed with author and date (they are).

**B.1 Organization / ProfessionalService (site-wide, TH shown; translate `description`, keep `@id` identical)**

```json
{
  "@context": "https://schema.org",
  "@type": ["ProfessionalService", "LocalBusiness"],
  "@id": "https://detectivepulse.com/#business",
  "name": "Detective Pulse",
  "alternateName": ["นักสืบเอกชน Detective Pulse", "Detective Pulse Thailand"],
  "legalName": "<registered entity name — Owner to confirm>",
  "url": "https://detectivepulse.com/",
  "logo": "https://detectivepulse.com/marketing/logo.png",
  "image": "https://detectivepulse.com/marketing/logo.png",
  "description": "นักสืบเอกชนมืออาชีพ ตั้งแต่ปี 2016 รับสืบชู้สาว เช็คประวัติบุคคล ตามหาคน สืบทรัพย์ และตรวจสอบธุรกิจ ด้วยวิธีที่ถูกกฎหมาย ทั่วประเทศไทย",
  "foundingDate": "2016",
  "telephone": "+66968461406",
  "email": "detectivepluse@gmail.com",
  "address": { "@type": "PostalAddress", "addressLocality": "Bangkok", "addressCountry": "TH" },
  "areaServed": [
    { "@type": "Country", "name": "Thailand" },
    { "@type": "City", "name": "Bangkok" }, { "@type": "City", "name": "Pattaya" },
    { "@type": "City", "name": "Phuket" }, { "@type": "City", "name": "Chiang Mai" }
  ],
  "knowsLanguage": ["th", "en", "zh-CN"],
  "priceRange": "฿฿",
  "openingHoursSpecification": [{ "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], "opens": "08:00", "closes": "22:00" }],
  "contactPoint": [
    { "@type": "ContactPoint", "contactType": "customer service", "telephone": "+66968461406", "availableLanguage": ["th","en"] },
    { "@type": "ContactPoint", "contactType": "customer service", "url": "https://lin.ee/SSqk98x", "availableLanguage": ["th"] },
    { "@type": "ContactPoint", "contactType": "customer service", "url": "https://api.whatsapp.com/send?phone=+66968461406", "availableLanguage": ["en"] }
  ],
  "sameAs": [
    "https://www.facebook.com/Detectivepluse.th",
    "https://fastwork.co/user/<profile>",
    "https://www.youtube.com/watch?v=-sYx6i8OBF0",
    "https://lin.ee/SSqk98x",
    "<Google Business Profile URL once live>"
  ],
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "63", "bestRating": "5", "worstRating": "1" },
  "hasOfferCatalog": {
    "@type": "OfferCatalog", "name": "บริการนักสืบ",
    "itemListElement": [
      { "@type": "Offer", "itemOffered": { "@type": "Service", "@id": "https://detectivepulse.com/นักสืบชู้สาว#service" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "@id": "https://detectivepulse.com/เช็คประวัติบุคคล#service" } }
    ]
  }
}
```

**B.2 Service (each service page)**

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://detectivepulse.com/นักสืบชู้สาว#service",
  "name": "นักสืบชู้สาว — สืบชู้ ติดตามพฤติกรรม เก็บหลักฐาน",
  "serviceType": "Infidelity investigation",
  "description": "ติดตามพฤติกรรมในที่สาธารณะอย่างถูกกฎหมาย หลักฐานภาพ/วิดีโอพร้อมไทม์ไลน์ รายงานเป็นลายลักษณ์อักษร",
  "provider": { "@id": "https://detectivepulse.com/#business" },
  "areaServed": { "@type": "Country", "name": "Thailand" },
  "availableChannel": { "@type": "ServiceChannel", "serviceUrl": "https://detectivepulse.com/ติดต่อนักสืบ", "availableLanguage": ["th","en"] },
  "offers": { "@type": "Offer", "priceCurrency": "THB", "price": "<starting price if published>", "priceSpecification": { "@type": "UnitPriceSpecification", "unitText": "per day" } },
  "inLanguage": "th",
  "url": "https://detectivepulse.com/นักสืบชู้สาว"
}
```

**B.3 FAQPage** — keep the existing pattern (visible Q&A + JSON-LD from the same array). Add per-service FAQ arrays. **B.4 BreadcrumbList** — existing; change the trail for service pages to Home › บริการ › Service. **B.5 Article/BlogPosting** — add `author` as `Person` (lead investigator) with `jobTitle` and `worksFor` → `#business`, real `dateModified`, `inLanguage`. **B.6 Person** — one `Person` entity for the lead investigator on the About page (`name` may be first name + initial; `knowsAbout`: private investigation, surveillance, OSINT, Thai family law evidence). **B.7 Review** — only where individual reviews are displayed with author and date (current homepage testimonials qualify; add `Review` objects referencing `itemReviewed: #business`). **B.8 Do not use:** `ProfessionalService` on article pages; `HowTo` (deprecated in Google results); `Event`; fake `Review` counts.

---

# APPENDIX C — Internal linking architecture and consolidation map

**C.1 Link map (target state)**

```
Home ─┬─► 6 TH service pages ─┬─► Pricing ─► Contact
      │                       ├─► How it works
      │                       ├─► Bangkok (location) ─► service pages
      │                       ├─► 2–3 case studies ─► same service
      │                       └─► 2–3 cluster articles ─► back to service (anchor = service keyword)
      ├─► About ─► Case studies, Careers
      ├─► Bangkok, Pattaya… ─► services, cases
      └─► Articles hub ─► articles ─► services
Nav: Services (dropdown) · Pricing · Bangkok · Case studies · About · Contact · Lang
Footer: all services · locations · articles · privacy · careers (TH/EN, as ZH already does)
```

**C.2 Exact contextual link opportunities (examples)**

| From | Anchor | To |
|---|---|---|
| `/นักสืบชู้สาว/` "ค่าใช้จ่าย" section | ราคานักสืบชู้สาว | `/ราคานักสืบ/` |
| `/นักสืบชู้สาว/` legal section | หลักฐานฟ้องชู้ที่ศาลรับฟัง | `/สิ่งที่ควรรู้ก่อนการจ้/` (rewritten) |
| `/จ้างนักสืบตามแฟน/` intro | นักสืบชู้สาว | `/นักสืบชู้สาว/` |
| `/เช็คประวัติบุคคล/` B2B paragraph | ตรวจสอบประวัติพนักงาน | `/ตรวจสอบประวัติพนักงาน/` |
| `/สืบตามหาคน/` debtor paragraph | สืบทรัพย์สินลูกหนี้ | `/สืบทรัพย์สิน/` |
| `/สืบทรัพย์สิน/` intro | ตามหาลูกหนี้ที่หลบหนี | `/สืบตามหาคน/` |
| every TH service page | นักสืบเอกชน กรุงเทพ | `/นักสืบกรุงเทพ/` |
| `/en/cheating-spouse-investigator` | Thai partner verification before you commit | `/en/thai-partner-verification` |
| `/en/thai-partner-verification` | romance scam investigation | `/en/romance-scam-investigation` |
| `/en/background-check` corporate paragraph | due diligence on a Thai company | `/en/due-diligence-thailand` |
| all `/en` service pages | how a remote case works | `/en/how-it-works` |
| all `/en` service pages | private investigator in Bangkok | `/en/private-investigator-bangkok` |
| ZH service pages (already) | English/Thai equivalents | reciprocal hreflang + lang switch (exists) |

**C.3 301 consolidation map (implement in `next.config.ts` redirects; update `EN_TO_TH`, sitemap and nav)**

| From | To |
|---|---|
| `/นักสืบคดีชู้สาว-รับสืบค/` | `/นักสืบชู้สาว/` |
| `/บริการตรวจสอบประวัติบุ/` | `/เช็คประวัติบุคคล/` |
| `/บริการสืบประวัติบุคคลด/` | `/สืบทรัพย์สิน/` |
| `/วิธีสืบทรัพย์ก่อนฟ้อง-เ/` | `/สืบทรัพย์สิน/` (or keep as rewritten article) |
| `/จ้างนักสืบตามหาคน/` | `/สืบตามหาคน/` |
| `/บริการสืบค้นข้อมูลไอที/`, `/บริการตรวจสอบการใช้โทร/` | `/นักสืบไอที/` |
| `/จ้างนักสืบ-ราคาถูก/`, `/วิธีการคิดราคาจ้างนักส/` | `/ราคานักสืบ/` |
| `/การหานักสืบเชี่ยวชาญ-คำ/` | `/จ้างนักสืบ/` |
| `/บริษัทนักสืบมืออาชีพที/`, `/บริการนักสืบชั้นนำเพื่/` | `/เกี่ยวกับเรา/` |
| `/en/private-investigator` | `/en` |
| `/en/catch-a-cheating-partner` | `/en/cheating-spouse-investigator` |
| `/en/personal-background-check-service` | `/en/background-check` |
| `/en/asset-background-check`, `/en/trace-assets-before-lawsuit` | `/en/asset-investigation` |
| `/en/trace-people-and-debtors` | `/en/find-missing-person` |
| `/en/social-media-investigation`, `/en/phone-usage-investigation` | `/en/cyber-investigation` |
| `/en/hire-a-detective-online`, `/en/how-to-find-a-good-detective` | `/en/hire-a-private-detective` |
| `/en/private-detective-pricing`, `/en/affordable-private-detective` | `/en/pricing` |
| `/en/trusted-detective-agency`, `/en/leading-detective-services`, `/en/detective-services-overview` | `/en/about` |
| `/en/investigate-partner-before-marriage` | `/en/thai-partner-verification` |

Before redirecting, check GSC for any of these URLs with meaningful impressions and move their unique sentences into the target page.

---

# APPENDIX D — Facts the owner must confirm before publication

Carried from `docs/china-market/16-facts-requiring-confirmation.md`, plus new items raised by this audit:

- Legal entity name and registration number; address usable for Google verification (can stay hidden).
- Which services are genuinely offered and by which lawful methods (confirm removal of bank/credit/immigration/phone-record claims).
- Any award that can be named and dated; otherwise remove the claim.
- Response-time commitment (e.g. within 1 hour, 08:00–22:00).
- Payment methods for overseas clients; receipt/invoice capability.
- Pricing bands the firm is willing to publish (per service or per day).
- Lead investigator's public first name/role; team size; languages spoken.
- Fastwork profile URL; permission to quote the six testimonials.
- Six anonymised cases for the first case-study batch.
- The single LINE OA URL to use everywhere.
