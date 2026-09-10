# Detective Pulse — AI Creative Studio V1

> Internal AI-powered content operating system for Detective Pulse.
> Principle: **REAL EXPERIENCE → INSIGHT → CONTENT → APPROVAL → PUBLISH → LEARN**
> The AI never invents investigation cases and presents them as real.

Status legend: ✅ done · 🟡 partial / honest-stub · ⬜ not started · 🚫 out of V1 scope (architecture-ready)

---

## 1. Existing architecture assessment (2026-09-09)

The repo is the **Detective Pulse Operations Command Center** (Next.js 15 App Router, TS strict, Tailwind + shadcn/ui new-york, Supabase Postgres/Auth/Storage, next-intl th/en, Sentry, vitest). 108 migrations applied on the linked prod project. Findings that shape the Studio:

| Area | What exists | Reuse decision |
|---|---|---|
| Auth / RBAC | `profiles.role` ∈ admin/supervisor/agent/client; `requireRole()`, `requireStaff()`; SQL helpers `is_admin()`, `is_staff()`, `can_access_case()` | Studio is **admin-only in V1** (owner tool). Reuse `requireRole(["admin"])` + `is_admin()` policies. |
| Layout | `(dashboard)/layout.tsx` with `SidebarNav` driven by `nav-config.ts` (role-filtered sections, i18n keys in `messages/{th,en}.json`) | Add a **"Creative Studio"** nav section. No separate app shell — one login, one sidebar. |
| Server actions | `"use server"` files per concern; zod parse → role check → RLS client read → service client write → `logAudit()` → `revalidatePath` | Follow exactly. |
| AI | Raw `fetch` to Anthropic in `lib/marketing/article-gen.ts` and `lib/ai/case-intake.ts`; `ai_prompts` table + admin editor (`getAiPromptText`) | New Studio AI layer uses the official `@anthropic-ai/sdk` behind a **provider abstraction** (`lib/studio/ai/provider.ts`). Existing modules untouched. |
| Marketing | `marketing_articles` (cron-drafted SEO articles, LINE approve link), `lib/marketing/faq.ts` (real FAQ), `KEYWORD_TOPICS` (real Google Ads / GSC demand), `marketing_leads` | These are **real company knowledge** → seeded into the Knowledge Base as `approved_for_content` sources. Article pipeline stays as-is. |
| Cases | `cases` table holds encrypted target PII (`*_enc`, `*_bidx`) | Studio **never** reads ops `cases` PII. `studio_cases` is a separate, hand-anonymized knowledge record with an optional `linked_case_id` pointer only. |
| DB conventions | uuid PKs, `created_at/updated_at`, `set_updated_at()` trigger, `log_audit()` trigger for sensitive tables, `pg_trgm` enabled, RLS everywhere, migrations `NNNN_name.sql` | Follow. Add `vector` extension (pgvector) with nullable embedding columns — no embeddings are generated in V1. |
| UI kit | shadcn: button, card, badge, dialog, sheet, tabs, select, table, skeleton, command, textarea, input, dropdown | Added: switch, tooltip, popover, checkbox, progress. |
| Shared | `PageHeader`, `EmptyState`, `ErrorState`, `StatCard`, `FadeUp`, `RichTextEditor`, `GlobalSearch` (⌘K) | Reuse; extend GlobalSearch with Studio groups. |
| Tests | vitest, `*.test.ts` co-located, Supabase mocked via `vi.mock("@/lib/supabase/server")` | Follow. |

Nothing in the existing app is overwritten. The Studio is additive: new tables (`studio_*`), new routes (`/studio/*`), new lib (`lib/studio/*`), new nav section.

---

## 2. Proposed architecture

```
Browser (admin)
  └─ /studio/*  (Server Components + small Client islands)
       ├─ server actions  (zod → requireRole(admin) → RLS client → service client → logAudit)
       └─ lib/studio/ai/* (server-only)
             ├─ provider.ts        AiProvider interface (anthropic implemented; openai = honest "not configured")
             ├─ anthropic.ts       @anthropic-ai/sdk, structured outputs via zodOutputFormat
             ├─ prompts/*.ts       brand · thai-style · ideas · campaign · script · case-story · privacy · repurpose · creative-plan · knowledge-extraction · rewrite · fact-check
             ├─ actions/*.ts       generateIdeas, generateCampaign, generateHooks, generateScript, rewriteContent, repurposeContent, generateCTA, generateCreativePlan, extractCaseInsights, extractCustomerFAQs, runPrivacyCheck, recommendContentMix
             ├─ knowledge/search.ts  keyword search (pg_trgm/ilike + tags) — pgvector seam
             ├─ privacy/scrub.ts   deterministic PII detector (phones, plates, emails, LINE ids, addresses, names from a deny-list)
             └─ generation-log.ts  studio_ai_generations (ids only, never raw case PII)
Supabase Postgres (RLS: admin-only)  ·  Storage bucket `studio-assets` (foundation)
```

