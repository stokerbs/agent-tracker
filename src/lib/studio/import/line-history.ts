import "server-only";

import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { extractChatKnowledge } from "@/lib/studio/ai/actions/chat-knowledge";
import { normalizeQuestionKey, outputCarriesPii } from "@/lib/studio/faq-mining";
import { redactForInbox } from "@/lib/studio/line-inbox";
import { scrubText } from "@/lib/studio/privacy/scrub";
import { getStudioSettings } from "@/lib/studio/settings";
import type { PrivacyRules } from "@/lib/studio/types";
import { buildTranscriptWindows, parseLineOaCsv, type TranscriptWindow } from "./line-csv";

/**
 * Offline bulk import: LINE OA chat-history CSV → Studio knowledge base.
 *
 * Per file: parse → per-message PII redaction (studio denylist + the customer
 * display names found in the file) → AI windows → knowledge / questions /
 * case lessons / service facts, all inserted UNAPPROVED for owner review.
 *
 * Idempotent: every knowledge row carries origin_ref
 * `line-import:<sha1(file)>:<window>`; a window that already produced rows is
 * skipped. Questions dedupe by normalized_key. Raw transcripts are never stored
 * — only the redacted window is sent to the model and only the model's
 * identity-free output is persisted (after a second scrub).
 */

export interface ImportOptions {
  dryRun?: boolean;
  model?: string;
  userId?: string | null;
  maxWindowChars?: number;
  /** Skip chats with fewer customer messages than this (greeting-only chats carry no knowledge). Default 2. */
  minUserMessages?: number;
  /** Progress callback for the CLI. */
  onProgress?: (msg: string) => void;
}

export interface ImportFileResult {
  file: string;
  fileHash: string;
  messages: number;
  windows: number;
  windowsSkipped: number;
  knowledgeInserted: number;
  questionsInserted: number;
  questionsMerged: number;
  caseLessonsInserted: number;
  serviceFactsInserted: number;
  dropped: number;
  errors: string[];
  inputTokens: number;
  outputTokens: number;
}

/** Hash of the MESSAGE rows only — re-exporting the same chat later (new download header) keeps the same hash. */
let rulesCache: { at: number; rules: PrivacyRules | null } | null = null;
/** Settings rarely change mid-import; one lookup per minute instead of per file. */
async function cachedPrivacyRules(): Promise<PrivacyRules | null> {
  if (rulesCache && Date.now() - rulesCache.at < 60_000) return rulesCache.rules;
  let rules: PrivacyRules | null = null;
  try {
    rules = (await getStudioSettings()).privacy_rules;
  } catch {
    rules = null;
  }
  rulesCache = { at: Date.now(), rules };
  return rules;
}

export function fileHashOf(content: string): string {
  const parsed = parseLineOaCsv(content);
  const canonical = parsed.messages.map((m) => `${m.side}|${m.at}|${m.text}`).join("\n");
  return crypto.createHash("sha1").update(canonical || content).digest("hex").slice(0, 16);
}

/** Build the per-file redactor: studio denylist + customer display names + name fragments. Also returns the merged rules for the second (output) scrub. */
export function makeRedactor(rules: PrivacyRules | null, customerNames: string[]): { redact: (t: string) => string; rules: PrivacyRules } {
  const extra = customerNames
    .flatMap((n) => [n, ...n.split(/[\s.·•|]+/)])
    .map((s) => s.replace(/[^\p{L}\p{M}\p{N}]/gu, "").trim())
    .filter((s) => s.length >= 2);
  const merged: PrivacyRules = {
    denylist: Array.from(new Set([...(rules?.denylist ?? []), ...extra])),
    custom_patterns: rules?.custom_patterns ?? [],
    strict_mode: rules?.strict_mode ?? false,
  };
  return { redact: (t: string) => redactForInbox(t, merged), rules: merged };
}

type Verdict = "ok" | "flag" | "drop";
/** Second scrub on model output: high → drop; name/denylist → drop; other medium/low → keep but flag for review. */
function judge(rules: PrivacyRules | null, ...fields: string[]): Verdict {
  const findings = scrubText({ fields: Object.fromEntries(fields.map((f, i) => [`f${i}`, f])), rules });
  if (!findings.length) return "ok";
  if (findings.some((f) => f.severity === "high" || f.kind === "name" || f.kind === "denylist")) return "drop";
  return "flag";
}
const REVIEW_TAG = "ต้องตรวจ privacy";

