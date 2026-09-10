import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { consolidateKnowledgeBatch, consolidateQuestionsBatch } from "@/lib/studio/ai/actions/consolidate";
import { normalizeKnowledgeCategory } from "@/lib/studio/ai/prompts/chat-knowledge";
import { normalizeQuestionKey } from "@/lib/studio/faq-mining";
import { scrubText } from "@/lib/studio/privacy/scrub";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import type { PrivacyRules } from "@/lib/studio/types";

/**
 * Consolidation of near-duplicate imported knowledge / customer questions.
 *
 * Pass structure (per category): rows sorted by title → batches of BATCH_SIZE
 * → AI groups same-point rows → one canonical row is inserted (tags:
 * line-import, consolidated; member_count) and members get superseded_by.
 * Running again picks up the new canonical rows + remaining singletons, so a
 * second pass merges across batch boundaries. Idempotent per batch through the
 * generation log is not needed — a merged member is superseded and never
 * re-read, so re-running only costs the still-active rows.
 *
 * Everything stays approved_for_content = false; the owner approves the
 * canonical rows. Members remain for traceability (hidden by default).
 */

export const BATCH_SIZE = 45;
export const MIN_BATCH = 4;
export const CONSOLIDATED_TAG = "consolidated";

type Svc = ReturnType<typeof createServiceClient>;

export interface ConsolidateOptions {
  dryRun?: boolean;
  model?: string;
  userId?: string | null;
  categories?: string[];
  /** Only rows carrying this tag are considered (default: line-import). */
  sourceTag?: string;
  onProgress?: (msg: string) => void;
}

export interface ConsolidateResult {
  target: "knowledge" | "questions";
  scanned: number;
  batches: number;
  groups: number;
  merged: number;
  dropped: number;
  errors: string[];
}

/** Split sorted rows into batches; a trailing tiny batch is folded into the previous one. */
export function makeBatches<T>(rows: T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  if (out.length > 1 && out[out.length - 1].length < MIN_BATCH) {
    const last = out.pop()!;
    out[out.length - 1].push(...last);
  }
  return out;
}

/** Validate a model group against the batch: ≥ 2 distinct known indexes, each index used once across groups. */
export function validGroups<T extends { member_ids: number[] }>(groups: T[], size: number): T[] {
  const used = new Set<number>();
  const ok: T[] = [];
  for (const g of groups) {
    const ids = Array.from(new Set(g.member_ids.filter((n) => Number.isInteger(n) && n >= 0 && n < size)));
    if (ids.length < 2 || ids.some((n) => used.has(n))) continue;
    ids.forEach((n) => used.add(n));
    ok.push({ ...g, member_ids: ids });
  }
  return ok;
}

/** PostgREST caps a single request at 1000 rows — page through with .range(). */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

function carriesHighPii(rules: PrivacyRules, ...fields: string[]): boolean {
  return scrubText({ fields: Object.fromEntries(fields.map((f, i) => [`f${i}`, f])), rules }).some((f) => f.severity === "high" || f.kind === "denylist");
}

