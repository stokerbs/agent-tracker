import "server-only";

import type { ContentFormat, CreativePlan, Platform } from "@/lib/studio/types";
import { creativePlanUserPrompt, repurposeUserPrompt } from "../prompts/repurpose";
import { CreativePlanResponseSchema, RepurposeResponseSchema } from "../prompts/schemas";
import { runStructured, type RunResult } from "../run";
import { buildContext } from "./context";

export interface GeneratedVariant {
  platform: Platform;
  format: ContentFormat;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
}

export async function repurposeContent(input: {
  title: string;
  pillar: string;
  master: { hook: string | null; script: string | null; caption: string | null; cta: string | null };
  targetPlatforms: Platform[];
  userId: string | null;
}): Promise<RunResult<{ variants: GeneratedVariant[] }>> {
  const ctx = await buildContext("", {});
  const res = await runStructured({
    purpose: "repurpose",
    schema: RepurposeResponseSchema,
    system: ctx.system,
    user: repurposeUserPrompt({ title: input.title, pillar: input.pillar, master: input.master, targetPlatforms: input.targetPlatforms }),
    inputRefs: { title: input.title, platforms: input.targetPlatforms },
    userId: input.userId,
    effort: "medium",
    maxTokens: 10_000,
  });
  if (!res.ok) return res;
  const wanted = new Set(input.targetPlatforms);
  const variants = res.data.variants
    .filter((v) => wanted.has(v.platform))
    .map((v) => ({
      platform: v.platform,
      format: v.format,
      hook: v.hook?.trim() || null,
      script: v.script?.trim() || null,
      caption: v.caption?.trim() || null,
      cta: v.cta?.trim() || null,
    }));
  return { ok: true, generationId: res.generationId, model: res.model, data: { variants } };
}

export async function generateCreativePlan(input: {
  title: string;
  pillar: string;
  platform: Platform;
  script: string;
  targetSeconds: number | null;
  userId: string | null;
}): Promise<RunResult<CreativePlan>> {
  const ctx = await buildContext("", {});
  const res = await runStructured({
    purpose: "creative_plan",
    schema: CreativePlanResponseSchema,
    system: ctx.system,
    user: creativePlanUserPrompt(input),
    inputRefs: { title: input.title, platform: input.platform, target: input.targetSeconds },
    userId: input.userId,
    effort: "medium",
    maxTokens: 6000,
  });
  if (!res.ok) return res;
  const d = res.data;
  const shots = d.shots
    .map((s) => ({ ...s, start_sec: Math.max(0, Math.round(s.start_sec)), end_sec: Math.max(0, Math.round(s.end_sec)) }))
    .sort((a, b) => a.start_sec - b.start_sec);
  return {
    ok: true,
    generationId: res.generationId,
    model: res.model,
    data: {
      shots,
      broll: d.broll,
      text_overlays: d.text_overlays,
      subtitle_style: d.subtitle_style,
      voiceover_notes: d.voiceover_notes,
      thumbnail_concept: d.thumbnail_concept,
      music_mood: d.music_mood,
    },
  };
}