export async function importLineHistoryFile(fileName: string, content: string, opts: ImportOptions = {}): Promise<ImportFileResult> {
  const svc = createServiceClient();
  const log = opts.onProgress ?? (() => {});
  const fileHash = fileHashOf(content);
  const result: ImportFileResult = {
    file: fileName,
    fileHash,
    messages: 0,
    windows: 0,
    windowsSkipped: 0,
    knowledgeInserted: 0,
    questionsInserted: 0,
    questionsMerged: 0,
    caseLessonsInserted: 0,
    serviceFactsInserted: 0,
    dropped: 0,
    errors: [],
    inputTokens: 0,
    outputTokens: 0,
  };

  const parsed = parseLineOaCsv(content);
  result.messages = parsed.messages.length;
  if (!parsed.messages.length) {
    result.errors.push("no messages parsed (not a LINE OA export?)");
    return result;
  }

  const userMessages = parsed.messages.filter((m) => m.side === "user").length;
  if (userMessages < (opts.minUserMessages ?? 2)) {
    result.errors.push(`skipped: only ${userMessages} customer message(s)`);
    return result;
  }

  const rules = await cachedPrivacyRules();
  const { redact, rules: mergedRules } = makeRedactor(rules, parsed.customerNames);
  const windows = buildTranscriptWindows(parsed.messages, redact, opts.maxWindowChars ?? 12_000).filter((w) => w.userCount > 0);
  result.windows = windows.length;
  if (opts.dryRun) {
    for (const w of windows) log(`  window ${w.index + 1}/${windows.length} (${w.messageCount} msgs, ${w.text.length} chars)`);
    return result;
  }

  // Idempotency: a window is done if it produced knowledge rows OR a successful
  // generation was logged for it (windows that yielded only questions / nothing
  // must not be re-billed or re-counted).
  const [{ data: doneK }, { data: doneG }] = await Promise.all([
    svc.from("studio_knowledge_sources").select("origin_ref").like("origin_ref", `line-import:${fileHash}:%`),
    svc.from("studio_ai_generations").select("input_refs").eq("purpose", "chat_knowledge").eq("status", "ok").filter("input_refs->>ref", "like", `line-import:${fileHash}:%`),
  ]);
  const doneRefs = new Set<string>([
    ...((doneK ?? []).map((r) => r.origin_ref).filter((x): x is string => !!x)),
    ...((doneG ?? []).map((r) => (r.input_refs as { ref?: string } | null)?.ref).filter((x): x is string => !!x)),
  ]);

  for (const w of windows) {
    const ref = `line-import:${fileHash}:${w.index}`;
    if (doneRefs.has(ref)) {
      result.windowsSkipped += 1;
      continue;
    }
    log(`  window ${w.index + 1}/${windows.length} (${w.messageCount} msgs, ${w.text.length} chars)`);
    if (opts.dryRun) continue;

    // The label is the opaque ref — never the filename (it carries the customer's display name).
    const res = await extractChatKnowledge({ transcript: w.text, windowLabel: ref, userId: opts.userId ?? null, model: opts.model });
    if (!res.ok) {
      result.errors.push(`window ${w.index + 1}: ${res.error}`);
      continue;
    }
    await persistWindow(svc, res.data, ref, w, opts.userId ?? null, result, mergedRules);
  }
  return result;
}

type Svc = ReturnType<typeof createServiceClient>;
type Output = Awaited<ReturnType<typeof extractChatKnowledge>> extends infer R ? (R extends { ok: true; data: infer D } ? D : never) : never;

