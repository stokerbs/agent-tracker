import "server-only";

import { MediaRefusedError, type GeneratedAudio, type TtsProvider } from "./provider";

/**
 * ElevenLabs text-to-speech over REST. `eleven_multilingual_v2` covers Thai.
 * Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 */

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const OUTPUT_FORMAT = "mp3_44100_128"; // 128 kbps → duration ≈ bytes * 8 / 128000
const DEFAULT_TIMEOUT_MS = 120_000;
export const MAX_TTS_CHARS = 5000;

export class ElevenLabsTtsProvider implements TtsProvider {
  readonly name = "elevenlabs";
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async synthesize(input: { text: string; voiceId?: string; model?: string; timeoutMs?: number }): Promise<GeneratedAudio> {
    const text = input.text.trim();
    if (!text) throw new Error("ไม่มีข้อความให้พากย์");
    if (text.length > MAX_TTS_CHARS) throw new Error(`ข้อความยาวเกิน ${MAX_TTS_CHARS} ตัวอักษร — ตัดสคริปต์เป็นช่วงสั้นลง`);
    const voiceId = input.voiceId?.trim() || "EXAVITQu4vr4xnSDxMaL";
    const model = input.model?.trim() || "eleven_multilingual_v2";
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(`${ENDPOINT}/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "audio/mpeg", "xi-api-key": this.apiKey },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
        }),
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new Error(err instanceof Error && err.name === "AbortError" ? `ElevenLabs request timed out after ${input.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms` : `ElevenLabs request failed: ${describe(err)}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { detail?: { status?: string; message?: string } | string } | null;
      const detail = typeof body?.detail === "string" ? body.detail : body?.detail?.message ?? body?.detail?.status ?? res.statusText;
      // Only moderation is a "refusal"; other 4xx (bad voice/model id, quota) are plain errors so the owner sees the real cause.
      const status = typeof body?.detail === "string" ? body.detail : body?.detail?.status;
      if (status === "content_moderation" || status === "text_moderation" || status === "banned_content") {
        throw new MediaRefusedError(`ElevenLabs refused the text (${detail})`);
      }
      throw new Error(`ElevenLabs HTTP ${res.status}: ${String(detail).slice(0, 300)}`);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) throw new Error("ElevenLabs returned empty audio");
    const durationMs = Math.round((bytes.length * 8) / 128_000 * 1000);
    return { bytes, mime: "audio/mpeg", durationMs, provider: this.name, model, voiceId, durationMsCall: Date.now() - started };
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
