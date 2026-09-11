import "server-only";

import { getStudioSettings } from "@/lib/studio/settings";
import { brandSystemPrompt } from "../prompts/brand";
import {
  ConsolidateKnowledgeSchema,
  ConsolidateQuestionsSchema,
  consolidateKnowledgeUserPrompt,
  consolidateQuestionsUserPrompt,
  consolidateSystemAddendum,
  type ConsolidateKnowledgeOutput,
  type ConsolidateQuestionsOutput,
} from "../prompts/consolidate";
import { runStructured, type RunResult } from "../run";
import type { RetryPolicy } from "@/lib/studio/retry";

export async function consolidateKnowledgeBatch(input: {
  items: { n: number; title: string; content: string; category: string }[];
  batchLabel: string;
  userId: string | null;
  model?: string;
  /** Offline jobs retry transient network/provider failures (see lib/studio/retry). */
  retry?: RetryPolicy;
}): Promise<RunResult<ConsolidateKnowledgeOutput>> {
  const settings = await getStudioSettings();
  return runStructured({
    purpose: "consolidate_knowledge",
    schema: ConsolidateKnowledgeSchema,
    system: `${brandSystemPrompt(settings.brand_voice)}\n\n${consolidateSystemAddendum()}`,
    user: consolidateKnowledgeUserPrompt(input.items),
    inputRefs: { batch: input.batchLabel, rows: input.items.length },
    storeOutput: false,
    userId: input.userId,
    effort: "medium",
    // Thai output tokenises ~1 token/char; a 45-row batch with 8–12 merged groups
    // exceeded 8000 tokens in production (truncated JSON) — give ample headroom.
    maxTokens: 20000,
    timeoutMs: 600_000,
    model: input.model,
    retry: input.retry,
  });
}

export async function consolidateQuestionsBatch(input: {
  items: { n: number; question: string; answer_hint: string | null; frequency: number }[];
  batchLabel: string;
  userId: string | null;
  model?: string;
  /** Offline jobs retry transient network/provider failures (see lib/studio/retry). */
  retry?: RetryPolicy;
}): Promise<RunResult<ConsolidateQuestionsOutput>> {
  const settings = await getStudioSettings();
  return runStructured({
    purpose: "consolidate_questions",
    schema: ConsolidateQuestionsSchema,
    system: `${brandSystemPrompt(settings.brand_voice)}\n\n${consolidateSystemAddendum()}`,
    user: consolidateQuestionsUserPrompt(input.items),
    inputRefs: { batch: input.batchLabel, rows: input.items.length },
    storeOutput: false,
    userId: input.userId,
    effort: "medium",
    maxTokens: 12000,
    timeoutMs: 600_000,
    model: input.model,
    retry: input.retry,
  });
}
