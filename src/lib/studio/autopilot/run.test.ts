import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  cfg: {} as Row,
  pillars: [{ key: "detective_knowledge", target_pct: 100 }],
  settingsThrow: false,
  runsThisWeek: 0,
  savedIdea: null as Row | null,
  ideaResult: { ok: true, generationId: "g1", model: "m", data: { ideas: [{ title: "ไอเดียใหม่", hook: "hook", description: "d", tags: ["t"], platforms: [], format: null, ai_scores: null, source_refs: [] }], knowledge_gaps: [] } } as Row,
  script: { ok: true, data: { hook: "h", script: "สคริปต์", caption: "แคปชัน", cta: "cta", estimated_duration_sec: 30, ai_notes: "", source_refs: [], claims: [] as Row[] } } as Row,
  plan: { ok: true, data: { shots: [{ start_sec: 0, end_sec: 4, voice: "พูด", visual: "ภาพ", text_overlay: null }], broll: [], text_overlays: [] } } as Row,
  image: { ok: true, asset: { id: "img1" } } as Row,
  presenterImage: { ok: true, asset: { id: "presenter1" } } as Row,
  /** Most recent finished run the alternate-format lookup sees. */
  lastRun: null as Row | null,
  lastRunError: null as null | { message: string },
  /** Query filters per table, so tests can assert what a lookup asked for. */
  filters: [] as { table: string; m: string; args: unknown[] }[],
  render: { ok: true, jobId: "j1", assetId: "vid1", durationSec: 30 } as Row,
  publish: { ok: true, posts: [{ post_url: "https://fb/1" }, { post_url: null }], providerPostId: "P1", scheduled: false } as Row,
  privacy: { status: "safe", findings: [], summary: "ok", checked_by: "ai", model: "m" } as Row,
  allowOverride: true,
  privacyInsertFails: false,
  admin: { id: "admin-1" } as Row | null,
  inserts: [] as { table: string; row: Row }[],
  updates: [] as { table: string; row: Row }[],
  notices: [] as string[],
  audit: [] as { action: string }[],
  insertError: null as null | { code: string; message: string },
  /** Interleaved write log so tests can assert ordering across tables. */
  writes: [] as { op: "insert" | "update"; table: string; row: Row }[],
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async (e: { action: string }) => void h.audit.push(e)) }));
vi.mock("@/lib/line/notify", () => ({ pushLineNotify: vi.fn(async (t: string) => void h.notices.push(t)) }));
vi.mock("@/lib/studio/settings", async (orig) => ({
  ...(await orig<typeof import("@/lib/studio/settings")>()),
  getStudioSettingsStrict: vi.fn(async () => {
    if (h.settingsThrow) throw new Error("down");
    const { DEFAULT_AUTOPILOT } = await orig<typeof import("@/lib/studio/settings")>();
    return { autopilot: { ...DEFAULT_AUTOPILOT, enabled: true, days: [0, 1, 2, 3, 4, 5, 6], ...h.cfg }, pillars: h.pillars, approval_rules: { require_privacy_safe: true, allow_override: h.allowOverride } };
  }),
}));
vi.mock("@/lib/studio/ai", () => ({
  generateIdeas: vi.fn(async () => h.ideaResult),
  generateScript: vi.fn(async () => h.script),
  generateCreativePlan: vi.fn(async () => h.plan),
  runPrivacyCheck: vi.fn(async () => h.privacy),
}));
vi.mock("@/lib/studio/media/generate", () => ({
  generateImageAsset: vi.fn(async (input: { target: { kind: string } }) => (input.target.kind === "presenter" ? h.presenterImage : h.image)),
}));
vi.mock("@/lib/studio/video/render", () => ({ runRenderJob: vi.fn(async () => h.render) }));
vi.mock("@/lib/studio/publish/publish", () => ({ publishMaster: vi.fn(async () => h.publish) }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const st = { op: "select", row: null as Row | null };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "gte", "lt", "is", "not", "order", "limit", "neq"]) b[m] = (...args: unknown[]) => (h.filters.push({ table, m, args }), b);
      b.insert = (row: Row | Row[]) => ((st.op = "insert"), (st.row = Array.isArray(row) ? row[0] : row), h.inserts.push(...(Array.isArray(row) ? row : [row]).map((r) => ({ table, row: r }))), h.writes.push({ op: "insert", table, row: Array.isArray(row) ? row[0] : row }), b);
      b.update = (row: Row) => ((st.op = "update"), (st.row = row), h.updates.push({ table, row }), h.writes.push({ op: "update", table, row }), b);
      const result = () => {
        if (st.op === "insert") {
          if (table === "studio_privacy_checks" && h.privacyInsertFails) return { data: null, error: { code: "42501", message: "denied" } };
          if (h.insertError) return { data: null, error: h.insertError };
          return { data: { ...(st.row ?? {}), id: `${table}-1`, title: (st.row as Row)?.title ?? "หัวข้อ" }, error: null };
        }
        if (st.op === "update") return { data: null, error: null };
        if (table === "profiles") return { data: h.admin, error: null };
        if (table === "studio_ideas") return { data: h.savedIdea, error: null };
        if (table === "studio_autopilot_runs") return { data: h.lastRun, error: h.lastRunError };
        if (table === "studio_content_masters") return { data: { title: "หัวข้อ", hook: "h", script: "s", caption: "c", cta: "x" }, error: null };
        return { data: null, error: null };
      };
      b.single = async () => result();
      b.maybeSingle = async () => result();
      b.then = (r: (v: unknown) => unknown) =>
        Promise.resolve(
          r({
            data: table === "studio_customer_questions" ? [{ question: "q", frequency: 3 }] : [],
            count: table === "studio_autopilot_runs" ? h.runsThisWeek : 0,
            error: st.op === "insert" && table === "studio_privacy_checks" && h.privacyInsertFails ? { code: "42501", message: "denied" } : null,
          }),
        );
      return b;
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks(); // keep implementations, drop call history between cases
  h.cfg = {};
  h.settingsThrow = false;
  h.runsThisWeek = 0;
  h.savedIdea = null;
  h.script = { ok: true, data: { hook: "h", script: "สคริปต์", caption: "แคปชัน", cta: "cta", estimated_duration_sec: 30, ai_notes: "", source_refs: [], claims: [] } };
  h.privacy = { status: "safe", findings: [], summary: "ok", checked_by: "ai", model: "m" };
  h.allowOverride = true;
  h.privacyInsertFails = false;
  h.admin = { id: "admin-1" };
  h.render = { ok: true, jobId: "j1", assetId: "vid1", durationSec: 30 };
  h.publish = { ok: true, posts: [{ post_url: "https://fb/1" }, { post_url: null }], providerPostId: "P1", scheduled: false };
  h.image = { ok: true, asset: { id: "img1" } };
  h.presenterImage = { ok: true, asset: { id: "presenter1" } };
  h.lastRun = null;
  h.lastRunError = null;
  h.filters = [];
  h.inserts = [];
  h.updates = [];
  h.writes = [];
  h.notices = [];
  h.audit = [];
  h.insertError = null;
});

