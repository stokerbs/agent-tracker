import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { extractCustomerFAQs } from "@/lib/studio/ai/actions/knowledge";

/**
 * FAQ mining: studio_line_inbox (redacted customer messages) → AI → canonical
 * recurring questions upserted into studio_customer_questions.
 *
 * Runs from the weekly cron and from the "ขุดตอนนี้" button in Knowledge →
 * คำถามลูกค้า. Mined questions arrive with approved_for_content = false; the
 * owner reviews and approves them like any other knowledge.
 */

export const MIN_MESSAGES_TO_MINE = 5;
export const MAX_MESSAGES_PER_BATCH = 300;
export const INBOX_RETENTION_DAYS = 30;

/** Canonical form used to dedupe questions: lowercase, no punctuation/space, no trailing particles. */
export function normalizeQuestionKey(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "")
    .replace(/(?:ครับ|ค่ะ|คะ|ไหมครับ|ไหมคะ|มั้ย|ไหม|บ้าง|หรอ|เหรอ)+$/u, "")
    .slice(0, 200);
}

export interface MineResult {
  ok: boolean;
  error?: string;
  messages: number;
  inserted: number;
  merged: number;
  purged: number;
  generationId: string | null;
  skipped?: "too_few";
}

export async function mineLineInbox(opts: { userId: string | null; minMessages?: number }): Promise<MineResult> {
  const svc = createServiceClient();
  const min = opts.minMessages ?? MIN_MESSAGES_TO_MINE;

  const { data: rows, error } = await svc
    .from("studio_line_inbox")
    .select("id, sender_hash, text_redacted, received_at")
    .is("processed_at", null)
    .order("received_at", { ascending: true })
    .limit(MAX_MESSAGES_PER_BATCH);
  if (error) {
    console.error("[studio:faq-mining] inbox load failed:", error.message);
    return { ok: false, error: "โหลดข้อความ LINE ไม่สำเร็จ", messages: 0, inserted: 0, merged: 0, purged: 0, generationId: null };
  }
  const messages = rows ?? [];
  const purged = await purgeOldProcessed(svc);
  if (messages.length < min) {
    return { ok: true, messages: messages.length, inserted: 0, merged: 0, purged, generationId: null, skipped: "too_few" };
  }

  // Group by sender so the model sees conversations, not a flat list.
  const bySender = new Map<string, string[]>();
  for (const m of messages) (bySender.get(m.sender_hash) ?? bySender.set(m.sender_hash, []).get(m.sender_hash)!).push(m.text_redacted);
  const pasted = Array.from(bySender.values())
    .map((msgs, i) => `--- ลูกค้า #${i + 1} ---\n${msgs.map((t) => `• ${t}`).join("\n")}`)
    .join("\n\n");

  const res = await extractCustomerFAQs({ pastedText: pasted, source: "line_oa", userId: opts.userId });
  if (!res.ok) {
    console.error("[studio:faq-mining] extraction failed:", res.error);
    return { ok: false, error: res.error, messages: messages.length, inserted: 0, merged: 0, purged, generationId: res.generationId };
  }

  let inserted = 0;
  let merged = 0;
  const now = new Date().toISOString();
  for (const q of res.data.questions) {
    const question = q.question.trim();
    if (!question) continue;
    const key = normalizeQuestionKey(question);
    const freq = Math.max(1, Math.round(q.frequency || 1));
    const tags = Array.from(new Set((q.tags ?? []).map((t) => t.trim()).filter(Boolean))).slice(0, 8);

    // Match on normalized key first, then exact text (legacy rows without a key).
    const { data: existing } = await svc
      .from("studio_customer_questions")
      .select("id, frequency, tags, answer_hint")
      .or(`normalized_key.eq.${key.replace(/[,()]/g, "")},question.eq.${JSON.stringify(question)}`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error: uErr } = await svc
        .from("studio_customer_questions")
        .update({
          frequency: (existing.frequency ?? 1) + freq,
          tags: Array.from(new Set([...(existing.tags ?? []), ...tags])).slice(0, 12),
          answer_hint: existing.answer_hint?.trim() ? existing.answer_hint : q.answer_hint?.trim() || null,
          last_seen_at: now,
          normalized_key: key,
        })
        .eq("id", existing.id);
      if (!uErr) merged += 1;
      else console.error("[studio:faq-mining] merge failed:", uErr.message);
    } else {
      const { error: iErr } = await svc.from("studio_customer_questions").insert({
        question,
        answer_hint: q.answer_hint?.trim() || null,
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
      else console.error("[studio:faq-mining] insert failed:", iErr.message);
    }
  }

  const { error: pErr } = await svc
    .from("studio_line_inbox")
    .update({ processed_at: now, batch_id: res.generationId })
    .in("id", messages.map((m) => m.id));
  if (pErr) console.error("[studio:faq-mining] mark processed failed:", pErr.message);

  console.info(`[studio:faq-mining] messages=${messages.length} inserted=${inserted} merged=${merged} purged=${purged} gen=${res.generationId}`);
  return { ok: true, messages: messages.length, inserted, merged, purged, generationId: res.generationId };
}

async function purgeOldProcessed(svc: ReturnType<typeof createServiceClient>): Promise<number> {
  const cutoff = new Date(Date.now() - INBOX_RETENTION_DAYS * 86400_000).toISOString();
  const { data, error } = await svc.from("studio_line_inbox").delete().lt("processed_at", cutoff).select("id");
  if (error) {
    console.error("[studio:faq-mining] purge failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
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
