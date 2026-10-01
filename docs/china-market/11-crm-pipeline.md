# 11 · CRM Pipeline

Implemented on `marketing_leads.stage` (migration 0124), edited from `/leads` (admin) via `updateLeadPipeline` (server action, audited).

```
NEW CHINESE LEAD → CONTACTED → QUALIFIED → REQUIREMENTS RECEIVED → QUOTATION SENT → FOLLOW-UP
→ PAYMENT PENDING → PAID → CASE CREATED → INVESTIGATION ACTIVE → REPORT DELIVERED → CLOSED → FOLLOW-UP / REFERRAL
```

| Stage key | Entry criterion | Exit action | SLA |
|---|---|---|---|
| `new` | intake submitted or WeChat first message logged | reply | 24 h |
| `contacted` | first reply sent | qualification questions answered | 48 h |
| `qualified` | service/location/budget/legality confirmed; lawful scope | request detailed requirements | 2 d |
| `requirements_received` | enough detail to scope | write quotation | 2 d |
| `quotation_sent` | written quote delivered (set `quoted_value`) | follow up | 3 d |
| `follow_up` | no answer after quote | 2 touches max | 7 d |
| `payment_pending` | client accepted, awaiting deposit | confirm payment | 5 d |
| `paid` | deposit received (`converted_at` auto-set) | create case | 1 d |
| `case_created` | case exists in ops app | start investigation | – |
| `investigation_active` | fieldwork running | deliver report | per quote |
| `report_delivered` | report sent, balance paid (set `final_revenue`) | close | – |
| `closed` | done | referral touch at +30 d | – |
| `referral` | post-case follow-up / referral request | – | – |

Legacy `status` is derived automatically: `new` → new; `closed`/`referral` → closed; everything else → contacted (keeps the weekly digest and old views valid).

## Tracked attributes
| Attribute | Column | Source |
|---|---|---|
| source | `source` (`website` / `assistant` / `zh_intake` / set manually `wechat`, `referral`, `partner`) | API / admin |
| landing page | `landing_page` | form attribution (first page in session) |
| keyword where available | `utm_term` (+ GSC for organic, not per-lead) | URL params |
| country | `country` | form |
| service | `service` | form |
| estimated value | `estimated_value` | admin |
| quoted value | `quoted_value` | admin at `quotation_sent` |
| final revenue | `final_revenue` | admin at `report_delivered`/`closed` |
| conversion date | `converted_at` | auto on first paid stage |

## Reporting (Phase 2, backlog A-3)
Extend `/marketing-insights` with: leads by stage, lead→quote rate, quote→paid rate, revenue per lead, average case value, revenue by source — all computed from these columns with `funnelStep()` in `pipeline.ts`. WeChat-originated leads must be entered manually by the account owner (source `wechat`) so the funnel is complete.
