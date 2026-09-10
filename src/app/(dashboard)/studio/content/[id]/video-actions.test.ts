/**
 * Video action tests: admin gate, requirement gates (plan/voice/images/TTS),
 * privacy gate, busy (unique active job), stale running job auto-fail.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const MASTER = "11111111-1111-4111-8111-111111111111";
const JOB = "55555555-5555-4555-8555-555555555555";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  master: null as Row | null,
  imageCount: 1,
  activeJobs: 0,
  job: null as Row | null,
  insertError: null as null | { code: string; message: string },
  privacy: { ok: true, check: { status: "safe" } } as Row,
  tts: { available: true } as Row,
  updates: [] as Row[],
  audit: [] as { action: string }[],
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async (e: { action: string }) => void h.audit.push(e)) }));
vi.mock("@/lib/studio/auth", () => ({ getStudioAdmin: vi.fn(async () => h.profile) }));
vi.mock("@/lib/studio/settings", () => ({ getStudioSettings: vi.fn(async () => ({ media_prefs: { tts_voice_id: "", tts_model: "", image_model: "", image_style: "", default_aspect: "9:16" } })) }));
vi.mock("@/lib/studio/media/provider", () => ({ getMediaAvailability: () => ({ image: { available: true }, tts: h.tts }) }));
vi.mock("./privacy-check", () => ({ revalidateContentPaths: vi.fn(), runAndStorePrivacyCheck: vi.fn(async () => h.privacy) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      let op = "select";
      let payload: Row | null = null;
      for (const m of ["eq", "in", "lt"]) b[m] = () => b;
      b.select = () => b;
      b.insert = (p: Row) => ((op = "insert"), (payload = p), b);
      b.update = (p: Row) => ((op = "update"), (payload = p), b);
      b.single = async () => (h.insertError ? { data: null, error: h.insertError } : { data: { id: JOB, ...payload }, error: null });
      b.maybeSingle = async () => {
        if (op === "update") {
          h.updates.push(payload!);
          return { data: { ...(h.job ?? {}), ...payload }, error: null };
        }
        return { data: table === "studio_content_masters" ? h.master : table === "studio_render_jobs" ? h.job : null, error: null };
      };
      b.then = (r: (v: unknown) => unknown) => {
        if (op === "update") h.updates.push(payload!);
        return Promise.resolve(r({ data: null, count: table === "studio_render_jobs" ? h.activeJobs : h.imageCount, error: null }));
      };
      return b;
    },
  }),
}));

const plan = { shots: [{ start_sec: 0, end_sec: 4, voice: "พูด", visual: "ภาพ", text_overlay: null }], broll: [], text_overlays: [] };

beforeEach(() => {
  h.profile = { id: "admin-1", role: "admin" };
  h.master = { id: MASTER, status: "approved", creative_plan: plan };
  h.imageCount = 1;
  h.activeJobs = 0;
  h.job = { id: JOB, master_id: MASTER, status: "queued", started_at: null };
  h.insertError = null;
  h.privacy = { ok: true, check: { status: "safe" } };
  h.tts = { available: true };
  h.updates = [];
  h.audit = [];
});

describe("createRenderJob", () => {
  it("creates a queued job after all gates and audits", async () => {
    const { createRenderJob } = await import("./video-actions");
    const r = await createRenderJob({ masterId: MASTER });
    expect(r).toEqual({ ok: true, jobId: JOB });
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_VIDEO_RENDER");
    // orphan cleanup ran for both queued-never-started and running-too-long rows
    expect(h.updates.filter((u) => u.status === "failed")).toHaveLength(2);
  });
  it("refuses non-admins, bad ids, archived masters", async () => {
    const { createRenderJob } = await import("./video-actions");
    h.profile = null;
    expect(await createRenderJob({ masterId: MASTER })).toMatchObject({ ok: false, code: "unauthorized" });
    h.profile = { id: "admin-1", role: "admin" };
    expect(await createRenderJob({ masterId: "x" })).toMatchObject({ ok: false, code: "invalid" });
    h.master = { ...h.master!, status: "archived" };
    expect(await createRenderJob({ masterId: MASTER })).toMatchObject({ ok: false, code: "status" });
  });
  it("explains missing shots / voice / images / TTS", async () => {
    const { createRenderJob } = await import("./video-actions");
    h.master = { ...h.master!, creative_plan: { shots: [], broll: [], text_overlays: [] } };
    expect(await createRenderJob({ masterId: MASTER })).toMatchObject({ ok: false, code: "requirements", error: expect.stringContaining("shot list") });
    h.master = { ...h.master!, creative_plan: { shots: [{ start_sec: 0, end_sec: 1, voice: "  ", visual: "x", text_overlay: null }], broll: [], text_overlays: [] } };
    expect(await createRenderJob({ masterId: MASTER })).toMatchObject({ ok: false, code: "requirements", error: expect.stringContaining("voice") });
    h.master = { id: MASTER, status: "approved", creative_plan: plan };
    h.imageCount = 0;
    expect(await createRenderJob({ masterId: MASTER })).toMatchObject({ ok: false, code: "requirements", error: expect.stringContaining("รูป") });
    h.imageCount = 1;
    h.tts = { available: false, reason: "ยังไม่ได้ตั้งค่า ELEVENLABS_API_KEY" };
    expect(await createRenderJob({ masterId: MASTER })).toMatchObject({ ok: false, code: "not_configured" });
  });
  it("refuses when the fresh privacy scan is blocked and reports a busy master", async () => {
    const { createRenderJob } = await import("./video-actions");
    h.privacy = { ok: true, check: { status: "blocked" } };
    expect(await createRenderJob({ masterId: MASTER })).toMatchObject({ ok: false, code: "blocked" });
    h.privacy = { ok: true, check: { status: "safe" } };
    h.insertError = { code: "23505", message: "duplicate" };
    expect(await createRenderJob({ masterId: MASTER })).toMatchObject({ ok: false, code: "busy" });
    h.insertError = null;
    h.activeJobs = 2;
    expect(await createRenderJob({ masterId: MASTER })).toMatchObject({ ok: false, code: "busy", error: expect.stringContaining("2 งาน") });
    expect(h.audit).toHaveLength(0);
  });
});

describe("getRenderJob", () => {
  it("returns the job and fails an orphaned running job older than 8 minutes", async () => {
    const { getRenderJob } = await import("./video-actions");
    expect(await getRenderJob({ jobId: JOB })).toMatchObject({ ok: true, job: { status: "queued" } });
    h.job = { id: JOB, master_id: MASTER, status: "running", started_at: new Date(Date.now() - 10 * 60_000).toISOString() };
    const r = await getRenderJob({ jobId: JOB });
    expect(r).toMatchObject({ ok: true, job: { status: "failed" } });
    expect(h.updates[0]).toMatchObject({ status: "failed" });
    h.job = { id: JOB, master_id: MASTER, status: "running", started_at: new Date(Date.now() - 60_000).toISOString() };
    h.updates = [];
    expect(await getRenderJob({ jobId: JOB })).toMatchObject({ ok: true, job: { status: "running" } });
    expect(h.updates).toHaveLength(0);
  });
});
