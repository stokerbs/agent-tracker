# 12 · Analytics Event Specification

Transport: GTM `dataLayer` via `track()` (`src/lib/marketing/analytics.ts`), marketing host only, deferred load. GA4 tags are configured **inside GTM** (no code change): create one GA4 event tag per `event` below, mapping parameters to custom dimensions. Never send names, WeChat IDs, emails or free text.

| Event | Parameters | Fired from | Funnel step |
|---|---|---|---|
| `zh_page_view` | `page`, `service` (general/relationship/find_person/background/due_diligence/on_site/asset), `kind` (home/service/info/location) | every /zh page (`ZhPageView`) | VISITOR |
| `wechat_cta_click` | `placement` (header/hero/service/case_study/contact/sticky/footer/intake_success), `page`, `service` | `WeChatCta` open | CONTACT (intent) |
| `wechat_id_copied` | `page` | copy button | CONTACT (strong intent) |
| `contact_click` | `channel` (line/whatsapp/email/phone), `page` | contact links | CONTACT |
| `zh_intake_start` | `page`, `service` | first focus in the intake form | — |
| `zh_intake_submitted` | `service`, `country`, `budget_range`, `urgency`, `lead_ref`, `page` | success response | CONTACT (hard) |
| `zh_intake_error` | `reason` (rate_limited/invalid_input/file_rejected/server_error/network), `page` | failure | — |
| `lead_submitted` (existing) | `case_type`, `locale` | simple lead form | CONTACT |

GA4 configuration (GTM):
- Mark `zh_intake_submitted` and `wechat_id_copied` as **conversions**.
- Custom dimensions: `service`, `placement`, `country`, `budget_range`, `urgency`, `kind`, `channel`, `reason`.
- Country of the visitor comes from GA4 geo (no code). Source/medium from GA4 session attribution; the per-lead copy is stored on the lead row (`landing_page`, `utm_*`).

## Funnel definitions
```
VISITOR         sessions with zh_page_view
CONTACT         sessions with wechat_id_copied OR zh_intake_submitted OR contact_click
QUALIFIED LEAD  marketing_leads.stage ∈ QUALIFIED_STAGES          (DB)
QUOTE           marketing_leads.stage ∈ QUOTED_STAGES             (DB)
PAID CASE       marketing_leads.converted_at IS NOT NULL          (DB)
```
GA4 counts the first two steps; the rest come from the DB (`/marketing-insights`). Join key: `lead_ref` (in the GA4 event and on the row).

## Primary metrics (weekly)
- Qualified Leads (count, by service, by country)
- Cost per Qualified Lead — n/a while organic only; = 0 + content cost
- Lead→Quote rate = quoted / qualified
- Quote→Payment rate = paid / quoted
- Revenue per Lead = Σ final_revenue / leads
- Average Case Value = Σ final_revenue / paid
- Revenue by Acquisition Source = Σ final_revenue grouped by `source` / `utm_source`

Explicitly **not** a KPI: page views.
