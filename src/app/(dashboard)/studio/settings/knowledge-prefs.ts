/**
 * Shape of studio_settings.knowledge_prefs. Stored by Studio Settings for the
 * future RAG layer — V1 search does NOT read these values yet (the card says so).
 * Plain module (not "use server") so the type + default can be imported by both
 * the page and the client form.
 */
export interface KnowledgePrefs {
  prefer_case_insights: boolean;
  max_context_blocks: number;
  include_customer_questions: boolean;
}

export const DEFAULT_KNOWLEDGE_PREFS: KnowledgePrefs = {
  prefer_case_insights: true,
  max_context_blocks: 8,
  include_customer_questions: true,
};

/** Normalises the raw jsonb value onto typed defaults. */
export function normalizeKnowledgePrefs(raw: unknown): KnowledgePrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof KnowledgePrefs, unknown>>;
  const blocks = Number(r.max_context_blocks);
  return {
    prefer_case_insights: typeof r.prefer_case_insights === "boolean" ? r.prefer_case_insights : DEFAULT_KNOWLEDGE_PREFS.prefer_case_insights,
    max_context_blocks: Number.isInteger(blocks) && blocks >= 4 && blocks <= 12 ? blocks : DEFAULT_KNOWLEDGE_PREFS.max_context_blocks,
    include_customer_questions:
      typeof r.include_customer_questions === "boolean" ? r.include_customer_questions : DEFAULT_KNOWLEDGE_PREFS.include_customer_questions,
  };
}
