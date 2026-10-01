# 13 · B2B China Strategy

Separate motion from consumer marketing: different landing page (`/zh/business-due-diligence`), different CTA (structured intake first, NDA, written proposal), different content (DBD, EEC, supplier verification), and a partner database instead of SEO alone.

## Target partner types & what to offer
| Partner | Why they refer | Offer |
|---|---|---|
| Chinese law firms (with Thai desks) | need facts for litigation, asset tracing, family law | Litigation support (lawful), asset lead reports, service-of-process address confirmation; white-label report format |
| Chinese companies operating in Thailand | hiring, suppliers, counterparties | Employee background verification, supplier/counterparty verification, annual re-verification |
| Thailand-based Chinese business consultants / incorporation agents | clients ask "is this partner real?" | Referral fee or reciprocal referral; co-branded due-diligence checklist |
| Accounting firms | audit evidence of physical existence | On-site verification add-on to audits |
| Corporate advisory / M&A | pre-deal DD | Management background + site verification module |
| Relocation companies | clients verify schools, landlords, agents | Background + on-site verification bundle |
| Investment consultants (property, EEC) | buyers want independent eyes | Independent site verification report (buyer-paid) |
| Risk consultancies (international) | need a Thai field partner | Subcontracted field verification, SLA-based |
| Chinese-speaking lawyers in Thailand | direct referrals | Priority turnaround, shared case manager |

## Services to position (B2B wording)
Business Due Diligence · Company Verification · On-Site Verification · Counterparty Verification · Supplier Verification · Asset Investigation (lawful) · Litigation Support (lawful) — each with a one-page Chinese service sheet (PDF, Phase 3).

## Outreach plan (Phase 3, days 31–60)
1. Build a partner database (Supabase table `marketing_partners` or a sheet first — backlog B-1): name, type, city, language, contact, referral terms, status.
2. Seed list: 50 Chinese-speaking law firms/consultants in Bangkok, 30 in Chonburi/Rayong (EEC), 20 in Phuket/Chiang Mai. Sources: public directories, chamber lists, LinkedIn/WeChat groups (manual, no scraping of personal data).
3. Outreach sequence: WeChat/email intro with the downloadable Chinese company profile → sample redacted report → 20-min call → referral agreement.
4. Partner landing page `/zh/partners` (Phase 3) with the B2B service matrix, SLA, NDA statement and a partner intake.
5. Track partner-originated leads with `source=partner` + `utm_source=<partner-slug>` links.

## Commercial terms (requires confirmation)
Referral fee % / reciprocal referral / volume pricing / NDA template / invoicing entity — none exist in the repo; owner to decide before outreach.

## Keep separate from consumer marketing
- No B2B content on relationship pages and vice-versa; B2B emails never mention 婚外情.
- Separate GTM audience: `service ∈ {due_diligence, on_site}`.
- Separate email signature and a dedicated WeChat account for B2B is recommended (requires confirmation).

---

## Implementation (Phase 3, shipped)

- **Landing page** `/zh/partners` — partner types, B2B service list, three cooperation models (转介 / 分包 / 白标), process, FAQ, application form.
- **Partner database** `marketing_partners` (migration 0126): org, type, contact (WeChat/email/phone), city/country, services wanted, expected volume, stage (`new → contacted → call_scheduled → agreement → active → inactive`), notes, and a unique **referral slug**.
- **Attribution**: each partner's referral link is `https://detectivepulse.com/zh?utm_source=<referral_slug>&utm_medium=referral`; the intake form stores `utm_source` on every lead, so `/partners` shows leads and paid cases per partner and `/marketing-insights` shows revenue by source.
- **Admin** `/partners`: stage/notes editor (audited), copy-referral-link button, lead counts.

## Outreach sequence (templates — adapt, never mass-send; respect platform rules)

**Step 1 · WeChat / email intro (zh)**

> 您好，我是泰国 Detective Pulse 的 [姓名]。我们是一支常驻曼谷的调查与核实团队，自 2016 年起为海外客户提供商业尽职调查、公司与实地核实、资产调查与诉讼支持，报告中英文交付。
> 我们正在与服务中国客户的律所 / 顾问机构建立合作：转介、分包或白标报告三种方式均可。
> 如果方便，我可以发一份已脱敏的示例报告，并安排 20 分钟通话了解贵所客户的常见需求。合作计划详情：https://detectivepulse.com/zh/partners

**Step 2 · after reply — send**: redacted sample report (C-3) + `/zh/company-profile` PDF + NDA template (L-2).

**Step 3 · 20-min call agenda**: their client types → our scope and limits (what we refuse) → turnaround and pricing model → cooperation model → referral link.

**Step 4 · follow-up (zh, +7 days, once)**

> [姓名]您好，上周提到的合作资料不知是否已收到？如贵所近期有泰国公司或合作方需要核实，我们可以先做一次小范围核实作为试用，费用按项目计。

**Step 5 · agreement**: move to `agreement` in `/partners`, send the referral link, set a 30-day check-in.

## Seed-list sourcing (manual, no scraping of personal data)
Public law-firm directories (Thai Bar / Lawyers Council listings with Chinese desks), chamber of commerce member lists (Thai-Chinese Chamber, EEC industrial-estate tenant lists), LinkedIn company pages, exhibition exhibitor lists. Record only business contact details, with the source noted in `admin_notes`.
