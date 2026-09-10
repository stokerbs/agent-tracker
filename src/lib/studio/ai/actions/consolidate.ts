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

export async function consolidateKnowledgeBatch(input: {
  items: { n: number; title: string; content: string; category: string }[];
  batchLabel: string;
  userId: string | null;
  model?: string;
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
    maxTokens: 8000,
    timeoutMs: 300_000,
    model: input.model,
  });
}

export async function consolidateQuestionsBatch(input: {
  items: { n: number; question: string; answer_hint: string | null; frequency: number }[];
  batchLabel: string;
  userId: string | null;
  model?: string;
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
    maxTokens: 6000,
    timeoutMs: 300_000,
    model: input.model,
  });
}
