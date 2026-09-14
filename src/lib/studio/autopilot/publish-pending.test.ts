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
  updates: [] as { table: string; payload: Row; predicates: unknown[][] }[],
  filters: [] as { chain: number; table: string; m: string; args: unknown[] }[],
  chains: 0,
  claim: { id: "r1" } as Row | null,
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
      // Each from() starts a new chain: the load query is chain 1, so its filters can be asserted on their own
      // (the claim's compare-and-set hits the same table and would otherwise satisfy the assertions).
      const chain = ++h.chains;
      const st = { op: "select", payload: null as Row | null };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "not", "gte", "in", "order", "limit", "maybeSingle", "single"]) {
        b[m] = (...args: unknown[]) => (h.filters.push({ chain, table, m, args }), b);
      }
      b.update = (row: Row) => ((st.op = "update"), (st.payload = row), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        if (st.op === "update") {
          // the filters collected on this same chain ARE the compare-and-set predicate
          h.updates.push({ table, payload: st.payload!, predicates: h.filters.filter((f) => f.chain === chain).map((f) => [f.m, ...f.args]) });
          // the claim update is the only one that reads a row back
          return Promise.resolve(resolve({ data: st.payload?.stopped_at === "publishing" ? h.claim : null, error: null }));
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
  h.master = { id: "m1", title: "หัวข้อ", caption: "แคปชัน", cta: "ทัก LINE", hook: "ฮุก", status: "scheduled", scheduled_at: null };
  h.posts = [];
  h.video = { id: "v1" };
  h.updates = [];
  h.filters = [];
  h.chains = 0;
  h.claim = { id: "r1" };
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
    const done = h.updates.find((u) => u.payload.status === "done")!;
    expect(done.payload).toMatchObject({ status: "done", published: true });
    expect((done.payload.stats as { posts: number; recovered: boolean; format: string })).toMatchObject({ posts: 2, recovered: true, format: "template" });
    expect(h.audits[0]).toMatchObject({ action: "STUDIO_SOCIAL_POST", entityId: "m1" });
    expect(h.notes[0]).toContain("https://fb/1");
  });
  it("only ever looks at finished-but-unposted runs from the last day", async () => {
    const { publishPendingAutopilotRuns, PENDING_WINDOW_MS } = await import("./publish-pending");
    const now = Date.now();
    await publishPendingAutopilotRuns({ now });
    // chain 1 is the load query itself — not the later claim, which filters the same table
    const runFilters = h.filters.filter((f) => f.chain === 1);
    expect(runFilters.every((f) => f.table === "studio_autopilot_runs")).toBe(true);
    expect(runFilters.map((f) => [f.m, ...f.args])).toContainEqual(["eq", "stopped_at", "timeout_before_publish"]);
    expect(runFilters.map((f) => [f.m, ...f.args])).toContainEqual(["eq", "published", false]);
    expect(runFilters.map((f) => [f.m, ...f.args])).toContainEqual(["not", "master_id", "is", null]);
    const since = runFilters.find((f) => f.m === "gte");
    expect(since).toBeTruthy();
    expect(Date.parse(String(since?.args[1]))).toBe(now - PENDING_WINDOW_MS);
    // a post that failed or was deleted must not count as "already posted"
    expect(h.filters.filter((f) => f.table === "studio_social_posts").map((f) => [f.m, ...f.args])).toContainEqual(["in", "status", ["queued", "scheduled", "published"]]);
  });
  it("leaves a piece the owner scheduled for later alone", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    h.master = { ...h.master, status: "scheduled", scheduled_at: new Date(Date.now() + 3 * 3600_000).toISOString() };
    expect(await publishPendingAutopilotRuns()).toMatchObject({ skipped: 1, published: 0 });
    expect(h.publish).not.toHaveBeenCalled();
    // a time that has already passed is fine to post
    h.master = { ...h.master, scheduled_at: new Date(Date.now() - 60_000).toISOString() };
    expect(await publishPendingAutopilotRuns()).toMatchObject({ published: 1 });
  });
  it("claims the run before going public, and skips when another sweep already has it", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    h.claim = null;
    expect(await publishPendingAutopilotRuns()).toMatchObject({ skipped: 1, published: 0 });
    expect(h.publish).not.toHaveBeenCalled();
    const claim = h.updates.find((u) => u.payload.stopped_at === "publishing");
    expect(claim).toBeTruthy();
    // the claim is only a claim because of its predicate: without it every sweep "wins" and posts again
    expect(claim!.predicates).toContainEqual(["eq", "stopped_at", "timeout_before_publish"]);
    expect(claim!.predicates).toContainEqual(["eq", "published", false]);
  });
  it("closes and hands back the claim only while the run is still the one it claimed", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    await publishPendingAutopilotRuns();
    // marking the run done must not steal a run another worker already published
    const done = h.updates.find((u) => u.payload.status === "done")!;
    expect(done.predicates).toContainEqual(["eq", "published", false]);

    h.updates = [];
    h.filters = [];
    h.chains = 0;
    h.video = null;
    await publishPendingAutopilotRuns();
    // handing the claim back only applies to a run this sweep still holds
    const handBack = h.updates.find((u) => u.payload.stopped_at === "timeout_before_publish")!;
    expect(handBack.predicates).toContainEqual(["eq", "stopped_at", "publishing"]);
  });
  it("hands the claim back when the video is missing, and records a thrown failure", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    h.video = null;
    await publishPendingAutopilotRuns();
    expect(h.updates.map((u) => u.payload.stopped_at)).toContain("timeout_before_publish");

    h.video = { id: "v1" };
    h.updates = [];
    h.publish.mockRejectedValue(new Error("provider exploded"));
    expect(await publishPendingAutopilotRuns()).toMatchObject({ failed: 1 });
    expect(h.updates.some((u) => u.payload.stopped_at === "publish_failed")).toBe(true);
  });
  it("never posts behind the owner's switches", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    for (const cfg of [{ enabled: false }, { auto_publish: false }]) {
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
    expect(h.updates.some((u) => u.payload.published === true)).toBe(true);
  });
  it("records a rejected publish on the run and tells the owner", async () => {
    const { publishPendingAutopilotRuns } = await import("./publish-pending");
    h.publish.mockResolvedValue({ ok: false, code: "blocked", error: "แคปชันยังมีข้อมูลที่ระบุตัวตนได้" });
    const res = await publishPendingAutopilotRuns();
    expect(res).toMatchObject({ failed: 1, published: 0 });
    const failed = h.updates.find((u) => u.payload.stopped_at === "publish_failed")!;
    expect(failed).toBeDefined();
    // only our own claim may be marked failed — another worker's run must stay untouched
    expect(failed.predicates).toContainEqual(["eq", "stopped_at", "publishing"]);
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