Key decisions
- **Admin-only V1.** RLS = `is_admin()` on every `studio_*` table. Supervisors/agents see nothing. Revisit when a content team exists.
- **One Content Master, many Variants.** Platform copies hang off a master; the calendar shows masters (with platform chips) by `scheduled_at`.
- **Sources are first-class rows** (`studio_content_sources`) pointing at knowledge / case-insight / customer-question / external / `ai_general`. The UI answers "AI เอาข้อมูลนี้มาจากไหน?" in one click.
- **Privacy gate before approval.** Deterministic scrub always runs at decision time; AI review adds nuance. Gate rule (`lib/studio/privacy/gate.ts`, shared by server and editor UI) = worst of (fresh scan, latest AI/human verdict). `approve` is refused while `blocked`; `review_required` needs an explicit human override recorded in `studio_content_reviews` (auto-recorded when `require_privacy_safe` is off). Text edits after approval demote the piece back to draft (`STUDIO_CONTENT_REOPEN`); schedule/publish re-scan and refuse `blocked`.
- **Minimum-context generation.** Only `approved_for_content` knowledge and `studio_case_insights` (already anonymized) reach prompts; never `studio_cases.situation/observations` raw and never ops `cases`.
- **No fake integrations.** Publishing, social APIs, video/image generation are 🚫 in V1 — the UI says so; the schema has the hooks (`published_url`, `studio_creative_assets`, `studio_analytics.source`).

---

## 3. Information architecture (routes)

| Route | Page | Purpose |
|---|---|---|
| `/studio` | Studio Dashboard | "What should Detective Pulse publish next?" — Creative Director input, pipeline counts, AI recommended ideas, upcoming content, content mix + imbalance flag |
| `/studio/director` | Creative Director | Brief → campaign proposal (ideas ranked) → refine (more / replace / tone) → **Create Campaign** → ideas land in Idea Bank |
| `/studio/ideas` | Idea Bank | Filters by pillar/status/platform; save / reject / archive / duplicate / **Generate content** |
| `/studio/content` | Content list | Status board + table; open editor |
| `/studio/content/[id]` | Content Editor | Left: hook/script/caption/CTA + variants + creative plan. Right: Sources · Pillar · Privacy check · Fact claims · AI actions |
| `/studio/calendar` | Calendar | Month/week; drag-drop reschedule; filters; click card → editor |
| `/studio/knowledge` (+`/[id]`, `/new`) | Knowledge Base | Categories, sensitivity, **Approved for AI Content** toggle, customer questions tab |
| `/studio/cases` (+`/[id]`, `/new`) | Case Insights | Anonymized case records → AI extract insights → approve insights for content |
| `/studio/analytics` | Analytics (V1 foundation) | Manual metric entry per published content; pillar/platform rollups |
| `/studio/settings` | Studio Settings | Brand voice, default platforms, pillars, AI provider/model, privacy rules, approval rules, demo-data loader, future social connections (labelled not connected) |

Sidebar section **Creative Studio**: Studio · Creative Director · Idea Bank · Content · Calendar · Knowledge · Case Insights · Analytics · Studio Settings (admin only).

---

## 4. Database schema (migration `0109_creative_studio.sql`)

All tables: `uuid` PK `gen_random_uuid()`, `created_at`, `updated_at` (+`set_updated_at` trigger), RLS enabled, policy `is_admin()` for all ops, `created_by → profiles`.

