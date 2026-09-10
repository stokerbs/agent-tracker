import "server-only";

import type { ImageAspect } from "@/lib/studio/types";
import { MediaRefusedError, type GeneratedImage, type ImageProvider } from "./provider";

/**
 * Google Gemini image generation over REST (generateContent with IMAGE
 * response modality). Raw HTTP on purpose — one endpoint, no SDK weight.
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 90_000;

interface GeminiResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] };
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

export class GeminiImageProvider implements ImageProvider {
  readonly name = "gemini";
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(input: { prompt: string; aspect: ImageAspect; model?: string; timeoutMs?: number }): Promise<GeneratedImage> {
    const model = input.model?.trim() || "gemini-2.5-flash-image";
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: input.prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: input.aspect } },
        }),
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new Error(err instanceof Error && err.name === "AbortError" ? `Gemini image request timed out after ${input.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms` : `Gemini image request failed: ${describe(err)}`);
    } finally {
      clearTimeout(timer);
    }

    const json = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      // Never echo the key; the message is generic enough for the AI log.
      throw new Error(`Gemini image HTTP ${res.status}: ${json.error?.message ?? res.statusText}`.slice(0, 500));
    }
    if (json.promptFeedback?.blockReason) throw new MediaRefusedError(`Gemini blocked the prompt (${json.promptFeedback.blockReason})`);
    const cand = json.candidates?.[0];
    const part = cand?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      if (cand?.finishReason && cand.finishReason !== "STOP") throw new MediaRefusedError(`Gemini returned no image (${cand.finishReason})`);
      const text = cand?.content?.parts?.map((p) => p.text).filter(Boolean).join(" ").slice(0, 200);
      throw new Error(`Gemini returned no image${text ? `: ${text}` : ""}`);
    }
    const mime = normaliseMime(part.inlineData.mimeType);
    const bytes = Uint8Array.from(Buffer.from(part.inlineData.data, "base64"));
    const dims = readDimensions(bytes, mime);
    return { bytes, mime, width: dims?.width ?? null, height: dims?.height ?? null, provider: this.name, model, durationMs: Date.now() - started };
  }
}

function normaliseMime(m: string | undefined): GeneratedImage["mime"] {
  if (m === "image/jpeg" || m === "image/webp") return m;
  return "image/png";
}

/** PNG/JPEG header sniffing — enough for width/height without pulling in sharp. */
export function readDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  if (mime === "image/png" && bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (mime === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + len;
    }
  }
  return null;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
