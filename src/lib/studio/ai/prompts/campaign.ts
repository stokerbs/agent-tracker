import { PILLAR_META } from "@/lib/studio/constants";
import type { Pillar, Platform } from "@/lib/studio/types";

export interface CampaignPromptInput {
  request: string;
  defaultPlatforms: Platform[];
  pillarTargets: { key: Pillar; target_pct: number }[];
  recentMix: Record<Pillar, number>;
  existingTitles: string[];
  knowledgeContext: string;
  /** Refinement instruction on a previous proposal, if any. */
  refine?: { previousIdeas: string[]; instruction: string } | null;
}

export function campaignUserPrompt(input: CampaignPromptInput): string {
  const targets = input.pillarTargets.map((p) => `- ${p.key} (${PILLAR_META[p.key].labelEn}): target ${p.target_pct}% · last 30 days ${input.recentMix[p.key] ?? 0}%`).join("\n");
  return `TASK: Interpret the owner's request and return a campaign proposal.

OWNER REQUEST (Thai, informal)
"${input.request.trim()}"

STEP 1 — INTERPRET into: objective, audience, platforms, pillar focus, tone, post_count, CTA.
- If the request does not state a number, default post_count = 5.
- If no platform is named, use the studio defaults: ${input.defaultPlatforms.join(", ")}.
- If the request names a topic like "งานนอกใจ", "จับชู้", "GPS", map it to the right pillars (usually a mix of detective_knowledge + case_story + detective_pov + one service piece).

STEP 2 — PROPOSE exactly post_count ideas, ranked strongest first. Each idea needs a hook, description, pillar, platforms, format, source_refs (knowledge block ids used) and estimate scores.

PILLAR BALANCE (use to avoid over-representing one pillar)
${targets}

KNOWLEDGE BLOCKS (approved Detective Pulse knowledge — cite ids)
${input.knowledgeContext || "(no matching knowledge blocks — cite \"ai_general\" and list topics under knowledge_gaps)"}

ALREADY EXISTS (avoid duplicating)
${input.existingTitles.length ? input.existingTitles.map((t) => `- ${t}`).join("\n") : "(none)"}
${input.refine ? `\nREFINEMENT\nThe owner saw this proposal:\n${input.refine.previousIdeas.map((t, i) => `${i + 1}. ${t}`).join("\n")}\nand asked: "${input.refine.instruction}". Apply that instruction; keep what they did not ask to change.` : ""}

Write everything the owner reads in Thai. Title the campaign briefly.`;
}
