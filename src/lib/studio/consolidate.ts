import "server-only";

import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { consolidateKnowledgeBatch, consolidateQuestionsBatch } from "@/lib/studio/ai/actions/consolidate";
import { normalizeKnowledgeCategory } from "@/lib/studio/ai/prompts/chat-knowledge";
import { normalizeQuestionKey } from "@/lib/studio/faq-mining";
import { scrubText } from "@/lib/studio/privacy/scrub";
import { computeDelay, errorMessage, isTransientError, retryResult, sleepMs, withRetry, type RetryPolicy } from "@/lib/studio/retry";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import type { PrivacyRules } from "@/lib/studio/types";

/**
 * Consolidation of near-duplicate imported knowledge / customer questions.
 *
 * Pass structure (per category): rows sorted by title → batches of BATCH_SIZE
 * → AI groups same-point rows → one canonical row is inserted (tags:
 * line-import, consolidated; member_count) and members get superseded_by.
 * Running again picks up the new canonical rows + remaining singletons, so a
 * second pass merges across batch boundaries. A merged member is superseded
 * and never re-read, so re-running only costs the still-active rows.
 *
 * Everything stays approved_for_content = false; the owner approves the
 * canonical rows. Members remain for traceability (hidden by default).
 *
 * Resilience (offline runs pass `retry`): the settings load, page loads,
 * supersede updates and the AI batch call retry transient network/provider
 * failures with backoff. Canonical inserts are never blindly repeated: a
 * dropped response can hide a committed row, so a retry first looks the row
 * up and adopts it. When several batches in a row still fail transiently the
 * run throws ConsolidateAbortedError instead of burning through every
 * remaining batch; nothing is lost because a re-run only reads active rows.
 */

export const BATCH_SIZE = 45;
export const MIN_BATCH = 4;
export const CONSOLIDATED_TAG = "consolidated";
export const DEFAULT_MAX_CONSECUTIVE_TRANSIENT = 3;

type DbError = { message: string; code?: string };
type IdResult = { data: { id: string } | null; error: DbError | null };