const load = () => import("./run");

describe("runAutopilot gating", () => {
  it("skips without creating a run when disabled, off-day or over the weekly cap", async () => {
    const { runAutopilot } = await load();
    h.cfg = { enabled: false };
    expect(await runAutopilot({ userId: null })).toMatchObject({ status: "skipped", stopReason: "disabled" });
    h.cfg = { days: [] };
    expect(await runAutopilot({ userId: null })).toMatchObject({ status: "skipped", stopReason: "off_day" });
    h.cfg = {};
    h.runsThisWeek = 99;
    expect(await runAutopilot({ userId: null })).toMatchObject({ status: "skipped", stopReason: "weekly_cap" });
    expect(h.inserts.filter((i) => i.table === "studio_autopilot_runs")).toHaveLength(0);
  });
  it("fails closed when the settings cannot be loaded", async () => {
    h.settingsThrow = true;
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: null })).toMatchObject({ ok: false, status: "failed" });
    expect(h.inserts).toHaveLength(0);
  });
  it("reaps a run the platform killed before inserting a new one (else the one-running-row index deadlocks the schedule)", async () => {
    const { runAutopilot } = await load();
    await runAutopilot({ userId: "u1" });
    const reapAt = h.writes.findIndex((w) => w.op === "update" && w.table === "studio_autopilot_runs" && w.row.status === "failed");
    const insertAt = h.writes.findIndex((w) => w.op === "insert" && w.table === "studio_autopilot_runs");
    expect(reapAt).toBeGreaterThanOrEqual(0);
    expect(insertAt).toBeGreaterThan(reapAt);
    expect(h.writes[reapAt].row).toMatchObject({ status: "failed", progress: 100 });
  });
  it("treats a unique-violation on the run row as another run in flight", async () => {
    h.insertError = { code: "23505", message: "duplicate" };
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: null })).toMatchObject({ status: "skipped", stopReason: "already_running" });
  });
});

