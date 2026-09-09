import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  AiNotConfiguredError,
  AiRefusedError,
  resolveAiConfig,
  type AiProvider,
  type GenerateResult,
  type GenerateStructuredOptions,
} from "./provider";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 8_000;

/**
 * Anthropic implementation via the official SDK. Structured output is enforced
 * with `output_config.format` (zodOutputFormat) so we never parse free text.
 * Thinking is left at the model default (adaptive on Claude Opus 5); `effort`
 * tunes depth per call.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AiNotConfiguredError("ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่า — ตั้งค่าใน environment ของเซิร์ฟเวอร์ก่อนใช้ AI");
    }
    if (!this.client) this.client = new Anthropic({ maxRetries: 2 });
    return this.client;
  }

  async generateStructured<T>(opts: GenerateStructuredOptions<T>): Promise<GenerateResult<T>> {
    const client = this.getClient();
    const model = opts.model ?? (await resolveAiConfig()).model;
    const started = Date.now();

    const format = zodOutputFormat(opts.schema);

    const response = await client.messages.parse(
      {
        model,
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: opts.user }],
        output_config: {
          format,
          ...(opts.effort ? { effort: opts.effort } : {}),
        },
      },
      { timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS },
    );

    if (response.stop_reason === "refusal") {
      throw new AiRefusedError(response.stop_details?.explanation ?? undefined);
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("AI output was cut off (max_tokens) — ลองลดขนาดคำขอหรือเพิ่ม max_tokens");
    }
    const parsed = response.parsed_output;
    if (!parsed) throw new Error("AI returned output that did not match the expected schema");

    return {
      data: parsed as T,
      provider: this.name,
      model: response.model ?? model,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
      durationMs: Date.now() - started,
    };
  }
}
