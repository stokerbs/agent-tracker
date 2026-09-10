import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { extractCustomerFAQs } from "@/lib/studio/ai/actions/knowledge";
import { scrubText } from "@/lib/studio/privacy/scrub";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import type { PrivacyRules } from "@/lib/studio/types";

/**
 * FAQ mining: studio_line_inbox (redacted customer messages) → AI → canonical
 * recurring questions upserted into studio_customer_questions.
 *
 * Runs from the weekly cron and from the "ขุดตอนนี้" button in Knowledge →
 * คำถามลูกค้า. Mined questions arrive with approved_for_content = false; the
 * owner reviews and approves them like any other knowledge.
 *
 * Retention (PDPA storage limitation): processed rows are deleted
 * INBOX_RETENTION_DAYS after processing; ANY row older than
 * INBOX_HARD_RETENTION_DAYS is deleted regardless of processing state, so a
 * broken AI key or a quiet inbox can never keep customer text forever.
 */

export const MIN_MESSAGES_TO_MINE = 5;
export const MAX_MESSAGES_PER_BATCH = 300;
/** Keep the prompt within extractCustomerFAQs' 20k-char window; only messages actually sent are marked processed. */
export const MAX_PROMPT_CHARS = 18_000;
export const INBOX_RETENTION_DAYS = 30;
export const INBOX_HARD_RETENTION_DAYS = 90;

/** Canonical form used to dedupe questions: lowercase, no punctuation/space, no trailing particles. */
export function normalizeQuestionKey(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "")
    .replace(/(?:ครับ|ค่ะ|คะ|ไหมครับ|ไหมคะ|มั้ย|ไหม|บ้าง|หรอ|เหรอ)+$/u, "")
    .slice(0, 200);
}

/** True when AI output still carries a high-severity identifier — such a question is dropped, never stored. */
export function outputCarriesPii(question: string, answerHint: string | null | undefined, rules?: Partial<PrivacyRules> | null): boolean {
  return scrubText({ fields: { question, answer_hint: answerHint ?? "" }, rules: rules ?? null }).some((f) => f.severity === "high");
}

/** A single sender can't monopolise a batch (flood guard is 20/hour, so a week can still be thousands). */
export const MAX_MESSAGES_PER_SENDER = 40;

export interface MineResult {
  ok: boolean;
  error?: string;
  messages: number;
  inserted: number;
  merged: number;
  dropped: number;
  purged: number;
  generationId: string | null;
  skipped?: "too_few";
}

type Svc = ReturnType<typeof createServiceClient>;