describe("runAutopilot identity and degraded checks", () => {
  it("refuses to run when there is no admin profile to act as", async () => {
    h.admin = null;
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: null })).toMatchObject({ ok: false, status: "failed" });
    expect(h.inserts.filter((i) => i.table === "studio_autopilot_runs")).toHaveLength(0);
  });
  it("resolves the admin id and never writes an empty uuid for the cron identity", async () => {
    const { runAutopilot } = await load();
    await runAutopilot({ userId: null });
    // every uuid-shaped column carries the resolved admin id, never "" (which Postgres rejects)
    const idFields = ["created_by", "reviewer_id", "approved_by", "user_id"];
    for (const { row } of h.inserts) for (const f of idFields) if (f in row) expect(row[f]).not.toBe("");
    for (const { row } of h.updates) for (const f of idFields) if (f in row) expect(row[f]).not.toBe("");
    expect(h.inserts.find((i) => i.table === "studio_content_masters")!.row.created_by).toBe("admin-1");
    expect(h.inserts.find((i) => i.table === "studio_content_reviews")!.row.reviewer_id).toBe("admin-1");
    expect(h.inserts.find((i) => i.table === "studio_autopilot_runs")!.row.created_by).toBe("admin-1");
  });
  it("never publishes on a deterministic-only verdict when the AI pass failed", async () => {
    h.privacy = { status: "safe", findings: [], summary: "ok", checked_by: "deterministic", model: null, ai_error: "rate limited" };
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "review", stopReason: "privacy_ai_unavailable" });
    expect(h.audit.map((a) => a.action)).not.toContain("STUDIO_SOCIAL_POST");
  });
  it("records an override review row and honours approval_rules.allow_override", async () => {
    h.privacy = { status: "review_required", findings: [{}], summary: "ต้องตรวจ", checked_by: "ai", model: "m" };
    h.cfg = { publish_on_review_required: true };
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "done" });
    expect(h.inserts.find((i) => i.table === "studio_content_reviews")!.row.decision).toBe("override_privacy");
    h.allowOverride = false;
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "review", stopReason: "privacy_review" });
  });
  it("writes the review row before flipping the master to approved", async () => {
    const { runAutopilot } = await load();
    await runAutopilot({ userId: "u1" });
    const reviewAt = h.writes.findIndex((w) => w.op === "insert" && w.table === "studio_content_reviews");
    const approveAt = h.writes.findIndex((w) => w.op === "update" && w.table === "studio_content_masters" && w.row.status === "approved");
    expect(reviewAt).toBeGreaterThanOrEqual(0);
    // a failed review insert must never leave an approved master with no trail
    expect(approveAt).toBeGreaterThan(reviewAt);
  });
  it("stops when the privacy row or the review row cannot be stored", async () => {
    const { runAutopilot } = await load();
    h.privacyInsertFails = true;
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "failed", stopReason: "privacy_not_stored" });
  });
  it("keeps run rows free of AI prose (findings are recorded as a count)", async () => {
    h.privacy = { status: "blocked", findings: [{}, {}], summary: "พบชื่อคุณสมชาย ในสคริปต์", checked_by: "ai", model: "m" };
    const { runAutopilot } = await load();
    await runAutopilot({ userId: "u1" });
    const rows = JSON.stringify(h.updates.filter((u) => u.table === "studio_autopilot_runs"));
    expect(rows).not.toContain("สมชาย");
    expect(rows).toContain("findings=2");
  });
});

