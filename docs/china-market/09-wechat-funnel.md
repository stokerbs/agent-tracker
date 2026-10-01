# 09 · WeChat Funnel Design

## Why WeChat first
Chinese consumers do not fill forms before trust is established; a 1:1 WeChat conversation is the trust step. WeChat has no reliable web deep link to add a contact, so the conversion mechanic is **scan the QR or copy the ID** — both instrumented.

## Component
`WeChatCta` (`src/components/marketing/zh/wechat-cta.tsx`) — button → dialog with QR (`NEXT_PUBLIC_WECHAT_QR`, default `/marketing/btn-wechat.jpg`), WeChat ID (`NEXT_PUBLIC_WECHAT_ID`, default `DetectivePulse`), copy button, fallback links (email, intake). Events: `wechat_cta_click {placement, page, service}`, `wechat_id_copied {page}`.

## Placements (all /zh only)
| Placement key | Where | Variant |
|---|---|---|
| `header` | Chinese header nav (≥ sm) | compact |
| `hero` | Under-hero strip on home; hero CTA row on every registry page | primary (consumer pages) / secondary (B2B pages) |
| `service` | CTA band at the bottom of every service/info/location page | primary |
| `case_study` | CTA band on /zh/case-studies | primary |
| `contact` | /zh homepage contact section | primary |
| `sticky` | Mobile sticky bar on /zh/* (replaces LINE/phone) | full-width |
| `intake_success` | Success state of the intake form (with the Case Lead ID) | primary |

Secondary CTA everywhere: **提交案件资料** → `/zh/contact#intake`.

## Conversation playbook (for the Chinese-speaking account owner — requires staffing confirmation)
1. Greeting template within 1 business hour (Thai time), ask for the Case Lead ID if they have one.
2. Qualify with 5 questions mirroring the intake: 目标地点 · 调查类型 · 已知信息 · 目标 · 预算范围/时间.
3. Record the lead in `/leads` (stage → `contacted` → `qualified`), link the WeChat ID.
4. Send written quotation by email (PDF) + WeChat summary → stage `quotation_sent`.
5. Payment instructions (requires confirmation: which rails DP accepts for CNY/USD — bank transfer, Alipay/WeChat Pay via a Thai acquirer, Wise etc.) → `payment_pending` → `paid`.
6. Case onboarding: create the case in the ops app; share the reporting cadence.

## Platform-rule compliance
- The QR/ID appears only on detectivepulse.com, email signatures and printed/PDF materials.
- **Do not** place the WeChat QR or external contact details inside Xiaohongshu, Douyin, Zhihu or Baidu properties where external diversion is prohibited; link to the website only where links are allowed.
- No paid promotion of the WeChat account on platforms that prohibit investigation advertising.
- WeChat Official Account (服务号) is a Phase 3 consideration: it needs a verified entity; a Thai company can register via overseas verification — mark as requiring confirmation of eligibility and cost.