export async function mineLineInbox(opts: { userId: string | null; minMessages?: number }): Promise<MineResult> {
  const svc = createServiceClient();
  const min = opts.minMessages ?? MIN_MESSAGES_TO_MINE;
  const base = { inserted: 0, merged: 0, dropped: 0, generationId: null as string | null };

  // Retention runs first and unconditionally.
  const purged = await purgeExpired(svc);

  const { data: rows, error } = await svc
    .from("studio_line_inbox")
    .select("id, sender_hash, text_redacted, received_at")
    .is("processed_at", null)
    .order("received_at", { ascending: true })
    .limit(MAX_MESSAGES_PER_BATCH);
  if (error) {
    console.error("[studio:faq-mining] inbox load failed:", error.message);
    return { ok: false, error: "โหลดข้อความ LINE ไม่สำเร็จ", messages: 0, purged, ...base };
  }
  const all = rows ?? [];
  if (all.length < min) return { ok: true, messages: all.length, purged, skipped: "too_few", ...base };

  // Group by sender (the model sees conversations) and stop before the prompt window overflows.
  const bySender = new Map<string, { ids: string[]; texts: string[] }>();
  for (const m of all) {
    const g = bySender.get(m.sender_hash) ?? { ids: [], texts: [] };
    if (g.texts.length >= MAX_MESSAGES_PER_SENDER) continue; // left unprocessed for a later batch
    g.ids.push(m.id);
    g.texts.push(m.text_redacted);
    bySender.set(m.sender_hash, g);
  }
  let rules: PrivacyRules;
  try {
    rules = (await getStudioSettingsStrict()).privacy_rules;
  } catch (e) {
    console.error("[studio:faq-mining] settings unavailable — not mining:", e instanceof Error ? e.message : e);
    return { ok: false, error: "โหลดกฎ privacy ของสตูดิโอไม่สำเร็จ — ยังไม่ขุดเพื่อความปลอดภัย", messages: 0, purged, ...base };
  }
  const blocks: string[] = [];
  const includedIds: string[] = [];
  let chars = 0;
  let i = 0;
  for (const g of bySender.values()) {
    // Fill message by message so a sender block never overflows the window; only what fits is marked processed.
    const header = `--- ลูกค้า #${++i} ---`;
    const lines: string[] = [];
    const ids: string[] = [];
    let size = header.length + 1;
    for (let k = 0; k < g.texts.length; k++) {
      const line = `• ${g.texts[k]}`;
      if (chars + size + line.length + 1 > MAX_PROMPT_CHARS) break;
      lines.push(line);
      ids.push(g.ids[k]);
      size += line.length + 1;
    }
    if (!lines.length) break;
    blocks.push(`${header}\n${lines.join("\n")}`);
    includedIds.push(...ids);
    chars += size + 2;
    if (lines.length < g.texts.length) break; // window is full
  }
  const pasted = blocks.join("\n\n");

  const res = await extractCustomerFAQs({ pastedText: pasted, source: "line_oa", userId: opts.userId });
  if (!res.ok) {
    console.error("[studio:faq-mining] extraction failed:", res.error);
    return { ok: false, error: res.error, messages: includedIds.length, purged, ...base, generationId: res.generationId };
  }

  let inserted = 0;
  let merged = 0;
  let dropped = 0;
  const now = new Date().toISOString();
  for (const q of res.data.questions) {
    const question = q.question.trim().slice(0, 500);
    const answerHint = q.answer_hint?.trim().slice(0, 1000) || null;
    if (!question) continue;
    const key = normalizeQuestionKey(question);
    if (!key) continue;
    // The model was told not to copy identifiers; enforce it anyway.
    if (outputCarriesPii(question, answerHint, rules)) {
      dropped += 1;
      console.warn("[studio:faq-mining] dropped a mined question carrying an identifier");
      continue;
    }
    const freq = Math.max(1, Math.round(q.frequency || 1));
    const tags = Array.from(new Set((q.tags ?? []).map((t) => t.trim()).filter(Boolean))).slice(0, 8);

    // Match on normalized key first, then exact text (legacy rows without a key).
    // `key` is [\p{L}\p{M}\p{N}]+ only and `question` is JSON-quoted, so neither can break the PostgREST filter.
    const { data: existing, error: fErr } = await svc
      .from("studio_customer_questions")
      .select("id, frequency, tags, answer_hint")
      .eq("is_demo", false)
      .is("superseded_by", null)
      .or(`normalized_key.eq.${key},question.eq.${JSON.stringify(question)}`)
      .limit(1)
      .maybeSingle();
    if (fErr) {
      console.error("[studio:faq-mining] lookup failed:", fErr.message);
      continue;
    }

    if (existing) {
      const { error: uErr } = await svc
        .from("studio_customer_questions")
        .update({
          frequency: (existing.frequency ?? 1) + freq,
          tags: Array.from(new Set([...(existing.tags ?? []), ...tags])).slice(0, 12),
          answer_hint: existing.answer_hint?.trim() ? existing.answer_hint : answerHint,
          last_seen_at: now,
          normalized_key: key,
        })
        .eq("id", existing.id);
      if (!uErr) merged += 1;
      else console.error("[studio:faq-mining] merge failed:", uErr.message);
    } else {
      const { error: iErr } = await svc.from("studio_customer_questions").insert({
        question,
        answer_hint: answerHint,
        frequency: freq,
        source: "line_oa",
        tags,
        approved_for_content: false,
        is_demo: false,
        last_seen_at: now,
        normalized_key: key,
        created_by: opts.userId,
      });
      if (!iErr) inserted += 1;
      else if (iErr.code === "23505") {
        // Lost a race on the unique normalized_key (0114) → merge into the winner.
        const { data: race } = await svc.from("studio_customer_questions").select("id, frequency, tags").eq("normalized_key", key).eq("is_demo", false).is("superseded_by", null).limit(1).maybeSingle();
        if (race) {
          const { error: mErr } = await svc
            .from("studio_customer_questions")
            .update({ frequency: (race.frequency ?? 1) + freq, tags: Array.from(new Set([...(race.tags ?? []), ...tags])).slice(0, 12), last_seen_at: now })
            .eq("id", race.id);
          if (!mErr) merged += 1;
          else console.error("[studio:faq-mining] merge (race) failed:", mErr.message);
        }
      } else console.error("[studio:faq-mining] insert failed:", iErr.message);
    }
  }

  const { error: pErr } = await svc
    .from("studio_line_inbox")
    .update({ processed_at: now, batch_id: res.generationId })
    .in("id", includedIds);
  if (pErr) console.error("[studio:faq-mining] mark processed failed:", pErr.message);

  console.info(`[studio:faq-mining] messages=${includedIds.length}/${all.length} inserted=${inserted} merged=${merged} dropped=${dropped} purged=${purged} gen=${res.generationId}`);
  return { ok: true, messages: includedIds.length, inserted, merged, dropped, purged, generationId: res.generationId };
}

/** Soft purge (processed > 30 d) + hard purge (anything > 90 d). */
async function purgeExpired(svc: Svc): Promise<number> {
  const soft = new Date(Date.now() - INBOX_RETENTION_DAYS * 86400_000).toISOString();
  const hard = new Date(Date.now() - INBOX_HARD_RETENTION_DAYS * 86400_000).toISOString();
  let n = 0;
  const a = await svc.from("studio_line_inbox").delete().lt("processed_at", soft).select("id");
  if (a.error) console.error("[studio:faq-mining] soft purge failed:", a.error.message);
  else n += a.data?.length ?? 0;
  const b = await svc.from("studio_line_inbox").delete().lt("received_at", hard).select("id");
  if (b.error) console.error("[studio:faq-mining] hard purge failed:", b.error.message);
  else n += b.data?.length ?? 0;
  return n;
}

export interface InboxStats {
  unprocessed: number;
  lastProcessedAt: string | null;
  senders7d: number;
}

export async function getInboxStats(): Promise<InboxStats> {
  const svc = createServiceClient();
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [unproc, last, senders] = await Promise.all([
    svc.from("studio_line_inbox").select("id", { count: "exact", head: true }).is("processed_at", null),
    svc.from("studio_line_inbox").select("processed_at").not("processed_at", "is", null).order("processed_at", { ascending: false }).limit(1).maybeSingle(),
    svc.from("studio_line_inbox").select("sender_hash").gte("received_at", since).limit(1000),
  ]);
  return {
    unprocessed: unproc.count ?? 0,
    lastProcessedAt: last.data?.processed_at ?? null,
    senders7d: new Set((senders.data ?? []).map((r) => r.sender_hash)).size,
  };
}