| Table | Purpose | Notable columns |
|---|---|---|
| `studio_settings` | singleton (id = fixed uuid) | `brand_voice jsonb`, `default_platforms text[]`, `pillars jsonb`, `ai_provider`, `ai_model`, `privacy_rules jsonb`, `approval_rules jsonb` |
| `studio_knowledge_sources` | knowledge records | `title, content, source_type, category, tags text[], sensitivity (public/internal/confidential/restricted), approved_for_content bool, origin_ref text, is_demo` |
| `studio_knowledge_chunks` | RAG-ready chunks | `source_id, chunk_index, content, embedding vector(1536) NULL, token_count` |
| `studio_cases` | anonymized case knowledge (NOT ops cases) | `case_code (DEMO-001…), case_type, situation, objective, method, observations, outcome, lessons, interesting_insight, content_potential (low/medium/high), sensitivity, anonymized_version, approved_for_content, linked_case_id → cases NULL, is_demo` |
| `studio_case_insights` | content-safe extracted insights | `case_id, title, insight, lesson, content_angle, privacy_status, approved_for_content, generated_by (ai/human)` |
| `studio_customer_questions` | FAQ mining | `question, answer_hint, frequency int, source (line_oa/phone/web/manual/import), tags, approved_for_content, is_demo, normalized_key, last_seen_at` |
| `studio_line_inbox` (0113) | redacted LINE OA messages queued for mining | `sender_hash (HMAC of LINE userId), text_redacted, received_at, processed_at, batch_id → studio_ai_generations`; purged 30 days after processing |
| `studio_campaigns` | Creative Director briefs | `title, objective, audience, platforms text[], pillar, tone, post_count, cta, brief jsonb, status (proposed/active/completed/archived)` |
| `studio_ideas` | Idea Bank | `title, hook, pillar, platforms text[], format, origin (ai/owner/knowledge/case/question/repurpose), source_refs jsonb, ai_scores jsonb (labelled estimates), status (new/saved/rejected/generated/archived), tags, campaign_id` |
| `studio_content_masters` | one per piece | `idea_id, campaign_id, title, pillar, status (idea/draft/review/approved/scheduled/published/archived/rejected), hook, script, caption, cta, target_duration_sec, estimated_duration_sec, primary_platform, creative_plan jsonb, notes, scheduled_at, published_at, published_url, approved_by, approved_at` |
| `studio_content_variants` | per-platform copy | `master_id, platform, format, hook, script, caption, cta, creative_plan jsonb, char_count` |
| `studio_content_sources` | traceability | `master_id, source_kind (knowledge/case_insight/customer_question/external/ai_general), source_id uuid NULL, label, note` |
| `studio_content_claims` | fact check | `master_id, claim, support_status (supported/partially_supported/ai_suggestion/needs_review/unsupported), source_kind, source_id, note, reviewed_by, reviewed_at` |
| `studio_privacy_checks` | gate | `master_id, status (safe/review_required/blocked), findings jsonb, checked_by (deterministic/ai/human), model` |
| `studio_content_reviews` | approvals | `master_id, reviewer_id, decision (approve/reject/request_changes/override_privacy), note` |
| `studio_creative_assets` | foundation | `master_id, kind (thumbnail/broll/image/video/audio/other), storage_path, meta jsonb` |
| `studio_analytics` | manual metrics | `master_id, variant_id NULL, platform, recorded_at, views, reach, likes, comments, shares, saves, avg_watch_sec, completion_rate, profile_visits, dms, leads, qualified_leads, conversions, source (manual/import/api)` |
| `studio_ai_generations` | history | `purpose, provider, model, input_refs jsonb (ids only), output jsonb, input_tokens, output_tokens, duration_ms, status, error, user_id` |

Indexes: status/pillar/scheduled_at on masters; GIN on `tags`; trigram GIN on `title`/`content` for search; FK indexes. Audit trigger on `studio_cases`, `studio_case_insights`, `studio_knowledge_sources`, `studio_content_masters`, `studio_settings`.

Relationship: `campaign 1─* idea 1─* master 1─* variant`, `master 1─* sources/claims/privacy_checks/reviews/assets/analytics`, `knowledge 1─* chunks`, `case 1─* insights`.

---

## 5. Page & component structure

```
src/app/(dashboard)/studio/
  layout.tsx                 (admin gate + studio sub-header)
  loading.tsx  error.tsx
  page.tsx                   dashboard
  director/  page.tsx actions.ts director-panel.tsx
  ideas/     page.tsx actions.ts idea-card.tsx idea-filters.tsx
  content/   page.tsx actions.ts  [id]/page.tsx [id]/editor.tsx [id]/right-panel.tsx [id]/ai-actions.ts
  calendar/  page.tsx actions.ts calendar-board.tsx
  knowledge/ page.tsx actions.ts [id]/page.tsx new/page.tsx knowledge-form.tsx
  cases/     page.tsx actions.ts [id]/page.tsx new/page.tsx case-form.tsx
  analytics/ page.tsx actions.ts metrics-form.tsx
  settings/  page.tsx actions.ts settings-form.tsx
src/components/studio/      shared studio UI: pillar-badge, status-badge, platform-chip, source-list, privacy-badge, score-badge, duration-estimate
src/lib/studio/             types.ts constants.ts queries.ts duration.ts seed.ts + ai/* privacy/* knowledge/*
```