export async function consolidateKnowledge(opts: ConsolidateOptions = {}): Promise<ConsolidateResult> {
  const svc = createServiceClient();
  const log = opts.onProgress ?? (() => {});
  const res: ConsolidateResult = { target: "knowledge", scanned: 0, batches: 0, groups: 0, merged: 0, dropped: 0, errors: [] };
  const rules = (await getStudioSettingsStrict()).privacy_rules;
  const sourceTag = opts.sourceTag ?? "line-import";

  const { rows, error } = await fetchAll((from, to) =>
    svc
      .from("studio_knowledge_sources")
      .select("id, title, content, category, tags, member_count, sensitivity")
      .contains("tags", [sourceTag])
      .is("superseded_by", null)
      .eq("approved_for_content", false)
      .order("category")
      .order("title")
      .order("id")
      .range(from, to),
  );
  if (error) {
    res.errors.push(`load: ${error}`);
    return res;
  }
  const all = rows.filter((r) => !opts.categories?.length || opts.categories.includes(r.category));
  res.scanned = all.length;

  const byCat = new Map<string, typeof all>();
  for (const r of all) (byCat.get(r.category) ?? byCat.set(r.category, []).get(r.category)!).push(r);

  for (const [category, catRows] of byCat) {
    const batches = makeBatches(catRows);
    log(`${category}: ${catRows.length} rows → ${batches.length} batch(es)`);
    for (const [bi, batch] of batches.entries()) {
      if (batch.length < 2) continue;
      res.batches += 1;
      if (opts.dryRun) continue;
      const items = batch.map((r, n) => ({ n, title: r.title, content: r.content.slice(0, 1200), category: r.category }));
      const ai = await consolidateKnowledgeBatch({ items, batchLabel: `${category}#${bi}`, userId: opts.userId ?? null, model: opts.model });
      if (!ai.ok) {
        res.errors.push(`${category}#${bi}: ${ai.error}`);
        continue;
      }
      for (const g of validGroups(ai.data.groups, batch.length)) {
        const members = g.member_ids.map((n) => batch[n]);
        const title = g.title.trim().slice(0, 200);
        const content = g.content.trim();
        if (!title || content.length < 20) continue;
        if (carriesHighPii(rules, title, content)) {
          res.dropped += 1;
          continue;
        }
        const memberTags = Array.from(new Set(members.flatMap((m) => m.tags ?? [])));
        const flagged = memberTags.includes("ต้องตรวจ privacy");
        const tags = Array.from(new Set([...(g.tags ?? []).slice(0, 6), sourceTag, CONSOLIDATED_TAG, ...(flagged ? ["ต้องตรวจ privacy"] : []), ...(g.confidence === "medium" ? ["ต้องยืนยัน"] : [])]));
        // Case lessons keep their own category (the normaliser has no "cases" bucket).
        const cat: string = category === "cases" ? "cases" : normalizeKnowledgeCategory(g.category || category);
        const memberCount = members.reduce((n, m) => n + Math.max(1, m.member_count ?? 1), 0);
        const { data: canon, error: iErr } = await svc
          .from("studio_knowledge_sources")
          .insert({
            title,
            content,
            summary: null,
            source_type: cat === "services" ? "service" : cat === "owner_experience" ? "owner_experience" : cat === "cases" ? "case" : "investigator_knowledge",
            category: cat,
            tags,
            sensitivity: members.some((m) => m.sensitivity === "confidential") || cat === "cases" ? "confidential" : "internal",
            approved_for_content: false,
            origin_ref: `consolidate:${ai.generationId ?? "n/a"}:${category}#${bi}`,
            is_demo: false,
            member_count: memberCount,
            created_by: opts.userId ?? null,
          })
          .select("id")
          .single();
        if (iErr || !canon) {
          res.errors.push(`${category}#${bi} insert: ${iErr?.message ?? "no row"}`);
          continue;
        }
        const { error: uErr } = await svc
          .from("studio_knowledge_sources")
          .update({ superseded_by: canon.id })
          .in("id", members.map((m) => m.id));
        if (uErr) res.errors.push(`${category}#${bi} supersede: ${uErr.message}`);
        res.groups += 1;
        res.merged += members.length;
      }
      log(`  batch ${bi + 1}/${batches.length}: groups so far ${res.groups}, merged ${res.merged}`);
    }
  }
  console.info(`[studio:consolidate] knowledge scanned=${res.scanned} batches=${res.batches} groups=${res.groups} merged=${res.merged} dropped=${res.dropped} errors=${res.errors.length}`);
  return res;
}

