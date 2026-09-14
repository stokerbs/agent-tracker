import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  settings: {
    autopilot: { enabled: true, auto_publish: true, platforms: ["facebook", "instagram", "tiktok"] as string[] },
  },
  settingsError: null as null | Error,
  runs: [] as Row[],
  master: null as Row | null,
  posts: [] as Row[],
  video: null as Row | null,
  updates: [] as { table: string; payload: Row }[],
  audits: [] as Row[],
  notes: [] as string[],
  publish: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async (a: Row) => void h.audits.push(a)) }));
vi.mock("@/lib/line/notify", () => ({ pushLineNotify: vi.fn(async (t: string) => void h.notes.push(t)) }));
vi.mock("@/lib/studio/publish/publish", () => ({ publishMaster: (i: unknown) => h.publish(i) }));
vi.mock("@/lib/studio/settings", () => ({
  getStudioSettingsStrict: vi.fn(async () => {
    if (h.settingsError) throw h.settingsError;
    return h.settings;
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const st = { op: "select", payload: null as Row | null };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "not", "gte", "order", "limit", "maybeSingle", "single"]) b[m] = () => b;
      b.update = (row: Row) => ((st.op = "update"), (st.payload = row), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        if (st.op === "update") {
          h.updates.push({ table, payload: st.payload! });
          return Promise.resolve(resolve({ data: null, error: null }));
        }
        if (table === "studio_autopilot_runs") return Promise.resolve(resolve({ data: h.runs, error: null }));
        if (table === "studio_content_masters") return Promise.resolve(resolve({ data: h.master, error: null }));
        if (table === "studio_social_posts") return Promise.resolve(resolve({ data: h.posts, error: null }));
        return Promise.resolve(resolve({ data: h.video, error: null }));
      };
      return b;
    },
  }),
}));

const run = (over: Row = {}): Row => ({ id: "r1", master_id: "m1", stats: { format: "template" }, started_at: new Date().toISOString(), created_by: "u1", ...over });
const okPublish = { ok: true, providerPostId: "P1", posts: [{ platform: "facebook", post_url: "https://fb/1" }, { platform: "tiktok", post_url: null }] };

beforeEach(() => {
  h.settings = { autopilot: { enabled: true, auto_publish: true, platforms: ["facebook", "instagram", "tiktok"] } };
  h.settingsError = null;
  h.runs = [run()];
  h.master = { id: "m1", title: "หัวข้อ", caption: "แคปชัน", cta: "ทัก LINE", hook: "ฮุก", status: "scheduled" };
  h.posts = [];
  h.video = { id: "v1" };
  h.updates = [];
  h.audits = [];
  h.notes = [];
  h.publish.mockReset().mockResolvedValue(okPublish);
});

describe("publishPendingAutopilotRuns", () => {
  it("posts a piece the producing run ran out of time to publish, and closes the run", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    const res = await publishPendingAutopilotRuns();
    expect(res).toMatchObject({ checked: 1, published: 1, failed: 0 });
    expect(h.publish).toHaveBeenCalledWith(expect.objectContaining({ platforms: ["facebook", "instagram", "tiktok"], assetIds: ["v1"], scheduleAt: null, userId: "u1" }));
    const done = h.updates.find((u) => u.table === "studio_autopilot_runs")!;
    expect(done.payload).toMatchObject({ status: "done", published: true });
    expect((done.payload.stats as { posts: number; recovered: boolean; format: string })).toMatchObject({ posts: 2, recovered: true, format: "template" });
    expect(h.audits[0]).toMatchObject({ action: "STUDIO_SOCIAL_POST", entityId: "m1" });
    expect(h.notes[0]).toContain("https://fb/1");
  });
  it("never posts behind the owner's switches", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    for (const cfg of [{ enabled: false }, { auto_publish: false }, { platforms: [] }]) {
      h.settings.autopilot = { enabled: true, auto_publish: true, platforms: ["facebook"], ...cfg };
      expect(await publishPendingAutopilotRuns()).toMatchObject({ checked: 0, published: 0 });
    }
    expect(h.publish).not.toHaveBeenCalled();
  });
  it("leaves a piece alone unless it is still an approved, unposted piece with a ready video", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    h.master = { ...h.master, status: "archived" };
    expect(await publishPendingAutopilotRuns()).toMatchObject({ skipped: 1, published: 0 });
    h.master = { id: "m1", title: "t", caption: null, cta: null, hook: null, status: "approved" };
    h.video = null;
    expect(await publishPendingAutopilotRuns()).toMatchObject({ skipped: 1, published: 0 });
    expect(h.publish).not.toHaveBeenCalled();
  });
  it("closes a run whose master was already posted instead of posting twice", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    h.posts = [{ id: "p1" }];
    const res = await publishPendingAutopilotRuns();
    expect(res).toMatchObject({ skipped: 1, published: 0 });
    expect(h.publish).not.toHaveBeenCalled();
    expect(h.updates.find((u) => u.table === "studio_autopilot_runs")?.payload).toMatchObject({ published: true });
  });
  it("records a rejected publish on the run and tells the owner", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    h.publish.mockResolvedValue({ ok: false, code: "blocked", error: "แคปชันยังมีข้อมูลที่ระบุตัวตนได้" });
    const res = await publishPendingAutopilotRuns();
    expect(res).toMatchObject({ failed: 1, published: 0 });
    expect(h.updates.find((u) => u.table === "studio_autopilot_runs")?.payload).toMatchObject({ stopped_at: "publish_failed" });
    expect(h.notes[0]).toContain("ไม่สำเร็จ");
    expect(h.audits).toHaveLength(0);
  });
  it("keeps going when one run throws, and reports settings that cannot be read", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    h.runs = [run({ id: "r1" }), run({ id: "r2" })];
    h.publish.mockRejectedValueOnce(new Error("provider down")).mockResolvedValue(okPublish);
    const res = await publishPendingAutopilotRuns();
    expect(res).toMatchObject({ checked: 2, failed: 1, published: 1 });
    expect(res.errors[0]).toContain("provider down");

    h.settingsError = new Error("settings unavailable");
    const closed = await publishPendingAutopilotRuns();
    expect(closed.errors[0]).toContain("settings unavailable");
    expect(closed.checked).toBe(0);
  });
});
