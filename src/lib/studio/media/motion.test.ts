import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreativePlan } from "@/lib/studio/types";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  settings: {
    privacy_rules: { denylist: [] as string[], custom_patterns: [] as string[], strict_mode: false },
    media_prefs: { image_style: "brand style", default_aspect: "9:16", image_model: "", tts_voice_id: "", tts_model: "", video_model: "" },
  },
  genCount: 0,
  genCountError: null as null | { message: string },
  insertError: null as null | { code?: string; message: string },
  sweepRows: [] as Row[],
  inserts: [] as Row[],
  updates: [] as { id: unknown; payload: Row }[],
  uploads: [] as { path: string; bytes: number }[],
  uploadError: null as null | { message: string },
  generations: [] as Row[],
  start: vi.fn(async (_input: { prompt: string; model?: string; seconds?: number }) => ({ operation: "models/veo/operations/abc", provider: "veo", model: "veo-3.1-lite-generate-preview" })),
  poll: vi.fn(async () => ({ done: false }) as { done: boolean; uri?: string; error?: string }),
  download: vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3, 4]), mime: "video/mp4" as const })),
  providerError: null as null | Error,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/studio/settings", () => ({ getStudioSettingsStrict: vi.fn(async () => h.settings) }));
vi.mock("@/lib/studio/ai/run", () => ({ recordGeneration: vi.fn(async (g: Row) => (h.generations.push(g), "gen-1")) }));
vi.mock("./provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./provider")>()),
  getVideoProvider: () => {
    if (h.providerError) throw h.providerError;
    return { name: "veo", start: h.start, poll: h.poll, download: h.download };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const st = { op: "select", counting: false, sel: "", payload: null as Row | null, eq: {} as Record<string, unknown> };
      const b: Record<string, unknown> = {};
      for (const m of ["in", "gte", "contains", "order", "limit", "single", "maybeSingle"]) b[m] = () => b;
      b.eq = (col: string, v: unknown) => ((st.eq[col] = v), b);
      b.select = (sel: string, opts?: { count?: string; head?: boolean }) => ((st.sel = sel), (st.counting = !!opts?.count), b);
      b.insert = (row: Row) => ((st.op = "insert"), (st.payload = row), b);
      b.update = (row: Row) => ((st.op = "update"), (st.payload = row), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        if (table === "studio_ai_generations" && st.counting) return Promise.resolve(resolve({ count: h.genCount, error: h.genCountError }));
        if (st.op === "insert") {
          if (h.insertError) {
            const err = h.insertError;
            h.insertError = null;
            return Promise.resolve(resolve({ data: null, error: err }));
          }
          h.inserts.push(st.payload!);
          return Promise.resolve(resolve({ data: { id: `asset-${h.inserts.length}` }, error: null }));
        }
        if (st.op === "update") {
          h.updates.push({ id: st.eq.id, payload: st.payload! });
          return Promise.resolve(resolve({ data: null, error: null }));
        }
        return Promise.resolve(resolve({ data: h.sweepRows, error: null }));
      };
      return b;
    },
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Uint8Array) => {
          h.uploads.push({ path, bytes: bytes.length });
          return { error: h.uploadError };
        },
      }),
    },
  }),
}));

const plan = (visual: string): CreativePlan => ({ shots: [{ start_sec: 0, end_sec: 8, voice: "พูด", visual, text_overlay: null }], broll: [], text_overlays: [] }) as unknown as CreativePlan;
const master = (visual = "ถนนกลางคืน ไฟรถเบลอ") => ({ id: "m1", title: "ชื่อ", hook: "ฮุก", creative_plan: plan(visual) });
const pendingRow = (over: Row = {}): Row => ({
  id: "a1",
  master_id: "m1",
  model: "veo-3.1-lite-generate-preview",
  created_by: "u1",
  created_at: new Date().toISOString(),
  meta: { target: { kind: "hook_motion" }, veo: { operation: "models/veo/operations/abc", started_at: new Date().toISOString() }, seconds: 8 },
  ...over,
});