---

## 6. AI architecture

- Provider abstraction: `getAiProvider()` → `{ generateStructured(schema, system, user, opts) }`. Anthropic implementation via `client.messages.parse` + `zodOutputFormat`. Model from `studio_settings.ai_model` → env `STUDIO_AI_MODEL` → `claude-opus-5`.
- Prompt modules compose: `brand` + `thai-style` (always) + task prompt. Knowledge context is appended as numbered `[K1]…` blocks so the model cites ids → become `studio_content_sources`.
- Every call logs to `studio_ai_generations` (refs + output, never raw case text). Failures are stored with `status='error'` and surfaced in the UI.
- Fact claims: the script generator returns `claims[]` with `source_ref` (K-id or `ai_general`) → mapped to `support_status` (`supported` if K-id resolves, else `ai_suggestion`).
- Privacy: `runPrivacyCheck` = deterministic scrub findings ∪ AI findings → status. Deterministic covers Thai/intl phone, email, plate (กข 1234 / 1กข 1234), LINE ids, URLs, house-number+ซอย/ถนน patterns, ID-card numbers, explicit dates, and names from `studio_settings.privacy_rules.denylist`.

---

## 7. Privacy architecture

```
RAW OPS CASE (cases.*_enc)  ──never read──╳
STUDIO CASE (studio_cases, hand-written, sensitivity, optional linked_case_id)
   └─ extractCaseInsights()  → STUDIO CASE INSIGHT (anonymized, approved_for_content gate)
         └─ content generation uses ONLY approved insights + approved knowledge
               └─ runPrivacyCheck() → safe | review_required | blocked
                     └─ approve blocked unless safe / human override recorded
```

---

## 8. Implementation phases & progress

| Phase | Scope | Status |
|---|---|---|
| 1 | Plan doc, migration 0109 (applied to prod 2026-09-09), types, nav section, `/studio` shell, i18n, GlobalSearch groups | ✅ |
| 2 | Knowledge Base CRUD, Case Insights CRUD (+ AI extract, privacy gating), customer questions (+ paste-import mining), seed loader in Settings | ✅ |
| 3 | AI provider layer + prompts + 12 AI functions (live smoke-tested with claude-opus-5), Idea Bank, Creative Director (propose → refine → create campaign) | ✅ |
| 4 | Content Master + two-pane Editor (autosave) + platform variants (repurpose) + creative plan (shot list) | ✅ |
| 5 | Privacy check (deterministic + AI), source traceability, fact claims with support status | ✅ |
| 6 | Calendar (month/week, HTML5 drag-drop, Asia/Bangkok) + approval workflow with privacy/claim gates | ✅ |
| 7 | Responsive layouts, loading/empty/error/AI-unavailable states, seed data | ✅ (code-reviewed; owner browser pass still recommended — see §10) |
| 8 | 922 unit tests green, tsc/eslint clean, `next build` passes, CI green. Security gate PASS (H1 stale check, M1, M2, L1–L6 + post-approval reopen all fixed). QA: three rounds — timeout flake, stale gate, retry bypass, UI/server gate-rule mismatch all fixed; final confirmation recorded on PR #237 | ✅ pending final QA stamp |

### Honest limitations in V1
- 🚫 No social publishing / OAuth — "Publish" = mark as published + optional URL.
- 🚫 No video/image/voice generation — creative plan is text (shot list, B-roll, overlays, thumbnail concept).
- 🚫 No embeddings — `embedding` columns exist but stay NULL; search is keyword (trigram).
- 🟡 LINE OA import — inbound messages from non-agent senders are captured PII-redacted (`studio_line_inbox`, migration 0113) and mined weekly (`/api/cron/studio-faq-mine`, Mon 01:30 Bangkok) or on demand into `studio_customer_questions` (unapproved until the owner reviews). Paste-import still available.
  - Data-protection notes for the inbox: text is pseudonymous personal data (HMAC sender under a purpose-specific subkey; redaction is best-effort, Thai digits normalised, owner denylist applied, per-sender 20 msgs/hour cap); processed rows purge after 30 days and ANY row after 90 days; mined output is re-scrubbed and dropped if it still carries an identifier; Anthropic acts as processor for the redacted batch. Owner decision 2026-09-10: the field-agent LINE bot now replies to unlinked senders ONLY when the text is a bot command / help request; plain customer messages and media get no bot reply (humans answer in the OA chat) and are captured for mining.
