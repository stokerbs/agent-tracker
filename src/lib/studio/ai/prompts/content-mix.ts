import { PILLAR_META } from "@/lib/studio/constants";
import type { Pillar } from "@/lib/studio/types";

export interface ContentMixPromptInput {
  windowLabel: string;
  counts: Record<Pillar, number>;
  targets: { key: Pillar; target_pct: number }[];
  upcomingTitles: string[];
  knowledgeContext: string;
  /** Knowledge titles that have never been linked to any content. */
  unusedKnowledgeTitles: string[];
}

export function contentMixUserPrompt(input: ContentMixPromptInput): string {
  const total = Object.values(input.counts).reduce((a, b) => a + b, 0) || 1;
  const rows = input.targets
    .map((t) => `- ${PILLAR_META[t.key].labelEn} (${t.key}): ${input.counts[t.key] ?? 0} pieces = ${Math.round(((input.counts[t.key] ?? 0) / total) * 100)}% · target ${t.target_pct}%`)
    .join("\n");
  return `TASK: Review the content mix for ${input.windowLabel} and recommend 3 ideas that fix imbalance or use untouched knowledge.

CURRENT MIX
${rows}
Total pieces: ${total}

UPCOMING / RECENT TITLES
${input.upcomingTitles.length ? input.upcomingTitles.map((t) => `- ${t}`).join("\n") : "(none)"}

KNOWLEDGE NOT YET TURNED INTO CONTENT
${input.unusedKnowledgeTitles.length ? input.unusedKnowledgeTitles.map((t) => `- ${t}`).join("\n") : "(none)"}

KNOWLEDGE BLOCKS
${input.knowledgeContext || "(none)"}

RULES
- flags: only real imbalances (a pillar ≥ 15 points over target, or a pillar with 0 pieces while total ≥ 4). Thai, one sentence each.
- suggestions: exactly 3, each with pillar, Thai title, hook, reason, source_refs.
- unused_knowledge: pick from the list above that would make strong pieces (≤ 5).`;
}
