import "server-only";

import { getStudioSettings } from "@/lib/studio/settings";
import { brandSystemPrompt } from "../prompts/brand";
import { ChatKnowledgeSchema, chatKnowledgeSystemAddendum, chatKnowledgeUserPrompt, type ChatKnowledgeOutput } from "../prompts/chat-knowledge";
import { runStructured, type RunResult } from "../run";

/**
 * One transcript window → structured knowledge. The generation log stores only
 * the window label + size, never the transcript.
 */
export async function extractChatKnowledge(input: {
  transcript: string;
  /** Opaque, non-identifying reference (e.g. `line-import:<hash>:<n>`) — never a filename. */
  windowLabel: string;
  userId: string | null;
  model?: string;
}): Promise<RunResult<ChatKnowledgeOutput>> {
  const settings = await getStudioSettings();
  return runStructured({
    purpose: "chat_knowledge",
    schema: ChatKnowledgeSchema,
    system: `${brandSystemPrompt(settings.brand_voice)}\n\n${chatKnowledgeSystemAddendum()}`,
    user: chatKnowledgeUserPrompt(input),
    inputRefs: { ref: input.windowLabel, chars: input.transcript.length },
    storeOutput: false,
    userId: input.userId,
    effort: "medium",
    maxTokens: 8000,
    model: input.model,
  });
}
