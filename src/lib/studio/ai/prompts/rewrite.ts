export type RewriteMode =
  | "rewrite_hook"
  | "shorten"
  | "more_viral"
  | "more_professional"
  | "more_natural_thai"
  | "alternative_version"
  | "custom";

export const REWRITE_MODE_META: Record<RewriteMode, { label: string; instruction: string }> = {
  rewrite_hook: { label: "เขียน Hook ใหม่", instruction: "Rewrite ONLY the hook: sharper tension in the first 3 seconds, concrete, ≤ 2 short lines. Keep the meaning of the piece." },
  shorten: { label: "ย่อให้สั้นลง", instruction: "Cut length by roughly 30–40% without losing the core insight or the CTA. Remove filler, merge sentences, keep the hook." },
  more_viral: { label: "ดึงดูดมากขึ้น", instruction: "Increase scroll-stopping power: stronger specific hook, a clear tension/payoff loop, punchier lines — WITHOUT clickbait, exaggeration, fake certainty or fear-mongering. Credibility stays intact." },
  more_professional: { label: "เป็นทางการขึ้น", instruction: "Make it calmer and more authoritative: fewer particles, precise vocabulary, measured claims. Still spoken Thai, not legal prose." },
  more_natural_thai: { label: "ภาษาไทยเป็นธรรมชาติ", instruction: "Rewrite into natural spoken Thai an experienced investigator would actually say on camera. Remove AI-sounding phrasing and translated-English structure. Keep content identical." },
  alternative_version: { label: "เวอร์ชันทางเลือก", instruction: "Write a genuinely different take on the same idea: different hook angle and structure, same facts and sources." },
  custom: { label: "สั่งเอง", instruction: "" },
};

export interface RewritePromptInput {
  mode: RewriteMode;
  field: "hook" | "script" | "caption" | "cta";
  text: string;
  context: { title: string; pillar: string; platform: string | null };
  customInstruction?: string | null;
}

export function rewriteUserPrompt(input: RewritePromptInput): string {
  const instruction = input.mode === "custom" ? (input.customInstruction ?? "").trim() : REWRITE_MODE_META[input.mode].instruction;
  return `TASK: Rewrite the ${input.field} of a Detective Pulse content piece.

PIECE: "${input.context.title}" · pillar ${input.context.pillar}${input.context.platform ? ` · ${input.context.platform}` : ""}

INSTRUCTION
${instruction || "Improve clarity and naturalness."}

CURRENT ${input.field.toUpperCase()}
${input.text}

Return the rewritten text only in "text" (same language, Thai), plus a one-sentence change_note. Do not add facts, names, numbers or sources that were not in the original.`;
}

export function hooksUserPrompt(input: { title: string; pillar: string; description?: string | null; currentHook?: string | null; knowledgeContext: string }): string {
  return `TASK: Propose 6 alternative hooks (first 3 seconds) for this piece. Each from a different angle.

PIECE: "${input.title}" · pillar ${input.pillar}
${input.description ? `IDEA: ${input.description}\n` : ""}${input.currentHook ? `CURRENT HOOK: ${input.currentHook}\n` : ""}
KNOWLEDGE BLOCKS
${input.knowledgeContext || "(none)"}

Hooks in Thai, ≤ 2 short lines each. Specific, credible, no clickbait.`;
}

export function ctaUserPrompt(input: { title: string; pillar: string; platform: string | null; script?: string | null }): string {
  return `TASK: Propose 4 CTA options for this piece: 2 soft, 1 educational ("อยากรู้ต่อเรื่อง… ดูคลิปถัดไป"), 1 direct-but-polite.

PIECE: "${input.title}" · pillar ${input.pillar}${input.platform ? ` · ${input.platform}` : ""}
${input.script ? `SCRIPT (for context)\n${input.script.slice(0, 1200)}` : ""}

Rules: one line each, Thai, mention LINE @detectivepluse only in the direct option, never fake urgency.`;
}
