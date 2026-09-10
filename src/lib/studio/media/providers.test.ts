import { describe, expect, it, vi } from "vitest";
import { GeminiImageProvider, readDimensions } from "./gemini-image";
import { ElevenLabsTtsProvider, MAX_TTS_CHARS } from "./elevenlabs-tts";
import { getImageProvider, getMediaAvailability, getTtsProvider, MediaNotConfiguredError, MediaRefusedError } from "./provider";
import { DEFAULT_MEDIA_PREFS } from "@/lib/studio/settings";

/** 1×2 PNG header (IHDR width=1 height=2). */
function pngBytes(): Uint8Array {
  const b = new Uint8Array(32);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52], 0);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, 1);
  dv.setUint32(20, 2);
  return b;
}

const fetchJson = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("GeminiImageProvider", () => {
  it("posts the prompt with IMAGE modality + aspect and decodes inline image data", async () => {
    const png = Buffer.from(pngBytes()).toString("base64");
    const f = fetchJson(200, { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "ok" }, { inlineData: { mimeType: "image/png", data: png } }] } }] });
    const p = new GeminiImageProvider("KEY", f);
    const out = await p.generate({ prompt: "a scene", aspect: "9:16" });
    expect(out.mime).toBe("image/png");
    expect(out.width).toBe(1);
    expect(out.height).toBe(2);
    expect(out.model).toBe("gemini-2.5-flash-image");
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toContain("/models/gemini-2.5-flash-image:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("KEY");
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseModalities).toContain("IMAGE");
    expect(body.generationConfig.imageConfig.aspectRatio).toBe("9:16");
    expect(body.contents[0].parts[0].text).toBe("a scene");
  });
  it("maps a blocked prompt to MediaRefusedError and HTTP errors to plain errors without the key", async () => {
    await expect(new GeminiImageProvider("KEY", fetchJson(200, { promptFeedback: { blockReason: "SAFETY" } })).generate({ prompt: "x", aspect: "1:1" })).rejects.toBeInstanceOf(MediaRefusedError);
    await expect(new GeminiImageProvider("KEY", fetchJson(429, { error: { message: "quota" } })).generate({ prompt: "x", aspect: "1:1" })).rejects.toThrow(/HTTP 429: quota/);
    await expect(new GeminiImageProvider("KEY", fetchJson(200, { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "cannot" }] } }] })).generate({ prompt: "x", aspect: "1:1" })).rejects.toThrow(/no image/);
  });
  it("reads PNG and JPEG dimensions and returns null otherwise", () => {
    expect(readDimensions(pngBytes(), "image/png")).toEqual({ width: 1, height: 2 });
    // JPEG: SOI, then SOF0 marker with height=3 width=4
    const j = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x03, 0x00, 0x04, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(readDimensions(j, "image/jpeg")).toEqual({ width: 4, height: 3 });
    expect(readDimensions(new Uint8Array([1, 2, 3]), "image/webp")).toBeNull();
  });
});

describe("ElevenLabsTtsProvider", () => {
  it("posts text with model + voice and returns mp3 bytes with an estimated duration", async () => {
    const audio = new Uint8Array(16000); // 16 kB at 128 kbps ≈ 1000 ms
    const f = vi.fn(async () => new Response(audio, { status: 200, headers: { "content-type": "audio/mpeg" } })) as unknown as typeof fetch;
    const p = new ElevenLabsTtsProvider("XI", f);
    const out = await p.synthesize({ text: "สวัสดีครับ", voiceId: "v1", model: "eleven_multilingual_v2" });
    expect(out.mime).toBe("audio/mpeg");
    expect(out.bytes.length).toBe(16000);
    expect(out.durationMs).toBe(1000);
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toContain("/text-to-speech/v1?output_format=mp3_44100_128");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("XI");
    expect(JSON.parse(String(init.body))).toMatchObject({ text: "สวัสดีครับ", model_id: "eleven_multilingual_v2" });
  });
  it("rejects empty / over-long text before calling out and maps moderation to refused", async () => {
    const f = vi.fn() as unknown as typeof fetch;
    const p = new ElevenLabsTtsProvider("XI", f);
    await expect(p.synthesize({ text: "  " })).rejects.toThrow();
    await expect(p.synthesize({ text: "ก".repeat(MAX_TTS_CHARS + 1) })).rejects.toThrow(/ยาวเกิน/);
    expect(f).not.toHaveBeenCalled();
    await expect(new ElevenLabsTtsProvider("XI", fetchJson(422, { detail: { status: "content_moderation", message: "nope" } })).synthesize({ text: "x" })).rejects.toBeInstanceOf(MediaRefusedError);
    await expect(new ElevenLabsTtsProvider("XI", fetchJson(401, { detail: { status: "invalid_api_key" } })).synthesize({ text: "x" })).rejects.toThrow(/HTTP 401/);
  });
});

describe("provider seam", () => {
  it("reports availability from env and throws a Thai not-configured error without keys", () => {
    const none = getMediaAvailability(DEFAULT_MEDIA_PREFS, {} as unknown as NodeJS.ProcessEnv);
    expect(none.image.available).toBe(false);
    expect(none.image.reason).toContain("GEMINI_API_KEY");
    expect(none.tts.reason).toContain("ELEVENLABS_API_KEY");
    const both = getMediaAvailability({ ...DEFAULT_MEDIA_PREFS, image_model: "custom-model", tts_voice_id: "voice9" }, { GEMINI_API_KEY: "a", ELEVENLABS_API_KEY: "b" } as unknown as NodeJS.ProcessEnv);
    expect(both.image).toMatchObject({ available: true, model: "custom-model" });
    expect(both.tts).toMatchObject({ available: true, voiceId: "voice9", model: "eleven_multilingual_v2" });
    expect(() => getImageProvider({} as unknown as NodeJS.ProcessEnv)).toThrow(MediaNotConfiguredError);
    expect(() => getTtsProvider({} as unknown as NodeJS.ProcessEnv)).toThrow(MediaNotConfiguredError);
    expect(getImageProvider({ GEMINI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv).name).toBe("gemini");
  });
});
