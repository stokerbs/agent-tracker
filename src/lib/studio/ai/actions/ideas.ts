import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { PILLARS } from "@/lib/studio/constants";
import type { AiScores, Pillar, Platform, SourceRef } from "@/lib/studio/types";
import { campaignUserPrompt } from "../prompts/campaign";
import { ideasUserPrompt } from "../prompts/ideas";
import { CampaignResponseSchema, IdeasResponseSchema, type IdeaOutput } from "../prompts/schemas";
import { runStructured, type RunResult } from "../run";
import { buildContext, clampScore, resolveSourceRefs } from "./context";

export interface GeneratedIdea {
  title: string;
  hook: string;
  description: string;
  pillar: Pillar;
  platforms: Platform[];
  format: IdeaOutput["format"];
  source_refs: SourceRef[];
  ai_scores: AiScores;
  tags: string[];
}

function mapIdea(i: IdeaOutput, refs: Awaited<ReturnType<typeof buildContext>>["refs"]): GeneratedIdea {
  return {
    title: i.title.trim().slice(0, 120),
    hook: i.hook.trim(),
    description: i.description.trim(),
    pillar: i.pillar,
    platforms: Array.from(new Set(i.platforms)),
    format: i.format,
    source_refs: resolveSourceRefs(i.source_refs, refs),
    ai_scores: {
      hook: clampScore(i.scores.hook),
      educational: clampScore(i.scores.educational),
      conversion: clampScore(i.scores.conversion),
      originality: clampScore(i.scores.originality),
      rationale: i.scores.rationale?.trim(),
    },
    tags: i.tags.map((t) => t.trim()).filter(Boolean).slice(0, 8),
  };
}

async function existingTitles(limit = 60): Promise<string[]> {
  const svc = createServiceClient();
  const [ideas, masters] = await Promise.all([
    svc.from("studio_ideas").select("title").neq("status", "rejected").order("created_at", { ascending: false }).limit(limit),
    svc.from("studio_content_masters").select("title").neq("status", "archived").order("created_at", { ascending: false }).limit(limit),
  ]);
  return [...(ideas.data ?? []), ...(masters.data ?? [])].map((r) => r.title);
}

export interface GenerateIdeasInput {
  brief: string;
  count?: number;
  pillar?: Pillar | null;
  platforms?: Platform[];
  tone?: string | null;
  userId: string | null;
}

export async function generateIdeas(input: GenerateIdeasInput): Promise<RunResult<{ ideas: GeneratedIdea[]; knowledge_gaps: string[] }>> {
  const count = Math.min(10, Math.max(1, input.count ?? 5));
  const ctx = await buildContext(input.brief, { limit: 10, pillar: input.pillar ?? null });
  const titles = await existingTitles();
  const res = await runStructured({
    purpose: "ideas",
    schema: IdeasResponseSchema,
    system: ctx.system,
    user: ideasUserPrompt({
      brief: input.brief,
      count,
      pillar: input.pillar ?? null,
      platforms: input.platforms ?? ctx.settings.default_platforms as Platform[],
      tone: input.tone ?? null,
      existingTitles: titles,
      knowledgeContext: ctx.knowledgeContext,
    }),
    inputRefs: { brief: input.brief.slice(0, 300), count, pillar: input.pillar ?? null, knowledge_ids: ctx.hits.map((h) => h.id) },
    userId: input.userId,
    effort: "medium",
  });
  if (!res.ok) return res;
  return {
    ok: true,
    generationId: res.generationId,
    model: res.model,
    data: { ideas: res.data.ideas.slice(0, count).map((i) => mapIdea(i, ctx.refs)), knowledge_gaps: res.data.knowledge_gaps },
  };
}

export interface CampaignProposal {
  title: string;
  interpretation: {
    objective: string;
    audience: string;
    platforms: Platform[];
    pillar_focus: Pillar[];
    tone: string;
    post_count: number;
    cta: string;
  };
  ideas: GeneratedIdea[];
  mix_note: string;
  knowledge_gaps: string[];
}

export interface GenerateCampaignInput {
  request: string;
  refine?: { previousIdeas: string[]; instruction: string } | null;
  userId: string | null;
}

async function recentMixPct(): Promise<Record<Pillar, number>> {
  const svc = createServiceClient();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await svc
    .from("studio_content_masters")
    .select("pillar")
    .in("status", ["approved", "scheduled", "published"])
    .gte("updated_at", since);
  const counts = Object.fromEntries(PILLARS.map((p) => [p, 0])) as Record<Pillar, number>;
  for (const r of data ?? []) counts[r.pillar as Pillar] = (counts[r.pillar as Pillar] ?? 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(PILLARS.map((p) => [p, Math.round((counts[p] / total) * 100)])) as Record<Pillar, number>;
}

export async function generateCampaign(input: GenerateCampaignInput): Promise<RunResult<CampaignProposal>> {
  const ctx = await buildContext(input.request, { limit: 12 });
  const [titles, mix] = await Promise.all([existingTitles(), recentMixPct()]);
  const res = await runStructured({
    purpose: "campaign",
    schema: CampaignResponseSchema,
    system: ctx.system,
    user: campaignUserPrompt({
      request: input.request,
      defaultPlatforms: ctx.settings.default_platforms as Platform[],
      pillarTargets: ctx.settings.pillars,
      recentMix: mix,
      existingTitles: titles,
      knowledgeContext: ctx.knowledgeContext,
      refine: input.refine ?? null,
    }),
    inputRefs: { request: input.request.slice(0, 300), refine: input.refine?.instruction?.slice(0, 200) ?? null, knowledge_ids: ctx.hits.map((h) => h.id) },
    userId: input.userId,
    effort: "high",
    maxTokens: 12_000,
  });
  if (!res.ok) return res;
  const d = res.data;
  return {
    ok: true,
    generationId: res.generationId,
    model: res.model,
    data: {
      title: d.title.trim(),
      interpretation: {
        ...d.interpretation,
        post_count: Math.min(20, Math.max(1, Math.round(d.interpretation.post_count || d.ideas.length || 5))),
        platforms: Array.from(new Set(d.interpretation.platforms)),
      },
      ideas: d.ideas.map((i) => mapIdea(i, ctx.refs)),
      mix_note: d.mix_note,
      knowledge_gaps: d.knowledge_gaps,
    },
  };
}
