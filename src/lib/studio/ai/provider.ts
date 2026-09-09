import "server-only";

import type { z } from "zod/v4";
import { DEFAULT_STUDIO_MODEL } from "@/lib/studio/constants";
import { getStudioSettings } from "@/lib/studio/settings";

/**
 * AI provider abstraction for the Creative Studio.
 *
 * Every Studio AI action goes through `generateStructured()` so the app is not
 * coupled to one vendor. Anthropic is the implemented provider; the OpenAI
 * entry exists so Settings can show it, but it throws an honest
 * AiNotConfiguredError — there is no fake success path.
 */

export type Effort = "low" | "medium" | "high";

export interface GenerateStructuredOptions<T> {
  /** Short purpose key — stored in studio_ai_generations.purpose. */
  purpose: string;
  schema: z.ZodType<T>;
  system: string;
  user: string;
  maxTokens?: number;
  effort?: Effort;
  /** Override the configured model for this call. */
  model?: string;
  timeoutMs?: number;
}

export interface GenerateResult<T> {
  data: T;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
}

export interface AiProvider {
  readonly name: "anthropic" | "openai";
  generateStructured<T>(opts: GenerateStructuredOptions<T>): Promise<GenerateResult<T>>;
}

export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export class AiRefusedError extends Error {
  constructor(message = "AI declined to generate this request") {
    super(message);
    this.name = "AiRefusedError";
  }
}

export interface ResolvedAiConfig {
  provider: "anthropic" | "openai";
  model: string;
}

/** Settings → env → default. Exported for the Settings page status card. */
export async function resolveAiConfig(): Promise<ResolvedAiConfig> {
  const settings = await getStudioSettings();
  const provider = (settings?.ai_provider as "anthropic" | "openai") ?? "anthropic";
  const model = settings?.ai_model?.trim() || process.env.STUDIO_AI_MODEL?.trim() || DEFAULT_STUDIO_MODEL;
  return { provider, model };
}

export async function getAiProvider(): Promise<AiProvider> {
  const { provider } = await resolveAiConfig();
  if (provider === "anthropic") {
    const { AnthropicProvider } = await import("./anthropic");
    return new AnthropicProvider();
  }
  // OpenAI: interface present, implementation intentionally absent in V1.
  return {
    name: "openai",
    async generateStructured() {
      throw new AiNotConfiguredError(
        "OpenAI provider ยังไม่ได้ติดตั้งใน V1 — เปลี่ยน AI Provider เป็น Anthropic ในตั้งค่าสตูดิโอ",
      );
    },
  };
}

/** True when the configured provider can actually run (key present). */
export function isAiAvailable(provider: "anthropic" | "openai" = "anthropic"): boolean {
  if (provider === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  return false;
}