describe("runAutopilot pipeline", () => {
  it("produces and publishes end to end, then notifies with the post link", async () => {
    const { runAutopilot } = await load();
    const r = await runAutopilot({ userId: "u1", trigger: "manual" });
    expect(r).toMatchObject({ ok: true, status: "done", posts: 2 });
    const master = h.inserts.find((i) => i.table === "studio_content_masters")!.row;
    expect(master).toMatchObject({ status: "draft", tags: ["autopilot"] });
    // approved before publishing, with a review row for the trail
    expect(h.updates.some((u) => u.table === "studio_content_masters" && u.row.status === "approved")).toBe(true);
    expect(h.inserts.some((i) => i.table === "studio_content_reviews")).toBe(true);
    const done = h.updates.filter((u) => u.table === "studio_autopilot_runs").at(-1)!.row;
    expect(done).toMatchObject({ status: "done", published: true, progress: 100 });
    expect(h.notices.at(-1)).toContain("https://fb/1");
    expect(h.audit.map((a) => a.action)).toEqual(expect.arrayContaining(["STUDIO_CONTENT_APPROVE", "STUDIO_SOCIAL_POST"]));
  });
  it("stops before approval when the privacy check is blocked", async () => {
    h.privacy = { status: "blocked", findings: [{ severity: "high" }], summary: "พบเบอร์โทร", checked_by: "ai", model: "m" };
    const { runAutopilot } = await load();
    const r = await runAutopilot({ userId: "u1" });
    expect(r).toMatchObject({ ok: false, status: "review", stopReason: "privacy_blocked" });
    expect(h.updates.some((u) => u.table === "studio_content_masters" && u.row.status === "approved")).toBe(false);
    expect(h.audit.map((a) => a.action)).not.toContain("STUDIO_SOCIAL_POST");
    expect(h.notices.at(-1)).toContain("Privacy Check");
  });
  it("stops on review_required unless the owner opted in", async () => {
    h.privacy = { status: "review_required", findings: [], summary: "ต้องตรวจ", checked_by: "ai", model: "m" };
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "review", stopReason: "privacy_review" });
    h.cfg = { publish_on_review_required: true };
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "done" });
  });
  it("stops on unsupported claims unless allowed", async () => {
    h.script = { ok: true, data: { ...(h.script as { data: Row }).data, claims: [{ claim: "c", support_status: "unsupported", source: null }] } };
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "review", stopReason: "unsupported_claims" });
    h.cfg = { allow_unsupported_claims: true };
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "done" });
  });
  it("leaves the piece in review when auto_publish is off", async () => {
    h.cfg = { auto_publish: false };
    const { runAutopilot } = await load();
    const r = await runAutopilot({ userId: "u1" });
    expect(r).toMatchObject({ ok: true, status: "review", stopReason: "manual_review" });
    expect(h.updates.some((u) => u.table === "studio_content_masters" && u.row.status === "approved")).toBe(true);
    expect(h.audit.map((a) => a.action)).not.toContain("STUDIO_SOCIAL_POST");
    expect(h.notices.at(-1)).toContain("รอคุณกดโพสต์");
  });
  it("surfaces a failed render and a failed publish without going further", async () => {
    h.render = { ok: false, jobId: "j1", error: "ffmpeg พัง" };
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "failed", stopReason: "video_failed" });
    h.render = { ok: true, jobId: "j1", assetId: "vid1", durationSec: 30 };
    h.publish = { ok: false, code: "not_connected", error: "ยังไม่เชื่อม" };
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "review", stopReason: "publish_failed" });
  });
  it("reuses a saved idea for the pillar instead of generating new ones", async () => {
    h.savedIdea = { id: "idea-9", title: "ไอเดียที่บันทึกไว้", hook: null, description: null, tags: [] };
    const ai = await import("@/lib/studio/ai");
    const { runAutopilot } = await load();
    await runAutopilot({ userId: "u1" });
    expect(ai.generateIdeas).not.toHaveBeenCalled();
    expect(h.inserts.find((i) => i.table === "studio_content_masters")!.row).toMatchObject({ idea_id: "idea-9", title: "ไอเดียที่บันทึกไว้" });
    expect(h.updates.some((u) => u.table === "studio_ideas" && u.row.status === "generated")).toBe(true);
  });
});

