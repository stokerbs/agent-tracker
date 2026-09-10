import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { PILLARS } from "@/lib/studio/constants";
import type { Pillar, SourceRef } from "@/lib/studio/types";
import { contentMixUserPrompt } from "../prompts/content-mix";
import { ContentMixResponseSchema } from "../prompts/schemas";
import { runStructured, type RunResult } from "../run";
import { buildContext, resolveSourceRefs } from "./context";

export interface ContentMixRecommendation {
  flags: string[];
  suggestions: { pillar: Pillar; title: string; hook: string; reason: string; source_refs: SourceRef[] }[];
  unused_knowledge: string[];
}

/** Pure: local imbalance flags without AI (used on the dashboard even when AI is off). */
export function computeMixFlags(counts: Record<Pillar, number>, targets: { key: Pillar; target_pct: number }[], labels: Record<Pillar, string>): string[] {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  const flags: string[] = [];
  for (const t of targets) {
    const pct = Math.round(((counts[t.key] ?? 0) / total) * 100);
    if (pct - t.target_pct >= 15) flags.push(`${labels[t.key]} คิดเป็น ${pct}% ของคอนเทนต์ช่วงนี้ (เป้า ${t.target_pct}%) — ลองเพิ่มเสาอื่นให้สมดุล`);
    if ((counts[t.key] ?? 0) === 0 && total >= 4) flags.push(`ยังไม่มีคอนเทนต์ ${labels[t.key]} เลยในช่วงนี้`);
  }
  return flags;
}

export async function recommendContentMix(input: { days?: number; userId: string | null }): Promise<RunResult<ContentMixRecommendation>> {
  const days = input.days ?? 14;
  const svc = createServiceClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const until = new Date(Date.now() + days * 86400_000).toISOString();
  const [mastersRes, sourcesRes, knowledgeRes] = await Promise.all([
    svc
      .from("studio_content_masters")
      .select("title, pillar, status, scheduled_at, updated_at")
      .in("status", ["draft", "review", "approved", "scheduled", "published"])
      .or(`scheduled_at.gte.${since},updated_at.gte.${since}`)
      .lte("updated_at", until)
      .limit(100),
    svc.from("studio_content_sources").select("source_id").eq("source_kind", "knowledge").limit(1000),
    svc.from("studio_knowledge_sources").select("id, title").eq("approved_for_content", true).is("superseded_by", null).limit(200),
  ]);
  const counts = Object.fromEntries(PILLARS.map((p) => [p, 0])) as Record<Pillar, number>;
  const titles: string[] = [];
  for (const m of mastersRes.data ?? []) {
    counts[m.pillar as Pillar] = (counts[m.pillar as Pillar] ?? 0) + 1;
    titles.push(m.title);
  }
  const used = new Set((sourcesRes.data ?? []).map((s) => s.source_id));
  const unused = (knowledgeRes.data ?? []).filter((k) => !used.has(k.id)).map((k) => k.title).slice(0, 25);

  const ctx = await buildContext(unused.slice(0, 6).join(" "), { limit: 10 });
  const res = await runStructured({
    purpose: "content_mix",
    schema: ContentMixResponseSchema,
    system: ctx.system,
    user: contentMixUserPrompt({
      windowLabel: `±${days} วัน`,
      counts,
      targets: ctx.settings.pillars,
      upcomingTitles: titles.slice(0, 40),
      knowledgeContext: ctx.knowledgeContext,
      unusedKnowledgeTitles: unused,
    }),
    inputRefs: { days, counts, unused: unused.length },
    userId: input.userId,
    effort: "medium",
    maxTokens: 5000,
  });
  if (!res.ok) return res;
  return {
    ok: true,
    generationId: res.generationId,
    model: res.model,
    data: {
      flags: res.data.flags,
      suggestions: res.data.suggestions.slice(0, 3).map((s) => ({ ...s, source_refs: resolveSourceRefs(s.source_refs, ctx.refs) })),
      unused_knowledge: res.data.unused_knowledge.slice(0, 5),
    },
  };
}
