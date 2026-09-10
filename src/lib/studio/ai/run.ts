import "server-only";

import type { z } from "zod/v4";
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/server";
import { AiNotConfiguredError, AiRefusedError, getAiProvider, type Effort } from "./provider";

/**
 * Runs one structured AI generation and records it in studio_ai_generations.
 *
 * `inputRefs` must contain ONLY ids / short briefs — never raw case text or
 * confidential knowledge bodies (privacy-by-design for the generation log).
 */
export interface RunOptions<T> {
  purpose: string;
  schema: z.ZodType<T>;
  system: string;
  user: string;
  inputRefs: Record<string, unknown>;
  userId: string | null;
  maxTokens?: number;
  effort?: Effort;
  model?: string;
  /**
   * Set false for purposes whose raw output may still carry personal data
   * before the caller's own filtering (chat mining/import). The log then keeps
   * a marker + token counts only; the caller persists what survived filtering.
   */
  storeOutput?: boolean;
  /** Per-call HTTP timeout (default 120 s); long transcript windows need more. */
  timeoutMs?: number;
}

export type RunErrorCode = "not_configured" | "refused" | "failed";

export type RunResult<T> =
  | { ok: true; data: T; generationId: string | null; model: string }
  | { ok: false; error: string; code: RunErrorCode; generationId: string | null };

export async function runStructured<T>(opts: RunOptions<T>): Promise<RunResult<T>> {
  const started = Date.now();
  let provider: Awaited<ReturnType<typeof getAiProvider>>;
  try {
    provider = await getAiProvider();
  } catch (err) {
    return { ok: false, error: describe(err), code: "not_configured", generationId: null };
  }

  try {
    const result = await provider.generateStructured<T>({
      purpose: opts.purpose,
      schema: opts.schema,
      system: opts.system,
      user: opts.user,
      maxTokens: opts.maxTokens,
      effort: opts.effort,
      model: opts.model,
      timeoutMs: opts.timeoutMs,
    });
    const generationId = await recordGeneration({
      purpose: opts.purpose,
      provider: result.provider,
      model: result.model,
      input_refs: opts.inputRefs,
      output: opts.storeOutput === false ? { _omitted: "privacy", reason: "raw output not retained; see persisted rows" } : (result.data as unknown as Record<string, unknown>),
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      duration_ms: result.durationMs,
      status: "ok",
      error: null,
      user_id: opts.userId,
    });
    console.info(`[studio:ai] ${opts.purpose} ok model=${result.model} in=${result.inputTokens} out=${result.outputTokens} ${result.durationMs}ms`);
    return { ok: true, data: result.data, generationId, model: result.model };
  } catch (err) {
    const code: RunErrorCode =
      err instanceof AiNotConfiguredError ? "not_configured" : err instanceof AiRefusedError ? "refused" : "failed";
    const message = describe(err);
    console.error(`[studio:ai] ${opts.purpose} ${code}:`, message);
    if (code === "failed") Sentry.captureException(err, { tags: { module: "studio-ai", purpose: opts.purpose } });
    const generationId = await recordGeneration({
      purpose: opts.purpose,
      provider: provider.name,
      model: opts.model ?? "unknown",
      input_refs: opts.inputRefs,
      output: null,
      input_tokens: null,
      output_tokens: null,
      duration_ms: Date.now() - started,
      status: code === "refused" ? "refused" : "error",
      error: message.slice(0, 1000),
      user_id: opts.userId,
    });
    return { ok: false, error: userFacing(code, message), code, generationId };
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function userFacing(code: RunErrorCode, message: string): string {
  if (code === "not_configured") return message;
  if (code === "refused") return "AI ปฏิเสธคำขอนี้ — ลองปรับคำสั่งให้ชัดขึ้น หรือตัดข้อมูลที่อ่อนไหวออก";
  return "สร้างด้วย AI ไม่สำเร็จ — ลองใหม่อีกครั้ง หากยังไม่ได้ให้ตรวจดูบันทึก AI ในตั้งค่าสตูดิโอ";
}

/** Append one row to studio_ai_generations (also used by media generation). Never throws. */
export async function recordGeneration(row: {
  purpose: string;
  provider: string;
  model: string;
  input_refs: Record<string, unknown>;
  output: Record<string, unknown> | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number;
  status: "ok" | "error" | "refused";
  error: string | null;
  user_id: string | null;
}): Promise<string | null> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("studio_ai_generations")
      .insert({ ...row, input_refs: row.input_refs as never, output: row.output as never })
      .select("id")
      .single();
    if (error) {
      console.error("[studio:ai] generation log failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("[studio:ai] generation log threw:", e);
    return null;
  }
}
