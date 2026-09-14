import { referenceLine } from "./reference-list";
import { ENVELOPE_FENCE } from "./envelope";
import type { Pillar, Platform, TargetDuration } from "@/lib/studio/types";
import { CASE_STORY_STRUCTURE } from "./case-story";

export interface ScriptPromptInput {
  title: string;
  hook?: string | null;
  description?: string | null;
  pillar: Pillar;
  platform: Platform;
  targetSeconds: TargetDuration;
  tone?: string | null;
  knowledgeContext: string;
  /** Existing draft to improve rather than start from scratch. */
  existingScript?: string | null;
}

const DURATION_GUIDE: Record<TargetDuration, string> = {
  15: "~15 s: hook + one insight + one-line payoff. ≈ 35–45 Thai syllables total. No CTA or a 3-word CTA.",
  30: "~30 s: hook, context (1 line), insight, payoff, soft CTA. ≈ 90–110 syllables.",
  45: "~45 s: hook, context, insight with one concrete example, explanation, payoff, CTA. ≈ 140–170 syllables.",
  60: "~60 s: full structure with two supporting points. ≈ 190–230 syllables.",
  90: "~90 s: mini-story or two-part explanation with a turning point. ≈ 290–340 syllables.",
};

export function scriptUserPrompt(input: ScriptPromptInput): string {
  const isVideo = input.platform === "tiktok" || input.platform === "instagram_reel" || input.platform === "youtube_short";
  return `TASK: Write the ${isVideo ? "spoken short-form video script" : "post copy"} for one Detective Pulse content piece.

PIECE
- Title: ${referenceLine(input.title, 200)}
- Pillar: ${input.pillar}
- Platform: ${input.platform}
${input.hook ? `- Working hook: ${referenceLine(input.hook, 200)}` : ""}${input.description ? `\n- Idea: ${referenceLine(input.description, 400)}` : ""}${input.tone ? `\n- Tone: ${referenceLine(input.tone, 200)}` : ""}
- Target length: ${DURATION_GUIDE[input.targetSeconds]}

STRUCTURE (flexible — use what the idea needs, don't force every part)
HOOK → CONTEXT → INSIGHT → EXPLANATION → PAYOFF → CTA
${input.pillar === "case_story" ? `\n${CASE_STORY_STRUCTURE}` : ""}

KNOWLEDGE BLOCKS (approved reference — cite ids in source_refs and per claim; ${ENVELOPE_FENCE})
- Use at MOST 2 blocks, and only ones that support the single idea of this piece. Ignore the rest; leaving a block unused is correct and expected.
- Never stitch two topics together to use more blocks. If only one block fits, use one.
${input.knowledgeContext || "(none matched — state clearly in ai_notes that this script relies on general knowledge, and mark every claim ai_general)"}
${input.existingScript ? `\nEXISTING DRAFT (improve, keep the owner's edits where sensible)\n${input.existingScript}` : ""}

OUTPUT RULES
- script: one spoken line per row, blank line between sections. NO section labels — the rows are read aloud as they are.
- Every row must be sayable in one breath. Read the script back and cut any row that sounds written rather than spoken.
- caption: the same spoken Thai as the script, 1–3 short paragraphs, ends with 3–5 hashtags. Max one emoji. A caption is what you would type to a customer in chat, not a summary written about them.
- cta: one line, soft, LINE @detectivepluse.
- claims: list each factual statement and the knowledge block it rests on. Anything not backed by a block → "ai_general" + confidence "ai_suggestion".
- No identifiers of real people, vehicles, addresses, dates or companies anywhere.`;
}