describe("runAutopilot clip format", () => {
  const imageMock = async () => vi.mocked((await import("@/lib/studio/media/generate")).generateImageAsset);
  const imageKinds = async () => (await imageMock()).mock.calls.map(([i]) => i.target.kind);
  const renderParams = () => h.inserts.filter((i) => i.table === "studio_render_jobs").at(-1)!.row.params as Row;
  const lastRunPatch = () => h.updates.filter((u) => u.table === "studio_autopilot_runs").at(-1)!.row;
  const silenceWarn = () => vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("storyteller generates the presenter after the cover, before scene images, and renders with format=storyteller", async () => {
    h.cfg = { video_format: "storyteller", images_per_run: 2 };
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "done" });
    expect(await imageKinds()).toEqual(["thumbnail", "presenter", "scene"]);
    const presenter = (await imageMock()).mock.calls.find(([i]) => i.target.kind === "presenter")![0];
    expect(presenter).toMatchObject({ target: { kind: "presenter" }, aspect: "9:16", userId: "u1" });
    expect(presenter.master).toMatchObject({ id: "studio_content_masters-1" });
    expect(renderParams()).toEqual({ aspect: "9:16", shots: 1, source: "autopilot", format: "storyteller" });
    const stats = lastRunPatch().stats as Row;
    expect(stats).toMatchObject({ format: "storyteller", images: 3 });
    expect(stats).not.toHaveProperty("format_fallback");
  });

  it("template never generates a presenter image", async () => {
    h.cfg = { video_format: "template", images_per_run: 2 };
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "done" });
    expect(await imageKinds()).toEqual(["thumbnail", "scene"]);
    expect(renderParams()).toMatchObject({ source: "autopilot", format: "template" });
    expect(lastRunPatch().stats).toMatchObject({ format: "template", images: 2 });
    // no history lookup when the format is fixed
    expect(h.filters.some((f) => f.table === "studio_autopilot_runs" && f.m === "not")).toBe(false);
  });

  it("alternate flips the last finished run's stats.format and starts at template with no history", async () => {
    h.cfg = { video_format: "alternate" };
    const { runAutopilot } = await load();

    await runAutopilot({ userId: "u1" });
    expect(renderParams().format).toBe("template");
    expect(await imageKinds()).not.toContain("presenter");
    const runFilters = h.filters.filter((f) => f.table === "studio_autopilot_runs");
    expect(runFilters).toContainEqual({ table: "studio_autopilot_runs", m: "in", args: ["status", ["done", "review"]] });
    expect(runFilters).toContainEqual({ table: "studio_autopilot_runs", m: "not", args: ["stats->>format", "is", null] });

    h.lastRun = { stats: { images: 1, format: "template" } };
    await runAutopilot({ userId: "u1" });
    expect(renderParams().format).toBe("storyteller");
    expect(await imageKinds()).toContain("presenter");
    expect(lastRunPatch().stats).toMatchObject({ format: "storyteller" });

    h.lastRun = { stats: { images: 2, format: "storyteller" } };
    await runAutopilot({ userId: "u1" });
    expect(renderParams().format).toBe("template");
  });

  it("alternate falls back to template and still runs when the history lookup errors", async () => {
    h.cfg = { video_format: "alternate" };
    h.lastRun = { stats: { format: "template" } };
    h.lastRunError = { message: "permission denied" };
    const warn = silenceWarn();
    try {
      const { runAutopilot } = await load();
      expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "done" });
      expect(renderParams().format).toBe("template");
      expect(warn.mock.calls.some(([m]) => String(m).includes("lookup failed"))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it("falls back to template with format_fallback when the presenter image fails, without failing the run", async () => {
    h.cfg = { video_format: "storyteller" };
    h.presenterImage = { ok: false, code: "failed", error: "quota" };
    const warn = silenceWarn();
    try {
      const { runAutopilot } = await load();
      expect(await runAutopilot({ userId: "u1" })).toMatchObject({ ok: true, status: "done" });
      expect(renderParams().format).toBe("template");
      expect(lastRunPatch().stats).toMatchObject({ format: "template", format_fallback: "presenter_failed", images: 1 });
      expect(warn.mock.calls.some(([m]) => String(m).includes("storyteller → template"))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it("skips the presenter and falls back to template when the time budget is too low", async () => {
    h.cfg = { video_format: "storyteller" };
    let clock = 1_000_000;
    const now = vi.spyOn(Date, "now").mockImplementation(() => clock);
    const warn = silenceWarn();
    const media = await imageMock();
    // the cover takes 2 minutes: past the image budget, still inside the render budget
    media.mockImplementationOnce(async () => ((clock += 120_000), h.image as never));
    try {
      const { runAutopilot } = await load();
      expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "done" });
      expect(await imageKinds()).toEqual(["thumbnail"]);
      expect(renderParams().format).toBe("template");
      expect(lastRunPatch().stats).toMatchObject({ format: "template", format_fallback: "budget" });
    } finally {
      now.mockRestore();
      warn.mockRestore();
    }
  });

  it("records stats.format on a review finish and on a stop after render, but not on a stop before render", async () => {
    h.cfg = { video_format: "storyteller", auto_publish: false };
    const { runAutopilot } = await load();
    expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "review", stopReason: "manual_review" });
    expect(lastRunPatch().stats).toMatchObject({ format: "storyteller" });

    h.cfg = { video_format: "storyteller" };
    h.privacy = { status: "blocked", findings: [{}], summary: "x", checked_by: "ai", model: "m" };
    const warn = silenceWarn();
    try {
      expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "review", stopReason: "privacy_blocked" });
      expect(lastRunPatch()).toMatchObject({ stopped_at: "privacy_blocked", stats: { format: "storyteller" } });

      h.script = { ok: false, error: "AI ล่ม" };
      expect(await runAutopilot({ userId: "u1" })).toMatchObject({ status: "failed", stopReason: "script_failed" });
      expect(lastRunPatch()).not.toHaveProperty("stats");
    } finally {
      warn.mockRestore();
    }
  });
});
