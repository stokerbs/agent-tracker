import { PILLAR_META } from "@/lib/studio/constants";
import type { Pillar, Platform } from "@/lib/studio/types";

export interface IdeasPromptInput {
  brief: string;
  count: number;
  pillar?: Pillar | null;
  platforms?: Platform[];
  tone?: string | null;
  /** Titles already in the Idea Bank / calendar to avoid duplicates. */
  existingTitles: string[];
  knowledgeContext: string;
}

const PILLAR_GUIDE = (Object.keys(PILLAR_META) as Pillar[])
  .map((k) => `- ${k}: ${PILLAR_META[k].labelEn} — ${PILLAR_META[k].description}`)
  .join("\n");

export function ideasUserPrompt(input: IdeasPromptInput): string {
  return `TASK: Propose ${input.count} content ideas for Detective Pulse.

BRIEF FROM THE OWNER
${input.brief.trim() || "(no specific brief — pick the strongest knowledge-backed ideas)"}
${input.pillar ? `\nPILLAR FOCUS: ${input.pillar}` : ""}${input.platforms?.length ? `\nPLATFORMS: ${input.platforms.join(", ")}` : ""}${input.tone ? `\nTONE: ${input.tone}` : ""}

CONTENT PILLARS
${PILLAR_GUIDE}

KNOWLEDGE BLOCKS (approved Detective Pulse knowledge — build from these; cite ids)
${input.knowledgeContext || "(no matching knowledge blocks — every idea must then cite \"ai_general\" and list the topic under knowledge_gaps)"}

ALREADY EXISTS (do not duplicate these angles)
${input.existingTitles.length ? input.existingTitles.map((t) => `- ${t}`).join("\n") : "(none)"}

RULES
- Each idea must have a specific, concrete angle a viewer can learn from — not a generic topic.
- Prefer ideas grounded in knowledge blocks. Ideas that rely on general knowledge must cite "ai_general".
- Vary pillars unless a pillar focus was given; vary formats where sensible.
- Scores are your estimates (1–5), not measured data.
- Titles, hooks and descriptions in Thai.`;
}
