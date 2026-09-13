import "server-only";

import { MediaRefusedError, type StartedVideo, type VideoPoll, type VideoProvider } from "./provider";

/**
 * Google Veo video generation over REST. Unlike images, Veo is a long-running
 * operation: `start` returns an operation name, `poll` reports progress, and the
 * finished sample is downloaded from a URI that needs the API key header.
 *
 * Generation takes minutes, so nothing here waits for the result — the caller
 * stores the operation name and a cron finishes the asset (docs §17).
 * Docs: https://ai.google.dev/gemini-api/docs/video
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
/** Veo returns whole seconds; 8 s is one billing unit and long enough for a hook. */
export const HOOK_SECONDS = 8;

interface StartResponse {
  name?: string;
  error?: { message?: string; status?: string };
}

interface OperationResponse {
  done?: boolean;
  error?: { message?: string; code?: number };
  response?: {
    generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[]; raiMediaFilteredReasons?: string[] };
    generatedSamples?: { video?: { uri?: string } }[];
  };
}

export class VeoVideoProvider implements VideoProvider {
  readonly name = "veo";
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async start(input: { prompt: string; model?: string; seconds?: number; timeoutMs?: number }): Promise<StartedVideo> {
    const model = input.model?.trim() || "veo-3.1-lite-generate-preview";
    const body = {
      instances: [{ prompt: input.prompt }],
      // 9:16 for the vertical template; 1080p keeps the hook as sharp as the stills.
      parameters: { aspectRatio: "9:16", resolution: "1080p", durationSeconds: input.seconds ?? HOOK_SECONDS },
    };
    const json = await this.call<StartResponse>(`${ENDPOINT}/models/${encodeURIComponent(model)}:predictLongRunning`, { method: "POST", body: JSON.stringify(body) }, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (json.error?.message) throw new Error(`Veo start failed: ${json.error.message.slice(0, 300)}`);
    if (!json.name) throw new Error("Veo start returned no operation name");
    return { operation: json.name, provider: this.name, model };
  }

  async poll(operation: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<VideoPoll> {
    const json = await this.call<OperationResponse>(`${ENDPOINT}/${operation.replace(/^\/+/, "")}`, { method: "GET" }, timeoutMs);
    if (!json.done) return { done: false };
    if (json.error?.message) return { done: true, error: json.error.message.slice(0, 400) };
    const filtered = json.response?.generateVideoResponse?.raiMediaFilteredReasons?.[0];
    if (filtered) throw new MediaRefusedError(`โมเดลวิดีโอปฏิเสธคำสั่งนี้ (${filtered.slice(0, 200)}) — แก้คำบรรยายฉากแล้วลองใหม่`);
    const uri = (json.response?.generateVideoResponse?.generatedSamples ?? json.response?.generatedSamples ?? [])[0]?.video?.uri;
    if (!uri) return { done: true, error: "Veo finished without a video URI" };
    return { done: true, uri };
  }

  async download(uri: string, timeoutMs = DOWNLOAD_TIMEOUT_MS): Promise<{ bytes: Uint8Array; mime: "video/mp4" }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await this.fetchImpl(uri, { headers: { "x-goog-api-key": this.apiKey }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`Veo download HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.length) throw new Error("Veo download returned an empty file");
      return { bytes, mime: "video/mp4" };
    } catch (err) {
      throw wrap(err, "download", timeoutMs);
    } finally {
      clearTimeout(timer);
    }
  }

  private async call<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        ...init,
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        signal: ctrl.signal,
      });
      const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
      if (!res.ok) throw new Error(`Veo HTTP ${res.status}: ${(json.error?.message ?? res.statusText).slice(0, 300)}`);
      return json;
    } catch (err) {
      throw wrap(err, "request", timeoutMs);
    } finally {
      clearTimeout(timer);
    }
  }
}

function wrap(err: unknown, what: string, timeoutMs: number): Error {
  if (err instanceof MediaRefusedError) return err;
  if (err instanceof Error && err.name === "AbortError") return new Error(`Veo ${what} timed out after ${timeoutMs} ms`);
  return err instanceof Error ? err : new Error(String(err));
}
