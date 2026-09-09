import type { PrivacyFinding } from "@/lib/studio/types";

export interface PrivacyPromptInput {
  fields: Record<string, string | null | undefined>;
  deterministicFindings: PrivacyFinding[];
  denylist: string[];
}

export function privacySystemAddendum(): string {
  return `You are now acting as the Content Safety / Privacy reviewer for Detective Pulse. Your only job is to decide whether this content could identify a real client, subject, staff member, vehicle, address or specific case. You are conservative: when in doubt → review_required. You never rewrite content with invented details; your suggestions only generalise.`;
}

export function privacyUserPrompt(input: PrivacyPromptInput): string {
  const fields = Object.entries(input.fields)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `--- ${k} ---\n${v}`)
    .join("\n\n");
  return `CONTENT TO REVIEW
${fields || "(empty)"}

DETERMINISTIC SCAN ALREADY FOUND
${input.deterministicFindings.length ? input.deterministicFindings.map((f) => `- [${f.severity}] ${f.kind} in ${f.field ?? "?"}: "${f.excerpt}" — ${f.reason}`).join("\n") : "(nothing)"}
${input.denylist.length ? `\nOWNER DENYLIST (must never appear): ${input.denylist.join(", ")}` : ""}

CHECK FOR (beyond the regex scan)
- Real-looking personal names or nicknames (Thai or foreign), including initials that read as a real person.
- Precise or unusual location details (specific condo/hotel/restaurant/soi names, landmarks that pin down a place).
- Company or employer names where inappropriate.
- Date/time combinations that could match a real event.
- Story specifics so unusual they would identify the case to someone involved.
- Photo references to identifiable people.
- Operational detail that would compromise investigator safety.

VERDICT
- "blocked": a real identifier is present or the piece cannot be told safely.
- "review_required": borderline specifics the owner should judge.
- "safe": generalised, nothing identifying.
Write summary and reasons in Thai. generalisation_suggestions must not add new invented facts.`;
}