async function persistWindow(svc: Svc, out: Output, ref: string, w: TranscriptWindow, userId: string | null, result: ImportFileResult, rules: PrivacyRules | null): Promise<void> {
  const period = `${w.from.slice(0, 7)}`; // YYYY-MM — coarse, non-identifying
  const rows: Array<Record<string, unknown>> = [];

  for (const k of out.knowledge) {
    const title = k.title.trim().slice(0, 200);
    const content = k.content.trim();
    if (!title || content.length < 20) continue;
    if (k.evidence === "customer_claim") continue; // not our expertise
    const v = judge(rules, title, content);
    if (v === "drop") {
      result.dropped += 1;
      continue;
    }
    rows.push({
      title,
      content,
      summary: null,
      source_type: k.category === "services" ? "service" : k.category === "owner_experience" ? "owner_experience" : "investigator_knowledge",
      category: k.category,
      tags: Array.from(new Set([...(k.tags ?? []).slice(0, 6), "line-import", k.evidence === "implied" ? "ต้องยืนยัน" : "จากแชทจริง", ...(v === "flag" ? [REVIEW_TAG] : [])])),
      sensitivity: "internal",
      approved_for_content: false,
      origin_ref: ref,
      is_demo: false,
      created_by: userId,
    });
  }
  for (const c of out.case_lessons) {
    if (c.privacy_status === "blocked") {
      result.dropped += 1;
      continue;
    }
    const content = `สถานการณ์: ${c.situation.trim()}\n\nบทเรียน: ${c.lesson.trim()}`;
    const cv = judge(rules, c.title, content);
    if (cv === "drop") {
      result.dropped += 1;
      continue;
    }
    rows.push({
      title: c.title.trim().slice(0, 200),
      content,
      summary: c.lesson.trim().slice(0, 300),
      source_type: "case",
      category: "cases",
      tags: Array.from(new Set(["line-import", "case-lesson", c.pillar, c.privacy_status === "review_required" || cv === "flag" ? REVIEW_TAG : "safe"])),
      sensitivity: "confidential",
      approved_for_content: false,
      origin_ref: ref,
      is_demo: false,
      created_by: userId,
    });
  }
  const facts = out.service_facts.map((f) => f.fact.trim()).filter((f) => f.length >= 10 && judge(rules, f) !== "drop");
  if (facts.length) {
    rows.push({
      title: `ข้อเท็จจริงด้านบริการจากแชท (${period})`,
      content: facts.map((f) => `• ${f}`).join("\n"),
      summary: null,
      source_type: "service",
      category: "services",
      tags: ["line-import", "service-facts"],
      sensitivity: "internal",
      approved_for_content: false,
      origin_ref: ref,
      is_demo: false,
      created_by: userId,
    });
  }
  if (rows.length) {
    const { error } = await svc.from("studio_knowledge_sources").insert(rows as never);
    if (error) result.errors.push(`knowledge insert (${ref}): ${error.message}`);
    else {
      result.knowledgeInserted += rows.filter((r) => r.category !== "cases" && !(r.tags as string[]).includes("service-facts")).length;
      result.caseLessonsInserted += rows.filter((r) => r.category === "cases").length;
      result.serviceFactsInserted += facts.length ? 1 : 0;
    }
  }

  const now = new Date().toISOString();
  for (const q of out.questions) {
    const question = q.question.trim().slice(0, 500);
    const hint = q.answer_hint?.trim().slice(0, 1000) || null;
    const key = normalizeQuestionKey(question);
    if (!question || !key) continue;
    const qv = judge(rules, question, hint ?? "");
    if (qv === "drop" || outputCarriesPii(question, hint, rules)) {
      result.dropped += 1;
      continue;
    }
    const freq = Math.max(1, Math.round(q.frequency || 1));
    const tags = Array.from(new Set([...(q.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 6), "line-import", ...(qv === "flag" ? [REVIEW_TAG] : [])]));
    const { data: existing, error: fErr } = await svc
      .from("studio_customer_questions")
      .select("id, frequency, tags, answer_hint")
      .or(`normalized_key.eq.${key},question.eq.${JSON.stringify(question)}`)
      .limit(1)
      .maybeSingle();
    if (fErr) {
      result.errors.push(`question lookup: ${fErr.message}`);
      continue;
    }
    if (existing) {
      const { error } = await svc
        .from("studio_customer_questions")
        .update({
          frequency: (existing.frequency ?? 1) + freq,
          tags: Array.from(new Set([...(existing.tags ?? []), ...tags])).slice(0, 12),
          answer_hint: existing.answer_hint?.trim() ? existing.answer_hint : hint,
          last_seen_at: now,
          normalized_key: key,
        })
        .eq("id", existing.id);
      if (!error) result.questionsMerged += 1;
      else result.errors.push(`question merge: ${error.message}`);
    } else {
      const { error } = await svc.from("studio_customer_questions").insert({
        question,
        answer_hint: hint,
        frequency: freq,
        source: "import",
        tags,
        approved_for_content: false,
        is_demo: false,
        last_seen_at: now,
        normalized_key: key,
        created_by: userId,
      });
      if (!error) result.questionsInserted += 1;
      else result.errors.push(`question insert: ${error.message}`);
    }
  }
}
