import "server-only";

import { formatKnowledgeContext, searchKnowledge, type KnowledgeHit, type SearchOptions } from "@/lib/studio/knowledge/search";
import { getStudioSettings } from "@/lib/studio/settings";
import type { SourceRef, StudioSettingsRow } from "@/lib/studio/types";
import { brandSystemPrompt } from "../prompts/brand";

export interface GenerationContext {
  settings: StudioSettingsRow;
  system: string;
  knowledgeContext: string;
  refs: Record<string, KnowledgeHit>;
  hits: KnowledgeHit[];
}

/** Loads settings, builds the brand system prompt and retrieves knowledge for a query. */
export async function buildContext(query: string, search: SearchOptions = {}): Promise<GenerationContext> {
  const settings = await getStudioSettings();
  const hits = query.trim() || search.pillar ? await searchKnowledge(query, search) : [];
  const { context, refs } = formatKnowledgeContext(hits);
  return { settings, system: brandSystemPrompt(settings.brand_voice), knowledgeContext: context, refs, hits };
}

/**
 * Maps model-cited ids ("K1", "ai_general") back to concrete source refs.
 * Unknown ids are dropped; "ai_general" becomes a warning ref.
 */
export function resolveSourceRefs(cited: string[], refs: Record<string, KnowledgeHit>): SourceRef[] {
  const out: SourceRef[] = [];
  const seen = new Set<string>();
  for (const raw of cited) {
    const key = raw.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (key.toLowerCase() === "ai_general") {
      out.push({ kind: "ai_general", id: null, label: "ความรู้ทั่วไปของ AI" });
      continue;
    }
    const hit = refs[key.toUpperCase()];
    if (hit) out.push({ kind: hit.kind, id: hit.id, label: hit.title });
  }
  return out;
}

/** Clamp an AI "score" into 1–5 integers (the model is asked for 1–5 but we never trust it). */
export function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 3;
  return Math.min(5, Math.max(1, v));
}
