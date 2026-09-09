import type { Platform } from "@/lib/studio/types";

export interface RepurposePromptInput {
  title: string;
  pillar: string;
  master: { hook: string | null; script: string | null; caption: string | null; cta: string | null };
  targetPlatforms: Platform[];
}

const PLATFORM_RULES: Record<Platform, string> = {
  tiktok: "Spoken script, punchy, ≤ 45 s. Caption short (≤ 150 chars) + 3–4 hashtags.",
  instagram_reel: "Spoken script similar to TikTok but slightly calmer; caption 2–3 lines + hashtags.",
  instagram_post: "Single-image post: caption 3–5 short paragraphs, first line is the hook, ends with soft CTA + hashtags. script = null.",
  instagram_carousel: "5–7 slides. script field = slides as lines 'Slide 1: …' (≤ 20 words each; slide 1 = hook, last slide = CTA). Caption 2–3 lines.",
  facebook: "Longer conversational caption (5–8 short paragraphs), story-like, one soft CTA, no hashtag wall (≤ 3). script = null.",
  youtube_short: "Spoken script ≤ 60 s; caption = title-like first line + 2 lines.",
  article: "script field = markdown outline: H1, 4–6 H2 sections with 1–2 bullet notes each, closing CTA section. Caption = meta description (≤ 155 chars).",
  line_oa: "Broadcast message: 3–5 short lines, warm, one CTA. script = null.",
};

export function repurposeUserPrompt(input: RepurposePromptInput): string {
  return `TASK: Repurpose ONE content master into platform variants. Do NOT re-invent the idea — adapt the same insight, facts and sources.

MASTER: "${input.title}" · pillar ${input.pillar}
HOOK: ${input.master.hook ?? "(none)"}
SCRIPT:
${input.master.script ?? "(none)"}
CAPTION: ${input.master.caption ?? "(none)"}
CTA: ${input.master.cta ?? "(none)"}

TARGET PLATFORMS AND RULES
${input.targetPlatforms.map((p) => `- ${p}: ${PLATFORM_RULES[p]}`).join("\n")}

Return one variant per target platform. Thai. No new facts, names, numbers.`;
}

export function creativePlanUserPrompt(input: { title: string; pillar: string; platform: string; script: string; targetSeconds: number | null }): string {
  return `TASK: Produce a video creative plan for this script — shot list with timings, B-roll, text overlays, subtitle style, voiceover notes, thumbnail concept, music mood.

PIECE: "${input.title}" · pillar ${input.pillar} · ${input.platform}${input.targetSeconds ? ` · target ${input.targetSeconds} s` : ""}

SCRIPT
${input.script}

RULES
- Split the script into 3–8 shots with start_sec/end_sec that add up to roughly the target length; "voice" = the exact spoken lines in that window.
- Visuals must be SAFE and non-identifying: night traffic, silhouettes, generic condo corridors, hands with a notebook, map UI without real addresses, stock-style. Never real plates, faces, addresses, or a recognisable specific location.
- Text overlays: ≤ 6 words each, Thai or short English (e.g. "GPS ≠ Full Investigation").
- Thumbnail: describe composition + 3–5 word title text. No clichés (no magnifying glass, fingerprints, police tape, neon hacker screens).
- Music mood: 1 line (e.g. "low, tense ambient — no drop").`;
}
