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
