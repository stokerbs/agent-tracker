# 10 · Lead Qualification Form (提交案件资料)

Live at `/zh/contact#intake`. Component `ZhIntakeForm`; contract `src/lib/marketing/zh/intake-schema.ts`; API `POST /api/marketing/zh-intake` (multipart).

| Field | Name | Type | Required | Stored as |
|---|---|---|---|---|
| 姓名或昵称 | `name` | text ≤ 80 | ✓ | `marketing_leads.name` |
| 微信号 | `wechatId` | text 2–60 | ✓ | `wechat_id` |
| 邮箱 | `email` | email ≤ 120 | – | `email` |
| 您所在的国家/地区 | `country` | text 2–60 | ✓ | `country` |
| 泰国目标地点 | `targetLocation` | enum bangkok · pattaya · phuket · chiang-mai · samui · hua-hin · chonburi · other · unknown | ✓ | `target_location` |
| 调查类型 | `service` | enum relationship · find_person · background · due_diligence · on_site · asset · other | ✓ | `service` (+ legacy `case_type`) |
| 已知信息 | `knownInfo` | textarea 10–3000 | ✓ | `known_info` |
| 您希望达到的目标 | `objective` | textarea 5–1500 | ✓ | `objective` (+ legacy `message`) |
| 希望开始日期 | `preferredStart` | date | – | `preferred_start` |
| 预计所需时长 | `estimatedDuration` | enum 1-3_days · 4-7_days · 1-2_weeks · 2-4_weeks · over_1_month · unknown | ✓ | `estimated_duration` |
| 紧急程度 | `urgency` | enum normal · urgent · critical | ✓ | `urgency` |
| 预算范围 (THB) | `budgetRange` | enum under_20k · 20k-50k · 50k-100k · 100k-300k · over_300k · undecided | ✓ | `budget_range` |
| 支持文件 | `files` | ≤ 5 × 10 MB, jpg/png/webp/pdf | – | bucket `lead-files` + `marketing_lead_files` |
| 同意隐私政策 | `consent` | literal `true` | ✓ | `consent_at` |
| (hidden) attribution | `landingPage` `referrer` `utmSource` `utmMedium` `utmCampaign` `utmTerm` | ≤ 300 | – | same-named columns |
| (hidden) honeypot | `website` | – | – | not stored; silent success |

**Server behaviour:** rate-limit `zh_intake` (3/h/IP) → zod validation → honeypot → file validation (count/type/size) → insert with `lead_ref` (`CN-YYMMDD-XXXX`, retry on collision) → upload files → notify admins (in-app + push + LINE) → `{ ok, leadRef }`.

**Client states:** idle · sending (disabled + spinner) · error (inline, form preserved; rate-limit / invalid / file / network messages) · success (Case Lead ID + WeChat CTA). Empty state is the blank form with placeholder guidance; the placeholder explicitly asks users **not** to paste third-party ID or bank numbers.

**Privacy copy:** 我已阅读并同意隐私政策，同意贵公司存储并使用以上信息以评估并联系我。我确认所提供的信息仅用于合法目的。 — the Chinese privacy policy page itself **requires legal drafting** (backlog L-1).