- 🟡 Analytics = manual entry.
- 🟡 OpenAI provider = interface present, throws "not configured" (no fake success).

---

## 9. Developer conventions (read before touching `/studio`)

- **Routes** live in `src/app/(dashboard)/studio/<module>/`. Route-specific components sit next to `page.tsx`. Shared studio UI lives in `src/components/studio/` (badges, source list, AI banner) — reuse, don't fork.
- **Auth.** Pages: `await requireRole(["admin"])` (layout already does this, pages may still call it). Server actions: `const profile = await requireStudioAdmin()` (throws) or `getStudioAdmin()` (returns null → `{ ok:false, error }`).
- **Data access.** Use the RLS client `createClient()` from `@/lib/supabase/server` for reads and writes — the admin role has full access via `is_admin()` policies. The service client is reserved for the AI layer / seed (server-only modules) — never in `"use server"` files.
- **Server actions** return `ActionResult<T>` (`{ ok:true, data } | { ok:false, error }`), validate input with zod, `logAudit()` sensitive mutations (approve/publish/privacy override/settings/knowledge approval), then `revalidatePath()`.
- **AI** is only called through `@/lib/studio/ai` (`generateScript`, `runPrivacyCheck`, …). Check `isAiAvailable()` in pages and render `<AiUnavailableBanner />` + disabled buttons when false. Show `RunResult.error` to the user; never swallow.
- **Approval gate.** `approve` must refuse when the latest `studio_privacy_checks.status === "blocked"`; `review_required` needs `approval_rules.allow_override` + a `studio_content_reviews` row with `decision = "override_privacy"`. If no privacy check exists yet, run the deterministic check first.
- **Copy** is Thai-first, hardcoded in components (matching `marketing-articles`), English technical terms allowed. Dates via `formatDate()` (en-GB), times `HH:mm` Asia/Bangkok.
- **States.** Every page: loading (`loading.tsx` or Skeleton), empty (`EmptyState`), error (`error.tsx`), AI-unavailable, privacy-review-required where relevant.
- **Tests.** Co-locate `*.test.ts` for pure helpers and for server actions (mock `@/lib/supabase/server` + `@/lib/studio/auth`, see `settings/security-actions.test.ts` for the pattern).
- **Do not edit** `src/lib/studio/types.ts`, `constants.ts`, `components/studio/badges.tsx`, `nav-config.ts`, `messages/*.json` without coordinating — other modules depend on them.

---

## 10. How to try it (owner checklist)

1. Deploy the branch (or run `npm run dev`) — migrations 0109 + 0110 are already applied on the linked Supabase project; `ANTHROPIC_API_KEY` must be set (Vercel already has it). Optional: `STUDIO_AI_MODEL`.
2. Log in as admin → sidebar section **ครีเอทีฟสตูดิโอ**.
3. `/studio/settings` → **โหลดข้อมูลตัวอย่าง (DEMO)** — inserts the real public FAQ as knowledge, DEMO-001…006 cases with insights, 8 customer questions, 5 ideas, 3 content pieces (one scheduled next Monday 19:00, one draft, one published with sample metrics). Remove with **ลบข้อมูลตัวอย่าง**.
4. `/studio` → type "อาทิตย์หน้าขอ 5 คลิปเรื่องนอกใจ TikTok กับ IG" → Creative Director proposes a campaign (20–60 s, Claude Opus 5) → tick ideas → **สร้างแคมเปญ**.
5. `/studio/ideas` → **สร้างคอนเทนต์** on an idea → lands in the editor with script/caption/CTA/claims/sources and a deterministic privacy check.
6. Editor → AI actions (rewrite/hooks/CTA/variants/creative plan), **ตรวจด้วย AI**, then **ส่งตรวจ → อนุมัติ** (refused while BLOCKED) → **ตั้งเวลาโพสต์** → appears in `/studio/calendar` (drag to move).
7. `/studio/analytics` → **บันทึกผล** on a published piece.

Not verified in a browser by the build session (no authenticated session available to automation); every route is covered by unit tests, typecheck, lint, and `next build`, and all pages render loading/empty/error/AI-unavailable states by code review.

## 11. Bulk import of LINE OA chat history (offline)

Export chats from LINE Official Account Manager (CSV per chat: `ประเภทผู้ส่ง,ชื่อผู้ส่ง,วันส่ง,เวลาส่ง,ข้อความ`), put them in one folder, then on the Mac:

