import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { Pillar, SourceKind } from "@/lib/studio/types";

/**
 * Knowledge retrieval for content generation.
 *
 * V1 = keyword retrieval over APPROVED rows only (studio_knowledge_sources,
 * studio_case_insights, studio_customer_questions), scored by term hits.
 * The return shape is what a future pgvector `match_studio_knowledge()` RPC
 * will also return, so swapping the retriever does not touch prompts.
 *
 * Uses the service client because it runs inside server-only AI paths that
 * are already admin-gated by the calling server action. It NEVER reads
 * studio_cases raw fields or the operations `cases` table.
 */

export interface KnowledgeHit {
  kind: SourceKind;
  id: string;
  title: string;
  /** Text that goes into the prompt (already content-safe by approval). */
  text: string;
  tags: string[];
  score: number;
}

export interface SearchOptions {
  limit?: number;
  pillar?: Pillar | null;
  /** Restrict to some kinds (default: all three). */
  kinds?: SourceKind[];
}

const PILLAR_HINTS: Record<Pillar, string[]> = {
  detective_knowledge: ["สืบ", "หลักฐาน", "เฝ้า", "ติดตาม", "gps", "นักสืบ"],
  case_story: ["เคส", "บทเรียน", "สถานการณ์", "ลูกค้า"],
  detective_pov: ["สังเกต", "มุมมอง", "ตัดสินใจ", "ประสบการณ์"],
  red_flags: ["สัญญาณ", "น่าสงสัย", "หลอก", "ระวัง", "โกง"],
  behind_investigation: ["เครื่องมือ", "กล้อง", "วางแผน", "osint", "ทีม"],
  service: ["บริการ", "ราคา", "ค่าใช้จ่าย", "ติดต่อ", "ขั้นตอน", "ระยะเวลา"],
};

/** Split a Thai/English query into search terms (Thai has no spaces; keep long tokens). */
export function tokenizeQuery(query: string): string[] {
  const raw = query
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const STOP = ["สร้าง", "คอนเทนต์", "เรื่อง", "สำหรับ", "อาทิตย์", "สัปดาห์", "หน้า", "เน้น", "ขอ", "คลิป", "ให้", "และ", "กับ", "the", "for", "and", "content", "with"];
  const STOP_SET = new Set(STOP);
  // Thai has no word spaces, so a token like "เน้นงานนอกใจ" carries a leading
  // stop word — peel known stop-word prefixes off before filtering.
  const peel = (t: string): string => {
    let cur = t;
    let changed = true;
    while (changed) {
      changed = false;
      for (const s of STOP) {
        if (cur.length > s.length && cur.startsWith(s)) {
          cur = cur.slice(s.length);
          changed = true;
        }
      }
    }
    return cur;
  };
  return Array.from(new Set(raw.map(peel).filter((t) => t.length >= 2 && !STOP_SET.has(t)))).slice(0, 12);
}

function scoreText(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (lower.includes(t)) score += t.length >= 4 ? 2 : 1;
  }
  return score;
}

export async function searchKnowledge(query: string, opts: SearchOptions = {}): Promise<KnowledgeHit[]> {
  const limit = opts.limit ?? 8;
  const kinds = opts.kinds ?? ["knowledge", "case_insight", "customer_question"];
  const terms = tokenizeQuery(query);
  if (opts.pillar) terms.push(...PILLAR_HINTS[opts.pillar]);
  const svc = createServiceClient();

  const hits: KnowledgeHit[] = [];
  const orFilter = (cols: string[]) =>
    terms.length ? terms.flatMap((t) => cols.map((c) => `${c}.ilike.%${t.replace(/[%_,()]/g, "")}%`)).join(",") : null;

  const tasks: Promise<void>[] = [];

  if (kinds.includes("knowledge")) {
    tasks.push(
      (async () => {
        let q = svc
          .from("studio_knowledge_sources")
          .select("id, title, content, summary, tags")
          .eq("approved_for_content", true)
          .neq("sensitivity", "restricted") // defence-in-depth: restricted never reaches prompts
          .limit(40);
        const f = orFilter(["title", "content"]);
        if (f) q = q.or(f);
        const { data, error } = await q;
        if (error) {
          console.warn("[studio:search] knowledge query failed:", error.message);
          return;
        }
        for (const r of data ?? []) {
          hits.push({
            kind: "knowledge",
            id: r.id,
            title: r.title,
            text: (r.summary?.trim() || r.content).slice(0, 1500),
            tags: r.tags ?? [],
            score: scoreText(`${r.title} ${r.content} ${(r.tags ?? []).join(" ")}`, terms) + 1,
          });
        }
      })(),
    );
  }

  if (kinds.includes("case_insight")) {
    tasks.push(
      (async () => {
        let q = svc
          .from("studio_case_insights")
          .select("id, title, insight, lesson, content_angle, pillar")
          .eq("approved_for_content", true)
          .eq("privacy_status", "safe")
          .limit(40);
        const f = orFilter(["title", "insight", "lesson"]);
        if (f) q = q.or(f);
        const { data, error } = await q;
        if (error) {
          console.warn("[studio:search] insights query failed:", error.message);
          return;
        }
        for (const r of data ?? []) {
          const text = [r.insight, r.lesson ? `บทเรียน: ${r.lesson}` : null, r.content_angle ? `มุมคอนเทนต์: ${r.content_angle}` : null]
            .filter(Boolean)
            .join("\n");
          hits.push({
            kind: "case_insight",
            id: r.id,
            title: r.title,
            text: text.slice(0, 1500),
            tags: r.pillar ? [r.pillar] : [],
            score: scoreText(`${r.title} ${text}`, terms) + (opts.pillar && r.pillar === opts.pillar ? 2 : 1),
          });
        }
      })(),
    );
  }

  if (kinds.includes("customer_question")) {
    tasks.push(
      (async () => {
        let q = svc
          .from("studio_customer_questions")
          .select("id, question, answer_hint, frequency, tags")
          .eq("approved_for_content", true)
          .order("frequency", { ascending: false })
          .limit(30);
        const f = orFilter(["question", "answer_hint"]);
        if (f) q = q.or(f);
        const { data, error } = await q;
        if (error) {
          console.warn("[studio:search] questions query failed:", error.message);
          return;
        }
        for (const r of data ?? []) {
          hits.push({
            kind: "customer_question",
            id: r.id,
            title: r.question,
            text: r.answer_hint ? `คำถาม: ${r.question}\nแนวคำตอบ: ${r.answer_hint}` : `คำถาม: ${r.question}`,
            tags: r.tags ?? [],
            score: scoreText(`${r.question} ${r.answer_hint ?? ""}`, terms) + Math.min(3, Math.log2(r.frequency + 1)),
          });
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Format hits as numbered context blocks the model can cite as [K1], [K2]… */
export function formatKnowledgeContext(hits: KnowledgeHit[]): { context: string; refs: Record<string, KnowledgeHit> } {
  const refs: Record<string, KnowledgeHit> = {};
  const lines = hits.map((h, i) => {
    const key = `K${i + 1}`;
    refs[key] = h;
    const kindLabel = h.kind === "knowledge" ? "คลังความรู้" : h.kind === "case_insight" ? "บทเรียนจากเคส (ไม่ระบุตัวตน)" : "คำถามลูกค้า";
    return `[${key}] (${kindLabel}) ${h.title}\n${h.text}`;
  });
  return { context: lines.join("\n\n"), refs };
}