beforeEach(() => {
  h.genCount = 0;
  h.genCountError = null;
  h.insertError = null;
  h.sweepRows = [];
  h.inserts = [];
  h.updates = [];
  h.uploads = [];
  h.uploadError = null;
  h.generations = [];
  h.providerError = null;
  h.start.mockReset().mockResolvedValue({ operation: "models/veo/operations/abc", provider: "veo", model: "veo-3.1-lite-generate-preview" });
  h.poll.mockReset().mockResolvedValue({ done: false });
  h.download.mockReset().mockResolvedValue({ bytes: new Uint8Array([1, 2, 3, 4]), mime: "video/mp4" });
});

describe("startHookMotion", () => {
  it("queues a pending asset that remembers the operation, and never blocks on the render", async () => {
    const { startHookMotion } = await import("./motion");
    const res = await startHookMotion({ master: master(), userId: "u1" });
    expect(res).toMatchObject({ ok: true, assetId: "asset-1" });
    // the row is claimed BEFORE the provider is paid, then updated with the operation it answered with
    expect(h.inserts[0]).toMatchObject({ kind: "broll", status: "pending", master_id: "m1", provider: "veo", bytes: 0 });
    expect((h.inserts[0].meta as { target: { kind: string }; veo: { operation: string | null } }).target.kind).toBe("hook_motion");
    expect((h.inserts[0].meta as { veo: { operation: string | null } }).veo.operation).toBeNull();
    expect((h.updates[0].payload.meta as { veo: { operation: string } }).veo.operation).toBe("models/veo/operations/abc");
    // the spend is charged to the shared media quota right away
    expect(h.generations[0]).toMatchObject({ purpose: "video_hook", status: "ok" });
    // the prompt is built server-side and carries the safety negatives
    const prompt = h.start.mock.calls[0]![0].prompt;
    expect(prompt).toContain("ถนนกลางคืน");
    expect(prompt).toContain("No speech");
    expect(prompt).toContain("no banknotes");
  });
  it("refuses a scene that still carries an identifier, before paying for anything", async () => {
    const { startHookMotion } = await import("./motion");
    const res = await startHookMotion({ master: master("โทร 081-234-5678 แล้วถ่ายหน้าบ้าน"), userId: "u1" });
    expect(res).toMatchObject({ ok: false, code: "blocked" });
    expect(h.start).not.toHaveBeenCalled();
    expect(h.inserts).toHaveLength(0);
  });
  it("refuses when the plan has no first shot to film", async () => {
    const { startHookMotion } = await import("./motion");
    const res = await startHookMotion({ master: { id: "m1", title: "", hook: null, creative_plan: null }, userId: "u1" });
    expect(res).toMatchObject({ ok: false, code: "no_source" });
    expect(h.start).not.toHaveBeenCalled();
  });
  it("stops on the media rate limit, and lets the database reject a second clip for the same master", async () => {
    const { startHookMotion, MOTION_TARGET } = await import("./motion");
    h.genCount = 10;
    expect(await startHookMotion({ master: master(), userId: "u1" })).toMatchObject({ ok: false, code: "rate_limited" });
    h.genCount = 0;
    // the partial unique index (0123) is what actually stops two concurrent clicks
    h.insertError = { code: "23505", message: "duplicate key value violates unique constraint" };
    expect(await startHookMotion({ master: master(), userId: "u1" })).toMatchObject({ ok: false, code: "rate_limited" });
    expect(h.start).not.toHaveBeenCalled();
    expect(MOTION_TARGET).toBe("hook_motion");
  });
  it("frees the claimed slot when the provider call fails, so the next attempt is not blocked", async () => {
    const { startHookMotion } = await import("./motion");
    h.start.mockRejectedValue(new Error("veo down"));
    const res = await startHookMotion({ master: master(), userId: "u1" });
    expect(res).toMatchObject({ ok: false, code: "failed" });
    expect(h.updates.at(-1)?.payload).toMatchObject({ status: "failed" });
    expect(h.generations[0]).toMatchObject({ purpose: "video_hook", status: "error" });
  });
});