export interface ConsolidateOptions {
  dryRun?: boolean;
  model?: string;
  userId?: string | null;
  categories?: string[];
  /** Only rows carrying this tag are considered (default: line-import). */
  sourceTag?: string;
  onProgress?: (msg: string) => void;
  /** Retry transient network/provider failures with backoff (offline scripts pass OFFLINE_RETRY). */
  retry?: RetryPolicy;
  /** Stop the run after this many consecutive batches fail transiently (default 3). */
  maxConsecutiveTransientFailures?: number;
  /** Injectable wait, for tests. */
  sleep?: (ms: number) => Promise<void>;
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

/** The network or provider stayed down across several batches: stopped early, partial result attached. */
export class ConsolidateAbortedError extends Error {
  readonly result: ConsolidateResult;
  constructor(message: string, result: ConsolidateResult) {
    super(message);
    this.name = "ConsolidateAbortedError";
    this.result = result;
  }
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

const NO_RETRY: RetryPolicy = { attempts: 1 };
/** Reads and idempotent writes may retry timeouts; only the billed AI call may not (it may have run). */
const dbRetryable = (err: unknown) => isTransientError(err, { allowTimeouts: true });

interface RunCtx {
  policy: RetryPolicy;
  sleep: (ms: number) => Promise<void>;
  label: string;
}

function ctxFor(opts: ConsolidateOptions, label: string): RunCtx {
  return { policy: opts.retry ?? NO_RETRY, sleep: opts.sleep ?? sleepMs, label };
}

function logRetry(label: string) {
  return ({ attempt, delayMs, error }: { attempt: number; delayMs: number; error: unknown }) =>
    console.warn(`[studio:consolidate] ${label}: transient failure (attempt ${attempt}), retrying in ${Math.round(delayMs / 1000)}s: ${errorMessage(error)}`);
}

/** Counts consecutive batches that failed on network/provider errors and stops the run past the limit. */
class TransientStreak {
  private count = 0;
  private readonly max: number;
  private readonly result: ConsolidateResult;
  constructor(max: number, result: ConsolidateResult) {
    this.max = Math.max(1, max);
    this.result = result;
  }
  record(batchFailedTransiently: boolean): void {
    if (!batchFailedTransiently) {
      this.count = 0;
      return;
    }
    this.count += 1;
    if (this.count >= this.max) {
      throw new ConsolidateAbortedError(`${this.result.target}: ${this.max} batches in a row failed on network or provider errors; stopped early, re-run to resume`, this.result);
    }
  }
}

/** Still fail-closed: once retries run out the strict loader's error propagates and nothing runs without the rules. */
async function loadRules(ctx: RunCtx): Promise<PrivacyRules> {
  const settings = await withRetry(() => getStudioSettingsStrict(), { policy: ctx.policy, sleep: ctx.sleep, isRetryable: dbRetryable, onRetry: logRetry(`${ctx.label} settings`) });
  return settings.privacy_rules;
}

/** Retry an idempotent read or write that reports failure as `{ error }` rather than throwing. */
function retryDb<R extends { error: DbError | null }>(ctx: RunCtx, what: string, fn: () => PromiseLike<R>): Promise<R> {
  return retryResult(fn, { policy: ctx.policy, sleep: ctx.sleep, isRetryable: dbRetryable, onRetry: logRetry(`${ctx.label} ${what}`) });
}

/** PostgREST caps a single request at 1000 rows — page through with .range(). */
async function fetchAll<T>(ctx: RunCtx, build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: DbError | null }>): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await retryDb(ctx, "load", () => build(from, from + PAGE - 1));
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

async function backoff(ctx: RunCtx, attempt: number, error: unknown): Promise<void> {
  const delayMs = computeDelay(ctx.policy, attempt);
  logRetry(`${ctx.label} insert`)({ attempt, delayMs, error });
  await ctx.sleep(delayMs);
}

/**
 * Insert a canonical row exactly once. A dropped response can hide an insert
 * that did commit, so every retry first looks the row up and adopts it; the
 * insert is only repeated after the lookup definitively finds nothing.
 */
async function insertOnce(ctx: RunCtx, insert: () => PromiseLike<IdResult>, lookup: () => PromiseLike<IdResult>): Promise<{ id: string | null; error: DbError | null }> {
  let lastError: DbError | null = null;
  for (let attempt = 1; attempt <= ctx.policy.attempts; attempt++) {
    if (attempt > 1) {
      const found = await lookup();
      if (found.data) return { id: found.data.id, error: null };
      if (found.error) {
        lastError = found.error;
        if (!dbRetryable(found.error) || attempt === ctx.policy.attempts) return { id: null, error: lastError };
        await backoff(ctx, attempt, found.error);
        continue;
      }
    }
    const { data, error } = await insert();
    if (!error && data) return { id: data.id, error: null };
    lastError = error ?? { message: "insert returned no row" };
    if (!dbRetryable(lastError) || attempt === ctx.policy.attempts) return { id: null, error: lastError };
    await backoff(ctx, attempt, lastError);
  }
  return { id: null, error: lastError };
}

/** Re-scrub canonical text: "drop" on identifiers, "flag" when softer findings (names, dates) remain. */
function judgeCanonical(rules: PrivacyRules, ...fields: string[]): "ok" | "flag" | "drop" {
  const findings = scrubText({ fields: Object.fromEntries(fields.map((f, i) => [`f${i}`, f])), rules });
  if (findings.some((f) => f.severity === "high" || f.kind === "denylist")) return "drop";
  return findings.length ? "flag" : "ok";
}
const REVIEW_TAG = "ต้องตรวจ privacy";
/** Model-supplied tags: same bounds as the manual form (≤ 6 tags, ≤ 40 chars each). */
function cleanTags(tags: string[] | undefined): string[] {
  return (tags ?? []).map((t) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 6);
}

export async function consolidateKnowledge(opts: ConsolidateOptions = {}): Promise<ConsolidateResult> {
  const svc = createServiceClient();
  const log = opts.onProgress ?? (() => {});
  const res: ConsolidateResult = { target: "knowledge", scanned: 0, batches: 0, groups: 0, merged: 0, dropped: 0, errors: [] };
  const ctx = ctxFor(opts, "knowledge");
  const rules = await loadRules(ctx);
  const sourceTag = opts.sourceTag ?? "line-import";
  // Makes every canonical origin_ref unique per run and group, so a retry can find its own committed row.
  const runTag = randomUUID().slice(0, 8);
  const streak = new TransientStreak(opts.maxConsecutiveTransientFailures ?? DEFAULT_MAX_CONSECUTIVE_TRANSIENT, res);

  const { rows, error } = await fetchAll(ctx, (from, to) =>
    svc
      .from("studio_knowledge_sources")
      .select("id, title, content, category, tags, member_count, sensitivity")
      .contains("tags", [sourceTag])
      .is("superseded_by", null)
      .eq("approved_for_content", false)
      .neq("sensitivity", "restricted")
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
      const ai = await consolidateKnowledgeBatch({ items, batchLabel: `${category}#${bi}`, userId: opts.userId ?? null, model: opts.model, retry: opts.retry });
      if (!ai.ok) {
        res.errors.push(`${category}#${bi}: ${ai.error}`);
        streak.record(ai.transient === true);
        continue;
      }
      let batchTransient = false;
      for (const [gi, g] of validGroups(ai.data.groups, batch.length).entries()) {
        const members = g.member_ids.map((n) => batch[n]);
        const title = g.title.trim().slice(0, 200);
        const content = g.content.trim();
        if (!title || content.length < 20) continue;
        const verdict = judgeCanonical(rules, title, content);
        if (verdict === "drop") {
          res.dropped += 1;
          continue;
        }
        const memberTags = Array.from(new Set(members.flatMap((m) => m.tags ?? [])));
        const flagged = verdict === "flag" || memberTags.includes(REVIEW_TAG);
        const tags = Array.from(new Set([...cleanTags(g.tags), sourceTag, CONSOLIDATED_TAG, ...(flagged ? [REVIEW_TAG] : []), ...(g.confidence === "medium" ? ["ต้องยืนยัน"] : [])]));
        // Case lessons keep their own category (the normaliser has no "cases" bucket).
        const cat: string = category === "cases" ? "cases" : normalizeKnowledgeCategory(g.category || category);
        const memberCount = members.reduce((n, m) => n + Math.max(1, m.member_count ?? 1), 0);
        const originRef = `consolidate:${ai.generationId ?? "n/a"}:${category}#${bi}~${runTag}g${gi}`;
        const row = {
          title,
          content,
          summary: null,
          source_type: cat === "services" ? "service" : cat === "owner_experience" ? "owner_experience" : cat === "cases" ? "case" : "investigator_knowledge",
          category: cat,
          tags,
          sensitivity: members.some((m) => m.sensitivity === "confidential") || cat === "cases" ? "confidential" : "internal",
          approved_for_content: false,
          origin_ref: originRef,
          is_demo: false,
          member_count: memberCount,
          created_by: opts.userId ?? null,
        };
        const ins = await insertOnce(
          ctx,
          () => svc.from("studio_knowledge_sources").insert(row).select("id").single(),
          () => svc.from("studio_knowledge_sources").select("id").eq("origin_ref", originRef).is("superseded_by", null).limit(1).maybeSingle(),
        );
        if (ins.error || !ins.id) {
          res.errors.push(`${category}#${bi} insert: ${ins.error?.message ?? "no row"}`);
          if (ins.error && dbRetryable(ins.error)) batchTransient = true;
          continue;
        }
        const canonId: string = ins.id;
        const memberIds = members.map((m) => m.id);
        const { error: uErr } = await retryDb(ctx, "supersede", () =>
          svc.from("studio_knowledge_sources").update({ superseded_by: canonId }).in("id", memberIds).eq("approved_for_content", false).is("superseded_by", null),
        );
        if (uErr) {
          res.errors.push(`${category}#${bi} supersede: ${uErr.message}`);
          if (dbRetryable(uErr)) batchTransient = true;
        }
        res.groups += 1;
        res.merged += members.length;
      }
      streak.record(batchTransient);
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
  const ctx = ctxFor(opts, "questions");
  const rules = await loadRules(ctx);
  const streak = new TransientStreak(opts.maxConsecutiveTransientFailures ?? DEFAULT_MAX_CONSECUTIVE_TRANSIENT, res);

  const { rows, error } = await fetchAll(ctx, (from, to) =>
    svc
      .from("studio_customer_questions")
      .select("id, question, answer_hint, frequency, tags, normalized_key, member_count")
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
    const ai = await consolidateQuestionsBatch({ items, batchLabel: `q#${bi}`, userId: opts.userId ?? null, model: opts.model, retry: opts.retry });
    if (!ai.ok) {
      res.errors.push(`q#${bi}: ${ai.error}`);
      streak.record(ai.transient === true);
      continue;
    }
    let batchTransient = false;
    for (const g of validGroups(ai.data.groups, batch.length)) {
      const members = g.member_ids.map((n) => batch[n]);
      const question = g.question.trim().slice(0, 500);
      const hint = g.answer_hint?.trim().slice(0, 1000) || null;
      if (!question) continue;
      const verdict = judgeCanonical(rules, question, hint ?? "");
      if (verdict === "drop") {
        res.dropped += 1;
        continue;
      }
      const freq = members.reduce((n, m) => n + (m.frequency ?? 1), 0);
      const memberCount = members.reduce((n, m) => n + Math.max(1, m.member_count ?? 1), 0);
      const memberTags = members.flatMap((m) => m.tags ?? []);
      const tags = Array.from(new Set([...cleanTags(g.tags), "line-import", CONSOLIDATED_TAG, ...(verdict === "flag" || memberTags.includes(REVIEW_TAG) ? [REVIEW_TAG] : [])]));
      // Canonical key may collide with an existing ACTIVE row (unique index, 0116) → merge into it instead.
      const key = normalizeQuestionKey(question) || null;
      const row = {
        question,
        answer_hint: hint,
        frequency: freq,
        source: "import",
        tags,
        approved_for_content: false,
        is_demo: false,
        last_seen_at: new Date().toISOString(),
        normalized_key: key,
        member_count: memberCount,
        created_by: opts.userId ?? null,
      };
      const lookupCommitted = (): PromiseLike<IdResult> => {
        if (!key) return Promise.resolve({ data: null, error: { message: "cannot verify a dropped insert without a normalized key" } });
        return svc
          .from("studio_customer_questions")
          .select("id, frequency, member_count, tags")
          .eq("normalized_key", key)
          .eq("is_demo", false)
          .is("superseded_by", null)
          .limit(1)
          .maybeSingle()
          .then((r) => ({
            // One active row per key (0116): it is ours only if it carries exactly what this group wrote.
            data: r.data && (r.data.tags ?? []).includes(CONSOLIDATED_TAG) && r.data.frequency === freq && r.data.member_count === memberCount ? { id: r.data.id } : null,
            error: r.error,
          }));
      };
      const ins = await insertOnce(ctx, () => svc.from("studio_customer_questions").insert(row).select("id").single(), lookupCommitted);
      let canonId = ins.id;
      if (ins.error?.code === "23505" && key) {
        // The winner must be active (0116 index is partial on superseded_by IS NULL); never merge into a hidden row.
        const { data: existing, error: eErr } = await retryDb(ctx, "collision lookup", () =>
          svc
            .from("studio_customer_questions")
            .select("id, frequency, member_count, approved_for_content")
            .eq("normalized_key", key)
            .eq("is_demo", false)
            .is("superseded_by", null)
            .limit(1)
            .maybeSingle(),
        );
        if (eErr || !existing) {
          res.errors.push(`q#${bi} collision lookup: ${eErr?.message ?? "no active row"}`);
          if (eErr && dbRetryable(eErr)) batchTransient = true;
          continue;
        }
        if (existing.approved_for_content) {
          // Owner already reviewed this question — leave it and its members untouched for manual review.
          res.errors.push(`q#${bi} skipped: canonical collides with an approved question`);
          continue;
        }
        const others = members.filter((m) => m.id !== existing.id);
        const extraFreq = others.reduce((n, m) => n + (m.frequency ?? 1), 0);
        const extraMembers = others.reduce((n, m) => n + Math.max(1, m.member_count ?? 1), 0);
        // Not retried: adding to frequency is not idempotent, so a repeat after a dropped response could double-count.
        const { error: mErr } = await svc
          .from("studio_customer_questions")
          .update({ frequency: (existing.frequency ?? 1) + extraFreq, member_count: Math.max(1, existing.member_count ?? 1) + extraMembers, last_seen_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (mErr) {
          res.errors.push(`q#${bi} collision merge: ${mErr.message}`);
          if (dbRetryable(mErr)) batchTransient = true;
          continue;
        }
        canonId = existing.id;
      } else if (ins.error || !ins.id) {
        res.errors.push(`q#${bi} insert: ${ins.error?.message ?? "no row"}`);
        if (ins.error && dbRetryable(ins.error)) batchTransient = true;
        continue;
      }
      if (!canonId) continue;
      const target: string = canonId;
      const memberIds = members.map((m) => m.id).filter((id) => id !== target);
      const { error: uErr } = await retryDb(ctx, "supersede", () => svc.from("studio_customer_questions").update({ superseded_by: target }).in("id", memberIds));
      if (uErr) {
        res.errors.push(`q#${bi} supersede: ${uErr.message}`);
        if (dbRetryable(uErr)) batchTransient = true;
      }
      res.groups += 1;
      res.merged += members.length;
    }
    streak.record(batchTransient);
    log(`  batch ${bi + 1}/${batches.length}: groups so far ${res.groups}, merged ${res.merged}`);
  }
  console.info(`[studio:consolidate] questions scanned=${res.scanned} batches=${res.batches} groups=${res.groups} merged=${res.merged} dropped=${res.dropped} errors=${res.errors.length}`);
  return res;
}
