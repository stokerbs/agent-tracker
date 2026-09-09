import { z } from "zod/v4";
import { PILLAR_ENUM } from "./schemas";

/**
 * Bulk chat-history → knowledge extraction (offline import of LINE OA exports).
 * One transcript window per call. Everything the model returns must be
 * identity-free; the importer re-scrubs and drops anything that still carries
 * an identifier.
 */

export const ChatKnowledgeSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe("Canonical customer question, Thai, generalised"),
      answer_hint: z.string().nullable().describe("How the investigator actually answered, generalised — no prices/guarantees unless stated as policy"),
      frequency: z.number().describe("How many times a variant appears in this window"),
      tags: z.array(z.string()),
    }),
  ),
  knowledge: z.array(
    z.object({
      title: z.string().describe("Short Thai title of the reusable insight (≤ 80 chars)"),
      content: z.string().describe("The investigator's real explanation/experience, rewritten as standalone knowledge (Thai, 2–8 sentences). No names, places, dates, plates, numbers that identify."),
      // Kept as a free string: models occasionally emit a near-miss label and a
      // strict enum makes the SDK reject the WHOLE window. Normalised in code.
      category: z.string().describe("One of: investigator_knowledge, owner_experience, services, surveillance, gps, osint, technology, other"),
      tags: z.array(z.string()),
      evidence: z.enum(["stated_by_investigator", "implied", "customer_claim"]).describe("stated_by_investigator = the นักสืบ side said it explicitly"),
    }),
  ),
  case_lessons: z.array(
    z.object({
      title: z.string(),
      situation: z.string().describe("Generalised situation (ลูกค้ารายหนึ่ง…)"),
      lesson: z.string(),
      pillar: PILLAR_ENUM,
      privacy_status: z.enum(["safe", "review_required", "blocked"]),
    }),
  ),
  service_facts: z.array(
    z.object({ fact: z.string().describe("Operational/service fact stated by the investigator (process, timing, payment terms, coverage)"), confidence: z.enum(["stated", "implied"]) }),
  ),
});
export type ChatKnowledgeOutput = z.infer<typeof ChatKnowledgeSchema>;

export const KNOWLEDGE_CATEGORIES_ALLOWED = ["investigator_knowledge", "owner_experience", "services", "surveillance", "gps", "osint", "technology", "other"] as const;
export type KnowledgeCategoryOut = (typeof KNOWLEDGE_CATEGORIES_ALLOWED)[number];

/** Map a model-emitted category label onto the DB CHECK-constraint set. */
export function normalizeKnowledgeCategory(raw: string): KnowledgeCategoryOut {
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((KNOWLEDGE_CATEGORIES_ALLOWED as readonly string[]).includes(v)) return v as KnowledgeCategoryOut;
  if (/surveil|เฝ้า|ติดตาม|stakeout/.test(v)) return "surveillance";
  if (/gps|tracker/.test(v)) return "gps";
  if (/osint|online|social|digital|cyber/.test(v)) return "osint";
  if (/service|pricing|payment|process|ราคา|บริการ/.test(v)) return "services";
  if (/owner|experience|business|lesson/.test(v)) return "owner_experience";
  if (/tech|tool|equipment|camera/.test(v)) return "technology";
  if (/investigat|evidence|legal|law|knowledge|case/.test(v)) return "investigator_knowledge";
  return "other";
}

export function chatKnowledgeSystemAddendum(): string {
  return `You are now extracting REUSABLE KNOWLEDGE from historical LINE chat transcripts between Detective Pulse (labelled "นักสืบ") and prospective customers ("ลูกค้า"). The transcript is already PII-redacted with tokens like [เบอร์โทร], [ชื่อ]. Your output feeds an internal knowledge base that a human reviews before anything becomes public content.`;
}

export function chatKnowledgeUserPrompt(input: { transcript: string }): string {
  return `TRANSCRIPT WINDOW
${input.transcript}

EXTRACT (Thai output):
1. questions — recurring or notable customer questions, canonical form, with how the investigator answered (answer_hint). Skip greetings/thanks/scheduling chatter.
2. knowledge — what the นักสืบ side explains that is reusable: how investigations work, limitations, what evidence matters, legal boundaries, how to prepare, why something failed. Only include what the investigator actually said or clearly implied (mark evidence). Do NOT invent. Write each as standalone knowledge a new staff member could read.
3. case_lessons — if a specific engagement is discussed with an outcome, extract the generalised lesson (no identifiers, no dates, no places). Mark privacy_status honestly.
4. service_facts — process/payment/coverage/timing facts stated by the investigator (e.g. deposit before start, report delivery method).

LIMITS (keep output tight — this runs over thousands of windows)
- At most 6 knowledge items, 8 questions, 3 case_lessons, 6 service_facts per window. Prefer fewer, stronger items over many weak ones. No duplicates of near-identical points.
- knowledge.content 2–5 sentences; answer_hint ≤ 2 sentences.

RULES
- Zero identifiers in output: no names/nicknames (even redacted tokens — drop them), phone numbers, plates, addresses, venues, companies, exact dates, ages. Generalise ("ลูกค้ารายหนึ่ง", "ย่านหนึ่ง", "ช่วงเช้า").
- Do not copy the customer's personal story as knowledge; extract the investigator's expertise.
- Empty arrays are fine when the window is only small talk.`;
}