describe("finishPendingHookMotions", () => {
  it("leaves a clip that is still rendering alone", async () => {
    const { finishPendingHookMotions } = await import("./motion");
    h.sweepRows = [pendingRow()];
    const res = await finishPendingHookMotions();
    expect(res).toMatchObject({ checked: 1, pending: 1, ready: 0, failed: 0 });
    expect(h.updates).toHaveLength(0);
  });
  it("downloads a finished clip, stores it and flips the asset to ready", async () => {
    const { finishPendingHookMotions } = await import("./motion");
    h.sweepRows = [pendingRow()];
    h.poll.mockResolvedValue({ done: true, uri: "https://v/1" });
    const res = await finishPendingHookMotions();
    expect(res).toMatchObject({ ready: 1, failed: 0, pending: 0 });
    expect(h.uploads[0]).toMatchObject({ path: "m1/a1.mp4", bytes: 4 });
    expect(h.updates[0]).toMatchObject({ id: "a1", payload: { status: "ready", storage_path: "m1/a1.mp4", bytes: 4 } });
    expect(h.generations[0]).toMatchObject({ purpose: "video_hook_finish", status: "ok" });
  });
  it("marks a refused or failed generation instead of retrying forever", async () => {
    const { finishPendingHookMotions } = await import("./motion");
    h.sweepRows = [pendingRow()];
    h.poll.mockResolvedValue({ done: true, error: "internal error" });
    expect(await finishPendingHookMotions()).toMatchObject({ failed: 1 });
    expect(h.updates[0].payload).toMatchObject({ status: "failed" });

    h.updates = [];
    const { MediaRefusedError } = await import("./provider");
    h.poll.mockRejectedValue(new MediaRefusedError("policy"));
    expect(await finishPendingHookMotions()).toMatchObject({ failed: 1 });
    expect(h.updates[0].payload).toMatchObject({ status: "failed" });
  });
  it("keeps a clip pending through a network blip, and gives up once it is stuck", async () => {
    const { finishPendingHookMotions, MOTION_TIMEOUT_MS } = await import("./motion");
    h.sweepRows = [pendingRow()];
    h.poll.mockRejectedValue(new Error("fetch failed"));
    const blip = await finishPendingHookMotions();
    expect(blip).toMatchObject({ pending: 1, failed: 0 });
    expect(h.updates).toHaveLength(0);
    expect(blip.errors[0]).toContain("fetch failed");

    // same blip, but the operation started longer ago than the timeout
    h.sweepRows = [pendingRow({ meta: { target: { kind: "hook_motion" }, veo: { operation: "op", started_at: new Date(Date.now() - MOTION_TIMEOUT_MS - 1000).toISOString() }, seconds: 8 } })];
    expect(await finishPendingHookMotions()).toMatchObject({ failed: 1 });
    expect(h.updates[0].payload).toMatchObject({ status: "failed" });
  });
  it("waits out the claim grace window before failing a row that never got an operation", async () => {
    const { finishPendingHookMotions, MOTION_CLAIM_GRACE_MS } = await import("./motion");
    const noOp = (startedAt: string) => pendingRow({ meta: { target: { kind: "hook_motion" }, veo: { operation: null, started_at: startedAt }, seconds: 8 } });
    h.sweepRows = [noOp(new Date().toISOString())];
    expect(await finishPendingHookMotions()).toMatchObject({ pending: 1, failed: 0 });
    expect(h.updates).toHaveLength(0);

    h.sweepRows = [noOp(new Date(Date.now() - MOTION_CLAIM_GRACE_MS - 1000).toISOString())];
    expect(await finishPendingHookMotions()).toMatchObject({ failed: 1 });
    expect(h.poll).not.toHaveBeenCalled();
  });
  it("reports the provider being unconfigured without touching any asset", async () => {
    const { finishPendingHookMotions } = await import("./motion");
    const { MediaNotConfiguredError } = await import("./provider");
    h.providerError = new MediaNotConfiguredError("video", "no key");
    const res = await finishPendingHookMotions();
    expect(res.errors[0]).toContain("no key");
    expect(h.updates).toHaveLength(0);
  });
});
