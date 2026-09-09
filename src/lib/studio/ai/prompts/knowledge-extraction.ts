export interface CaseInsightsPromptInput {
  caseCode: string;
  caseType: string;
  title: string;
  situation: string | null;
  objective: string | null;
  method: string | null;
  observations: string | null;
  outcome: string | null;
  lessons: string | null;
  interestingInsight: string | null;
}

/**
 * Case → insights. NOTE: the caller passes the STUDIO case record (already a
 * generalised knowledge record written by staff), never the operations case.
 */
export function caseInsightsUserPrompt(c: CaseInsightsPromptInput): string {
  return `TASK: Extract content-safe insights from this internal case record, and write a fully anonymised version.

CASE RECORD (internal — treat every specific as sensitive)
- Code: ${c.caseCode} · Type: ${c.caseType}
- Title: ${c.title}
- สถานการณ์: ${c.situation ?? "-"}
- วัตถุประสงค์: ${c.objective ?? "-"}
- วิธีสืบ: ${c.method ?? "-"}
- สิ่งที่พบ: ${c.observations ?? "-"}
- ผลลัพธ์: ${c.outcome ?? "-"}
- บทเรียน: ${c.lessons ?? "-"}
- จุดที่น่าสนใจ: ${c.interestingInsight ?? "-"}

RULES
- Produce 2–5 insights. Each = a lesson a viewer can learn, NOT a retelling of the case.
- Remove or generalise: names, nicknames, phone numbers, plates, addresses, exact dates/times, company names, specific venues, identifying photos, unusual details that would identify the people involved.
- Do NOT invent replacement details. Generalise ("ย่านหนึ่ง", "ช่วงเช้า", "รถคันหนึ่ง").
- Set privacy_status honestly: "blocked" if the insight cannot be told without identifying, "review_required" if borderline, "safe" if fully generalised.
- Never describe operational tradecraft that would endanger investigators or reveal how an active surveillance is run.
- Thai output.`;
}

export function faqExtractUserPrompt(input: { pastedText: string; source: string }): string {
  return `TASK: Mine recurring customer questions from the pasted conversation excerpts (source: ${input.source}).

EXCERPTS (may contain customer identities — you MUST NOT copy any name, phone, LINE id, or personal detail into the output)
${input.pastedText.slice(0, 20000)}

RULES
- Group paraphrases into one canonical question (Thai). Count frequency.
- answer_hint = how Detective Pulse generally answers, without prices/guarantees (e.g. "ขึ้นกับความซับซ้อน ต้องประเมินก่อน").
- Suggest one content_idea per question.
- Output must contain zero personal identifiers.`;
}