export async function consolidateQuestions(opts: ConsolidateOptions = {}): Promise<ConsolidateResult> {
  const svc = createServiceClient();
  const log = opts.onProgress ?? (() => {});
  const res: ConsolidateResult = { target: "questions", scanned: 0, batches: 0, groups: 0, merged: 0, dropped: 0, errors: [] };
  const rules = (await getStudioSettingsStrict()).privacy_rules;

  const { rows, error } = await fetchAll((from, to) =>
    svc
      .from("studio_customer_questions")
      .select("id, question, answer_hint, frequency, tags, normalized_key")
      .in("source", ["import", "line_oa"])
      .is("superseded_by", null)
      .eq("approved_for_content", false)
      .eq("is_demo", false)
      .order("normalized_key")
      .order("id")
      .range(from, to),
  );
  if (error) {
    res.errors.push(`load: ${error}`);
    return res;
  }
  const all = rows;
  res.scanned = all.length;
  const batches = makeBatches(all, 60);
  log(`questions: ${all.length} rows → ${batches.length} batch(es)`);
  for (const [bi, batch] of batches.entries()) {
    if (batch.length < 2) continue;
    res.batches += 1;
    if (opts.dryRun) continue;
    const items = batch.map((r, n) => ({ n, question: r.question, answer_hint: r.answer_hint, frequency: r.frequency }));
    const ai = await consolidateQuestionsBatch({ items, batchLabel: `q#${bi}`, userId: opts.userId ?? null, model: opts.model });
    if (!ai.ok) {
      res.errors.push(`q#${bi}: ${ai.error}`);
      continue;
    }
    for (const g of validGroups(ai.data.groups, batch.length)) {
      const members = g.member_ids.map((n) => batch[n]);
      const question = g.question.trim().slice(0, 500);
      const hint = g.answer_hint?.trim().slice(0, 1000) || null;
      if (!question) continue;
      if (carriesHighPii(rules, question, hint ?? "")) {
        res.dropped += 1;
        continue;
      }
      const freq = members.reduce((n, m) => n + (m.frequency ?? 1), 0);
      const tags = Array.from(new Set([...(g.tags ?? []).slice(0, 6), "line-import", CONSOLIDATED_TAG]));
      // Canonical key may collide with an existing active row (unique index) → merge into it instead.
      const key = normalizeQuestionKey(question) || null;
      const { data: canon, error: iErr } = await svc
        .from("studio_customer_questions")
        .insert({
          question,
          answer_hint: hint,
          frequency: freq,
          source: "import",
          tags,
          approved_for_content: false,
          is_demo: false,
          last_seen_at: new Date().toISOString(),
          normalized_key: key,
          member_count: members.length,
          created_by: opts.userId ?? null,
        })
        .select("id")
        .single();
      let canonId = canon?.id ?? null;
      if (iErr?.code === "23505" && key) {
        const { data: existing } = await svc.from("studio_customer_questions").select("id, frequency").eq("normalized_key", key).eq("is_demo", false).limit(1).maybeSingle();
        if (existing) {
          const extra = members.filter((m) => m.id !== existing.id).reduce((n, m) => n + (m.frequency ?? 1), 0);
          await svc.from("studio_customer_questions").update({ frequency: (existing.frequency ?? 1) + extra, member_count: members.length + 1 }).eq("id", existing.id);
          canonId = existing.id;
        }
      } else if (iErr || !canon) {
        res.errors.push(`q#${bi} insert: ${iErr?.message ?? "no row"}`);
        continue;
      }
      if (!canonId) continue;
      const { error: uErr } = await svc
        .from("studio_customer_questions")
        .update({ superseded_by: canonId })
        .in("id", members.map((m) => m.id).filter((id) => id !== canonId));
      if (uErr) res.errors.push(`q#${bi} supersede: ${uErr.message}`);
      res.groups += 1;
      res.merged += members.length;
    }
    log(`  batch ${bi + 1}/${batches.length}: groups so far ${res.groups}, merged ${res.merged}`);
  }
  console.info(`[studio:consolidate] questions scanned=${res.scanned} batches=${res.batches} groups=${res.groups} merged=${res.merged} dropped=${res.dropped} errors=${res.errors.length}`);
  return res;
}