```bash
set -a; source .env.local; set +a
npx tsx --tsconfig tsconfig.scripts.json scripts/studio-import-line-history.ts ~/Downloads/line-history --dry-run   # parse + count only
npx tsx --tsconfig tsconfig.scripts.json scripts/studio-import-line-history.ts ~/Downloads/line-history --model claude-sonnet-5 --user <your profile uuid>
```

What it does per file: PII redaction per message (studio denylist + customer display names in the file, Thai digits normalised) → AI windows (~12k chars, `ลูกค้า:`/`นักสืบ:`) → `extractChatKnowledge` → writes **unapproved** rows: investigator knowledge (`tags: line-import, จากแชทจริง|ต้องยืนยัน`), case lessons (`category cases`, sensitivity confidential), service facts, and customer questions (`source import`). Customer claims are discarded; anything still carrying a high-severity identifier is dropped. Idempotent per file + window (`origin_ref = line-import:<sha1>:<n>`). Raw transcripts are never stored; the JSON report (counts only) is written next to the inputs. Review in `/studio/knowledge` (filter tag `line-import`) and approve what should feed AI content.

Measured on a 4-window pilot (Claude Opus 5, Sep 2026): ≈ 9.1k input + 5.5k output tokens and ~200 s per 12k-char window → ≈ US$0.18/window on Opus 5, ≈ US$0.07 on Sonnet 5 (output caps added afterwards should roughly halve that). The full 5-year export (6,009 chats → 2,505 with ≥ 2 customer messages → ~2,870 windows) is therefore ≈ US$100–200 on Sonnet 5 and several hours at `--concurrency 6`; pass `--model claude-sonnet-5` for bulk runs and keep Opus for content generation. Overlapping exports of the same chat (e.g. two Kimlank files) are deduped by content hash only when identical — import the longest export per chat.

Residual risk (documented on purpose): Thai has no word spaces, so person names are detected heuristically — formal titles (นาย/นาง/…), cue words (ชื่อ…/เรียกว่า) and a short word-bounded token after “คุณ”. A given name introduced without those cues can still reach the Anthropic API (processor, never stored raw) and is caught only by the customer-display-name/owner denylist, the prompt rules, the output re-scrub and human review before approval. Settings outages fail closed: capture, mining and import stop rather than run without the denylist.

## 12. Consolidation of imported knowledge (migrations 0115–0116)

Bulk import leaves thousands of overlapping rows. `scripts/studio-consolidate.ts [knowledge|questions|all] [--dry-run] [--passes 2] [--model claude-sonnet-5] [--user <uuid>] [--category a,b]` groups active rows per category (sorted by title, batches of 45) and asks the model for same-point groups; each group becomes one canonical row (`tags: line-import, consolidated`, `member_count`, still **unapproved**) and the members get `superseded_by`. Lists, counts and AI retrieval hide superseded rows (toggle "แสดงรายการที่ถูกรวมแล้ว"); the detail page shows the members of a canonical row and the canonical link on a member. Questions merge the same way with summed `frequency` and `member_count` (summed across passes). The unique `normalized_key` index is scoped to **active** rows (0116: `superseded_by IS NULL`); a collision merges into the existing active row, or is skipped (reported) when that row is already approved — mining/import lookups filter `superseded_by IS NULL` the same way so new hits land on the canonical row, never a hidden member. Canonical text is re-scrubbed: high-severity/denylist hits are dropped, softer findings add the `ต้องตรวจ privacy` tag; rows marked `restricted` are never sent to the model. Superseded members cannot be approved (toggle and edit actions refuse server-side; switch disabled); a member approved while a run is in flight is left untouched (supersede update is guarded). The CLI is a documented exception to per-row audit logging — traceability is via `origin_ref` + `studio_ai_generations` and are excluded from the source picker and global search. Deleting a canonical row re-activates its members (`ON DELETE SET NULL`). Sizing (2026-09-10): 6,840 knowledge rows → 157 batches, 4,609 questions → 77 batches per pass; two passes ≈ US$10–15 on Sonnet 5.

---

## 13. Media generation — Phase 1: images + Thai voice-over (migration 0117)

**Goal.** From the Content Editor the owner can turn the existing text creative plan into real assets: a cover/thumbnail image, one image per shot, and a Thai voice-over of the script/hook/variant. No publishing yet (Phase 2), no video (Phase 3).

**Providers (owner chose "pick for me", 2026-09-10).** Images: Google Gemini image model via REST (`GEMINI_API_KEY`, model `STUDIO_IMAGE_MODEL` default `gemini-2.5-flash-image`). Voice: ElevenLabs via REST (`ELEVENLABS_API_KEY`, model `eleven_multilingual_v2` — supports Thai; voice id configurable in Studio Settings). Both live behind `lib/studio/media/provider.ts` (`ImageProvider.generate`, `TtsProvider.synthesize`); a missing key surfaces as an honest "not configured" state (buttons disabled + reason), never a fake success. OpenAI image/TTS = interface slot only.

