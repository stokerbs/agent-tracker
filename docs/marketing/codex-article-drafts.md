# Article drafts through the ChatGPT plan

Article drafting has moved from Vercel Cron / Anthropic to the owner's scheduled Codex task in ChatGPT, named **ร่างบทความ Detective Pulse**. The task runs on Tuesdays and Fridays at 09:00 Asia/Bangkok and uses the owner's available ChatGPT plan allowance. Its actual execution depends on plan limits, connected-app access and any required approvals.

## Workflow

1. Codex reads the current topic pools, editorial rules, brand facts and Chinese compliance guard through the connected GitHub app.
2. It checks existing topics/slugs and the live table constraints through the connected Supabase app.
3. It writes the Thai, English and Chinese article itself, then inserts one row into `public.marketing_articles` with `model = 'codex-chatgpt-plan'`, `status = 'draft'` and no publication timestamp.
4. The task verifies the saved row and returns its private one-time review link in ChatGPT. It does not send LINE notifications.
5. The owner reviews the complete draft in the existing website review flow and approves or rejects it. The task selects standalone informational topics outside the content calendar, so its drafts do not require owner-authored paragraphs. Legacy content-calendar drafts retain their existing validation.

The scheduled task is configured in the owner's ChatGPT account, not deployed by this repository. Installing this code on another account does not create that task. Manage it in ChatGPT's scheduled-task list; a manual request to Codex can use the same connected apps to prepare another draft.

## Operational rules

- No Anthropic/OpenAI API key is required by the scheduled task. It must not call paid generation endpoints or fall back to the retired website generator.
- Use only the connected app permissions. Pause and report missing permissions or approval requirements instead of claiming success.
- Insert at most one draft per Bangkok calendar day. Use the `detectivepulse:codex-article` transaction-scoped advisory lock and an atomic insert guard for daily idempotency, topic reuse and slug collisions. A retry after an uncertain write must read before inserting.
- Keep approval tokens private. Never commit review links, task-account credentials or connection tokens to this repository.
- Respect the live `marketing_articles.service` CHECK constraint. Its original values are `relationship`, `find_person`, `background`, `due_diligence`, `on_site`, `asset`, `pricing` and `general`. Content-calendar keys outside that set use `general` while retaining the correct service links in the article bodies.
- The task writes drafts only. Existing human approval, owner-paragraph validation, publication and revalidation remain in the website.
- A failed run should surface the specific blocker in ChatGPT. Verify both the task result and the database record when diagnosing missing articles.

## Retired website triggers

The article entry has been removed from `vercel.json`; other cron entries are retained. The legacy cron endpoint still checks `CRON_SECRET` and returns HTTP 410 to authenticated callers without contacting an AI provider. The dashboard no longer exposes the Anthropic-backed generate action.

To reintroduce an API-backed generator, make an explicit provider/billing decision and disable the scheduled Codex task first to avoid two independent article writers.
