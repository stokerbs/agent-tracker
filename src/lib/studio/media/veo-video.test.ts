import { describe, expect, it, vi } from "vitest";
import { MediaRefusedError } from "./provider";
import { HOOK_SECONDS, VeoVideoProvider } from "./veo-video";

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, statusText: "x", json: async () => body }) as unknown as Response;

describe("VeoVideoProvider.start", () => {
  it("asks for a vertical 1080p clip and returns the operation to poll", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => json({ name: "models/veo/operations/abc" }));
    const started = await new VeoVideoProvider("k", fetchImpl as unknown as typeof fetch).start({ prompt: "a night street" });
    expect(started).toMatchObject({ operation: "models/veo/operations/abc", provider: "veo" });
    const [url, init] = fetchImpl.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain(":predictLongRunning");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    const body = JSON.parse(init.body as string);
    expect(body.instances[0].prompt).toBe("a night street");
    expect(body.parameters).toMatchObject({ aspectRatio: "9:16", resolution: "1080p", durationSeconds: HOOK_SECONDS });
  });
  it("throws with the provider's message on an error payload or an HTTP error", async () => {
    const err = vi.fn(async () => json({ error: { message: "quota exhausted" } }));
    await expect(new VeoVideoProvider("k", err as unknown as typeof fetch).start({ prompt: "x" })).rejects.toThrow(/quota exhausted/);
    const http = vi.fn(async () => json({ error: { message: "bad key" } }, false, 403));
    await expect(new VeoVideoProvider("k", http as unknown as typeof fetch).start({ prompt: "x" })).rejects.toThrow(/403.*bad key/);
    const empty = vi.fn(async () => json({}));
    await expect(new VeoVideoProvider("k", empty as unknown as typeof fetch).start({ prompt: "x" })).rejects.toThrow(/no operation name/);
  });
});

describe("VeoVideoProvider.poll", () => {
  const poll = (body: unknown) => new VeoVideoProvider("k", (async () => json(body)) as unknown as typeof fetch).poll("models/veo/operations/abc");
  it("reports work in progress without a URI", async () => {
    expect(await poll({})).toEqual({ done: false });
    expect(await poll({ done: false })).toEqual({ done: false });
  });
  it("returns the sample URI once finished (both response shapes)", async () => {
    expect(await poll({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: "https://v/1" } }] } } })).toEqual({ done: true, uri: "https://v/1" });
    expect(await poll({ done: true, response: { generatedSamples: [{ video: { uri: "https://v/2" } }] } })).toEqual({ done: true, uri: "https://v/2" });
  });
  it("separates a failed run from a safety refusal", async () => {
    expect(await poll({ done: true, error: { message: "internal" } })).toMatchObject({ done: true, error: "internal" });
    expect(await poll({ done: true, response: {} })).toMatchObject({ done: true, error: expect.stringContaining("without a video URI") });
    await expect(poll({ done: true, response: { generateVideoResponse: { raiMediaFilteredReasons: ["policy: people"] } } })).rejects.toBeInstanceOf(MediaRefusedError);
  });
});

describe("VeoVideoProvider.download", () => {
  it("sends the api key and rejects an empty file", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const okFetch = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200, arrayBuffer: async () => bytes.buffer }) as unknown as Response);
    const out = await new VeoVideoProvider("k", okFetch as unknown as typeof fetch).download("https://v/1");
    expect(out.mime).toBe("video/mp4");
    expect(out.bytes).toHaveLength(3);
    expect(okFetch.mock.calls[0]![1]!.headers).toMatchObject({ "x-goog-api-key": "k" });
    const emptyFetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response;
    await expect(new VeoVideoProvider("k", emptyFetch as unknown as typeof fetch).download("https://v/1")).rejects.toThrow(/empty file/);
    const badFetch = async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response;
    await expect(new VeoVideoProvider("k", badFetch as unknown as typeof fetch).download("https://v/1")).rejects.toThrow(/HTTP 404/);
  });
});
