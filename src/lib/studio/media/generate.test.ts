import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  settings: { privacy_rules: { denylist: ["บริษัทลับ"], custom_patterns: [], strict_mode: false }, media_prefs: { image_style: "STYLE", default_aspect: "9:16", image_model: "", tts_voice_id: "", tts_model: "eleven_multilingual_v2" } },
  settingsThrow: false,
  imageProvider: null as null | { name: string; generate: (i: unknown) => Promise<unknown> },
  ttsProvider: null as null | { name: string; synthesize: (i: unknown) => Promise<unknown> },
  inserts: [] as Row[],
  updates: [] as Row[],
  uploads: [] as { path: string; type: string; size: number }[],
  uploadError: null as null | { message: string },
  gens: [] as Row[],
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/studio/settings", () => ({
  getStudioSettingsStrict: vi.fn(async () => {
    if (h.settingsThrow) throw new Error("db down");
    return h.settings;
  }),
}));
vi.mock("@/lib/studio/ai/run", () => ({
  recordGeneration: vi.fn(async (row: Row) => {
    h.gens.push(row);
    return `gen-${h.gens.length}`;
  }),
}));
vi.mock("./provider", async (orig) => {
  const actual = await orig<typeof import("./provider")>();
  return {
    ...actual,
    getImageProvider: () => {
      if (!h.imageProvider) throw new actual.MediaNotConfiguredError("image", "ยังไม่ได้ตั้งค่า GEMINI_API_KEY");
      return h.imageProvider;
    },
    getTtsProvider: () => {
      if (!h.ttsProvider) throw new actual.MediaNotConfiguredError("tts", "ยังไม่ได้ตั้งค่า ELEVENLABS_API_KEY");
      return h.ttsProvider;
    },
  };
});
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => {
      const st = { op: "select", payload: null as Row | null };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "single"]) b[m] = () => b;
      b.insert = (row: Row) => ((st.op = "insert"), (st.payload = row), h.inserts.push(row), b);
      b.update = (row: Row) => ((st.op = "update"), (st.payload = row), h.updates.push(row), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        const id = `asset-${h.inserts.length}`;
        const base = h.inserts[h.inserts.length - 1] ?? {};
        const data = st.op === "insert" ? { ...base, id } : st.op === "update" ? { ...base, id, ...st.payload } : null;
        return Promise.resolve(resolve({ data, error: null }));
      };
      return b;
    },
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Uint8Array, opts: { contentType: string }) => {
          if (h.uploadError) return { error: h.uploadError };
          h.uploads.push({ path, type: opts.contentType, size: bytes.length });
          return { error: null };
        },
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}`, error: null })), error: null }),
        remove: async () => ({ error: null }),
      }),
    },
  }),
}));

const master = { id: "11111111-1111-4111-8111-111111111111", title: "ชื่อคลิป", creative_plan: { shots: [{ start_sec: 0, end_sec: 3, voice: "v", visual: "เงาคนหน้าคอนโด", text_overlay: null }], broll: [], text_overlays: [], thumbnail_concept: "ปกมืด ๆ", music_mood: null } };

beforeEach(() => {
  h.settingsThrow = false;
  h.inserts = [];
  h.updates = [];
  h.uploads = [];
  h.gens = [];
  h.uploadError = null;
  h.imageProvider = { name: "gemini", generate: async () => ({ bytes: new Uint8Array([1, 2, 3]), mime: "image/png", width: 10, height: 20, provider: "gemini", model: "m-img", durationMs: 50 }) };
  h.ttsProvider = { name: "elevenlabs", synthesize: async () => ({ bytes: new Uint8Array(16000), mime: "audio/mpeg", durationMs: 1000, provider: "elevenlabs", model: "m-tts", voiceId: "v", durationMsCall: 70 }) };
});

describe("generateImageAsset", () => {
  it("builds the prompt from style + plan, uploads under <master>/<asset>.png and logs ids only", async () => {
    let seen: { prompt: string; aspect: string } | null = null;
    h.imageProvider!.generate = async (i: unknown) => {
      seen = i as { prompt: string; aspect: string };
      return { bytes: new Uint8Array([1, 2, 3]), mime: "image/png", width: 10, height: 20, provider: "gemini", model: "m-img", durationMs: 50 };
    };
    const { generateImageAsset } = await import("./generate");
    const r = await generateImageAsset({ master, target: { kind: "thumbnail" }, aspect: "9:16", userId: "u1" });
    expect(r.ok).toBe(true);
    expect(seen!.prompt.startsWith("STYLE")).toBe(true);
    expect(seen!.prompt).toContain("ปกมืด ๆ");
    expect(seen!.prompt).toContain("no readable licence plates");
    expect(h.inserts[0]).toMatchObject({ kind: "thumbnail", status: "pending", label: "ปก", mime: "image/png", bytes: 3, width: 10, height: 20, provider: "gemini", model: "m-img", generation_id: "gen-1", created_by: "u1" });
    expect(h.uploads[0]).toEqual({ path: `${master.id}/asset-1.png`, type: "image/png", size: 3 });
    expect(h.updates.at(-1)).toMatchObject({ status: "ready", storage_path: `${master.id}/asset-1.png` });
    expect(h.gens[0]).toMatchObject({ purpose: "image_generation", status: "ok", input_refs: { master_id: master.id, target: "thumbnail", aspect: "9:16" } });
    expect(JSON.stringify(h.gens[0].input_refs)).not.toContain("ปกมืด");
  });
  it("refuses when the scene text carries a denylisted term or a phone number — provider never called", async () => {
    const gen = vi.fn();
    h.imageProvider!.generate = gen;
    const { generateImageAsset } = await import("./generate");
    const a = await generateImageAsset({ master, target: { kind: "custom", text: "โลโก้ บริษัทลับ บนตึก" }, aspect: "1:1", userId: "u1" });
    const b = await generateImageAsset({ master, target: { kind: "custom", text: "ป้ายเบอร์ 081-234-5678 บนรถ" }, aspect: "1:1", userId: "u1" });
    expect(a).toMatchObject({ ok: false, code: "blocked" });
    expect(b).toMatchObject({ ok: false, code: "blocked" });
    expect(gen).not.toHaveBeenCalled();
    expect(h.inserts).toHaveLength(0);
  });
  it("returns no_source for a shot without a visual and not_configured without a key", async () => {
    const { generateImageAsset } = await import("./generate");
    expect(await generateImageAsset({ master, target: { kind: "scene", index: 5 }, aspect: "1:1", userId: "u1" })).toMatchObject({ ok: false, code: "no_source" });
    h.imageProvider = null;
    const r = await generateImageAsset({ master, target: { kind: "thumbnail" }, aspect: "1:1", userId: "u1" });
    expect(r).toMatchObject({ ok: false, code: "not_configured" });
    if (!r.ok) expect(r.error).toContain("GEMINI_API_KEY");
  });
  it("marks the row failed and logs an error row when the upload fails", async () => {
    h.uploadError = { message: "bucket quota" };
    const { generateImageAsset } = await import("./generate");
    const r = await generateImageAsset({ master, target: { kind: "thumbnail" }, aspect: "1:1", userId: "u1" });
    expect(r).toMatchObject({ ok: false, code: "failed" });
    expect(h.updates.at(-1)).toMatchObject({ status: "failed" });
    expect(h.gens.at(-1)).toMatchObject({ purpose: "image_generation", status: "error" });
  });
  it("fails closed when settings cannot be loaded", async () => {
    h.settingsThrow = true;
    const { generateImageAsset } = await import("./generate");
    expect(await generateImageAsset({ master, target: { kind: "thumbnail" }, aspect: "1:1", userId: "u1" })).toMatchObject({ ok: false, code: "failed" });
    expect(h.inserts).toHaveLength(0);
  });
});

describe("generateVoiceoverAsset", () => {
  it("stores an mp3 with duration and only a short head of the text", async () => {
    const { generateVoiceoverAsset } = await import("./generate");
    const text = "สวัสดีครับ วันนี้มาเล่าเรื่องการติดตามอย่างถูกกฎหมาย ".repeat(10);
    const r = await generateVoiceoverAsset({ master, text, label: "พากย์สคริปต์หลัก", variantId: null, userId: "u1" });
    expect(r.ok).toBe(true);
    expect(h.inserts[0]).toMatchObject({ kind: "audio", mime: "audio/mpeg", duration_ms: 1000, label: "พากย์สคริปต์หลัก", bytes: 16000 });
    expect(String(h.inserts[0].prompt).length).toBeLessThanOrEqual(200);
    expect(h.uploads[0].path).toBe(`${master.id}/asset-1.mp3`);
    expect(h.gens[0]).toMatchObject({ purpose: "tts", input_refs: { master_id: master.id, chars: text.trim().length } });
  });
  it("blocks scripts that still carry an identifier and reports empty text as no_source", async () => {
    const { generateVoiceoverAsset } = await import("./generate");
    expect(await generateVoiceoverAsset({ master, text: "ติดต่อ 081-234-5678", label: "x", variantId: null, userId: "u1" })).toMatchObject({ ok: false, code: "blocked" });
    expect(await generateVoiceoverAsset({ master, text: "   ", label: "x", variantId: null, userId: "u1" })).toMatchObject({ ok: false, code: "no_source" });
    expect(h.inserts).toHaveLength(0);
  });
  it("maps a provider refusal to refused with a generic message", async () => {
    const { MediaRefusedError } = await import("./provider");
    h.ttsProvider!.synthesize = async () => {
      throw new MediaRefusedError("content_moderation");
    };
    const { generateVoiceoverAsset } = await import("./generate");
    const r = await generateVoiceoverAsset({ master, text: "สคริปต์ปกติ", label: "x", variantId: null, userId: "u1" });
    expect(r).toMatchObject({ ok: false, code: "refused" });
    expect(h.gens.at(-1)).toMatchObject({ purpose: "tts", status: "refused" });
  });
});

describe("signAssetUrls", () => {
  it("maps asset ids to signed urls and skips rows without a path", async () => {
    const { signAssetUrls } = await import("./generate");
    const out = await signAssetUrls([{ id: "a", storage_path: "m/a.png" }, { id: "b", storage_path: null }]);
    expect(out).toEqual({ a: "https://signed/m/a.png", b: null });
    expect(await signAssetUrls([])).toEqual({});
  });
});