**Data.** Reuses `studio_creative_assets` (0109) and adds: `status` (`pending|ready|failed`), `label`, `mime`, `bytes`, `width`, `height`, `duration_ms`, `prompt` (the scrubbed prompt actually sent — reproducibility), `provider`, `model`, `generation_id` → `studio_ai_generations`, `variant_id`. New private bucket `studio-media` (admin-only policies, 25 MB, png/jpeg/webp/mpeg) with object path `<master_id>/<asset_id>.<ext>`; the UI only ever gets 10-minute signed URLs. `studio_settings.media_prefs` jsonb: `{image_style, default_aspect, tts_voice_id, tts_model, image_model}`.

**Flow.** Server action (admin, zod) → `lib/studio/media/generate.ts`: build prompt (brand style preset + shot visual / thumbnail concept / custom text + fixed safety negatives: no real faces, no licence plates, no readable names, no third-party logos) → `scrubText` on the prompt / voice text — a `high`/denylist finding refuses (same privacy rule as content) → provider call (60–120 s timeout) → upload to bucket via service client → asset row + `studio_ai_generations` row (`purpose image_generation|tts`, refs = ids + char count only, output = asset id) → `revalidatePath`. Generated images cannot be machine-scanned for PII; each card says "ตรวจภาพด้วยตาก่อนโพสต์" and the approval gate is unchanged (assets do not affect status).

**UI.** Editor → new "สื่อ" section under the creative plan: asset grid (image preview / audio player, label, provider·model, size, download, delete), "สร้างภาพ" (target: ปก · ฉาก n · กำหนดเอง; aspect 9:16 / 1:1 / 16:9), "พากย์เสียง" (source: script · hook · variant). Loading = pending card with spinner, error = toast + inline retry, empty = explains what will be generated or why it is unavailable. Settings → "สื่อ (รูป/เสียง)" card: key status, image model, style preset, default aspect, voice id/model.

**Costs (approx., provider list prices Sep 2026).** Gemini Flash image ≈ US$0.04/image; ElevenLabs ≈ US$0.10–0.30 per minute of Thai speech. Logged per call (`duration_ms`, model) so Settings → AI log shows usage.

**Owner must supply.** `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` in Vercel + `.env.local` (and a voice id if the default multilingual voice is not wanted). Everything else is in code.

---

## 14. Publishing — Phase 2: auto-posting via Ayrshare (migration 0118)

**Goal.** From an approved/scheduled content piece the owner posts (now or at the scheduled time) to Facebook Page, Instagram, TikTok and YouTube through one aggregator, without our own Meta/TikTok app review. Owner decision 2026-09-10: pay for Ayrshare; start with FB · IG · TikTok · YouTube. LINE OA broadcast stays a later add-on (we already hold the token).

**Provider.** `lib/studio/publish/provider.ts` (`PublishProvider`: `connectedPlatforms()`, `uploadMedia()`, `createPost()`, `deletePost()`, `postStatus()`) with `AyrsharePublishProvider` over REST (`AYRSHARE_API_KEY`, `Authorization: Bearer`). Media is first uploaded to Ayrshare's media store (`/api/media/upload`, base64) because our bucket is private and signed URLs expire; the returned URL is cached on the asset (`external_url`). Missing key ⇒ honest "not configured" (buttons disabled + reason). The owner links the social accounts in the Ayrshare dashboard; Settings shows which are active (`/api/user`).

**Data.** `studio_social_posts` (one row per master × platform): provider post id/ref, `status queued|scheduled|published|failed|deleted`, `scheduled_at`, `published_at`, `post_url`, `error`, `caption_chars`, `media_asset_ids`. `studio_settings.social_connections` (0109) holds the last connection snapshot + per-platform defaults (YouTube visibility, TikTok privacy level).

