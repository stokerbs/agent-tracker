import { z } from "zod/v4";

/**
 * Consolidation: merge near-duplicate knowledge rows (or customer questions)
 * from the bulk chat import into one canonical row each. Input is a numbered
 * batch; output = groups with ≥ 2 members plus the merged canonical text.
 * Singletons are simply not returned.
 */

export const ConsolidateKnowledgeSchema = z.object({
  groups: z.array(
    z.object({
      member_ids: z.array(z.number()).describe("Indexes [n] of the rows merged into this group (2 or more)"),
      title: z.string().describe("Canonical Thai title, ≤ 80 chars"),
      content: z.string().describe("Merged knowledge, Thai, 3–8 sentences: keep every distinct point, drop repetition, no identifiers"),
      category: z.string().describe("Most fitting category from the members"),
      tags: z.array(z.string()),
      confidence: z.enum(["high", "medium"]).describe("high = clearly the same point; medium = related but merged"),
    }),
  ),
});
export type ConsolidateKnowledgeOutput = z.infer<typeof ConsolidateKnowledgeSchema>;

export const ConsolidateQuestionsSchema = z.object({
  groups: z.array(
    z.object({
      member_ids: z.array(z.number()),
      question: z.string().describe("Canonical question in natural Thai as a customer would ask it"),
      answer_hint: z.string().nullable().describe("Best merged answer hint from the members (generalised, no prices unless stated as policy)"),
      tags: z.array(z.string()),
    }),
  ),
});
export type ConsolidateQuestionsOutput = z.infer<typeof ConsolidateQuestionsSchema>;

export function consolidateSystemAddendum(): string {
  return `You are now DEDUPLICATING an internal knowledge base. Rows came from thousands of real chat transcripts, so the same insight appears many times in slightly different words. Merge only rows that make the SAME point (or the same customer question); never merge different topics just because they share a word. Output stays identity-free.`;
}

export function consolidateKnowledgeUserPrompt(items: { n: number; title: string; content: string; category: string }[]): string {
  return `ROWS (same knowledge category, sorted by title)
${items.map((i) => `[${i.n}] (${i.category}) ${i.title}\n${i.content}`).join("\n\n")}

TASK: return groups of rows that express the same reusable insight (2+ members each) with a merged canonical title/content that preserves every distinct detail. Rows that stand alone must NOT appear in any group. Do not invent facts. Thai output.`;
}

export function consolidateQuestionsUserPrompt(items: { n: number; question: string; answer_hint: string | null; frequency: number }[]): string {
  return `QUESTIONS (sorted; frequency = how often customers asked)
${items.map((i) => `[${i.n}] (×${i.frequency}) ${i.question}${i.answer_hint ? `\n   → ${i.answer_hint}` : ""}`).join("\n")}

TASK: return groups of questions that ask the same thing (2+ members each) with one canonical question and the best merged answer hint. Questions that stand alone must NOT appear in any group. Thai output.`;
}