**Gates (server, in order).** admin → rate limit (10 publish requests / hour) → master status `approved|scheduled` (same rule as manual publish) → schedule must be ≥ 1 min in the future when "ตามเวลาที่ตั้งไว้" → no live/queued post already exists for master × platform (`duplicate`; partial unique index 0119 guards the race) → linked accounts → fresh deterministic privacy scan of the exact caption per platform (strict_mode honoured) → platform requirements: Instagram needs ≥1 image/video, TikTok needs a video or 1–35 images, YouTube needs a video + title, Facebook may be text-only → assets must be `ready` and belong to the master → provider call → rows + `STUDIO_SOCIAL_POST` audit → master becomes `published` (immediate) or stays `scheduled` (Ayrshare holds the schedule). Caption per platform = the platform variant's caption if present, else master caption + CTA, truncated to platform limits (IG 2,200 · TikTok 2,200 · YouTube title 100 / description 5,000 · FB 63,206). Platforms with different captions go out as separate aggregator requests so each receives exactly the previewed text; a group that the provider rejects becomes `failed` rows while the others proceed.

**Sync.** Cron `/api/cron/studio-social-sync` every 30 min: for rows `queued|scheduled`, ask Ayrshare `/api/history/:id` → mark `published` (post_url) / `failed` (error) and flip the master to `published` once every platform row is published; owner gets a LINE push on the first failure. Deleting a post calls Ayrshare `DELETE /api/post` and marks the row `deleted`.

**Honest limits.** Video generation is Phase 3, so until then TikTok/YouTube buttons stay disabled with "ต้องมีวิดีโอ" while FB/IG work with generated images. Analytics pull-back (`/api/analytics/post`) is prepared as a seam only. Ayrshare request/response shapes follow their public docs; `/api/user` was verified live with the owner's key on 2026-09-10 (Facebook Page + Instagram linked). `/api/post`, `/api/media/upload` and `/api/history` are exercised by the first real post — check Settings → AI log / the post list if a shape differs.

**Owner must supply.** Ayrshare account (paid plan), social accounts linked in its dashboard, `AYRSHARE_API_KEY` in Vercel + `.env.local`.

---

## 15. Video — Phase 3: template short-video rendering (migration 0120)

**Goal.** Turn a content piece into a vertical short video without a video-generation model: per-shot image (already generated in Phase 1) + per-shot Thai voice-over (ElevenLabs) + hook overlay + burned-in subtitles, rendered with ffmpeg into 1080×1920 H.264/AAC. Output is a `video` asset that Phase 2 can post to TikTok / Reels / YouTube Shorts.

**Why ffmpeg-static, not a video model or Remotion.** Deterministic, cheap (only TTS costs), no Chromium, no third-party render farm. `ffmpeg-static` ships a Linux binary (~45 MB, libass + freetype + libx264) that fits Vercel's 5 GB function limit; the route handler declares `maxDuration = 300`. Thai subtitles use libass (ASS file) with the bundled OFL font **Sarabun** (`src/lib/studio/video/fonts`), because libass shapes Thai combining marks correctly where `drawtext` does not.

**Timeline.** `creative_plan.shots[]` drive the cut: each shot's `voice` text is synthesised separately (mp3 128 kbps CBR, duration derived from bytes) so the shot lasts exactly its narration + 0.35 s pad; its image is the asset the owner generated for that shot (`meta.target = {kind:"scene", index}`), else the cover, else any image. Ken-Burns zoom on every still. Shot 1 shows the hook as a large overlay for its first 2.5 s. Subtitles: each shot's voice text is split at Thai clause markers / ~28 chars and timed proportionally to the narration. Per-shot audio is cached as `audio` assets keyed by `meta.shot_hash` (text + voice id) so re-renders don't pay TTS twice.

**Job model.** `studio_render_jobs` (status `queued|running|done|failed`, `step`, `progress`, `error`, `asset_id`, `params`). The editor creates a job (server action, admin + master not privacy-blocked) and then POSTs to `/api/studio/render/[jobId]` (route handler, admin session, `maxDuration 300`) which runs the pipeline and updates the job; the UI polls `getRenderJob` every 3 s. Concurrency: one running job per master. Output mp4 → bucket `studio-media` (mime allowlist gains `video/mp4`, size limit 200 MB) → `studio_creative_assets` row kind `video` with duration/dimensions.

**Gates.** admin → master exists and status not `archived` → fresh deterministic privacy scan (hook/script/caption) not blocked → plan has ≥ 1 shot with voice text → ≥ 1 ready image asset → TTS + ffmpeg configured. Costs: TTS only (≈ ฿3–10 per minute of narration); render is CPU time on Vercel.

**Honest limits.** No B-roll motion video (stills with zoom), no music (licensing), one aspect (9:16) in V1, ffmpeg wall-time on a 1 vCPU function ≈ 1–2× the video length; a 60 s clip may take ~2 min. Not browser-verified with an owner session; the pipeline is exercised end-to-end locally with the real providers before merge.
