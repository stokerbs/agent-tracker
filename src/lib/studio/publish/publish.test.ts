import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishProvider } from "./provider";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  settings: {
    privacy_rules: { denylist: ["บริษัทลับ"], custom_patterns: [], strict_mode: false },
    social_connections: { ayrshare: { checked_at: "2026-09-10T00:00:00Z", active: ["facebook", "instagram", "tiktok"], display_names: {} }, defaults: { youtube_visibility: "public", tiktok_privacy: "PUBLIC_TO_EVERYONE" } },
  },
  assets: [] as Row[],
  socialRows: [] as Row[],
  inserts: [] as Row[],
  updates: [] as { table: string; payload: Row; eq: [string, unknown][]; in: [string, unknown[]][] }[],
  downloads: [] as string[],
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/studio/settings", () => ({ getStudioSettingsStrict: vi.fn(async () => h.settings) }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const st = { op: "select", payload: null as Row | null, eq: [] as [string, unknown][], in: [] as [string, unknown[]][] };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit", "not", "neq"]) b[m] = () => b;
      b.eq = (c: string, v: unknown) => (st.eq.push([c, v]), b);
      b.in = (c: string, v: unknown[]) => (st.in.push([c, v]), b);
      b.insert = (rows: Row[] | Row) => ((st.op = "insert"), (st.payload = rows as Row), h.inserts.push(...(Array.isArray(rows) ? rows : [rows])), b);
      b.update = (row: Row) => ((st.op = "update"), (st.payload = row), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        if (st.op === "update") {
          h.updates.push({ table, payload: st.payload!, eq: st.eq, in: st.in });
          return Promise.resolve(resolve({ data: null, error: null }));
        }
        if (st.op === "insert") return Promise.resolve(resolve({ data: (Array.isArray(st.payload) ? st.payload : [st.payload]).map((r, i) => ({ ...(r as Row), id: `sp-${i}` })), error: null }));
        let data: Row[] = table === "studio_creative_assets" ? h.assets : table === "studio_social_posts" ? h.socialRows : [];
        for (const [c, v] of st.eq) data = data.filter((r) => r[c] === v);
        for (const [c, v] of st.in) data = data.filter((r) => (v as unknown[]).includes(r[c]));
        return Promise.resolve(resolve({ data, error: null }));
      };
      return b;
    },
    storage: { from: () => ({ download: async (path: string) => (h.downloads.push(path), { data: new Blob([new Uint8Array([1, 2, 3])]), error: null }) }) },
  }),
}));

const MASTER = "11111111-1111-4111-8111-111111111111";
const master = { id: MASTER, title: "ชื่อ", caption: "แคปชันปลอดภัย", cta: "ปรึกษาทาง LINE", hook: "hook", scheduled_at: null };
const img = (id: string, extra: Row = {}) => ({ id, master_id: MASTER, kind: "image", mime: "image/png", status: "ready", storage_path: `${MASTER}/${id}.png`, external_url: null, bytes: 3, meta: {}, ...extra });

function fakeProvider(over: Partial<PublishProvider> = {}): PublishProvider & { calls: Row[] } {
  const calls: Row[] = [];
  return {
    name: "ayrshare",
    calls,
    connectedPlatforms: async () => ({ active: ["facebook"], displayNames: {}, checkedAt: "now" }),
    uploadMedia: async (i) => (calls.push({ upload: i.fileName }), { url: `https://ayr/${i.fileName}` }),
    createPost: async (i) => (calls.push({ post: i }), { providerPostId: "P1", refId: "R1", status: i.scheduleAt ? "scheduled" : "success", perPlatform: Object.fromEntries(i.platforms.map((p) => [p, { status: i.scheduleAt ? "pending" : "success", id: `${p}_1`, postUrl: `https://${p}/1` }])) }),
    deletePost: async () => void calls.push({ delete: true }),
    postStatus: async (id) => ({ providerPostId: id, status: "success", perPlatform: { facebook: { status: "success", postUrl: "https://fb/9" } } }),
    ...over,
  };
}

beforeEach(() => {
  h.assets = [img("a1"), img("a2", { external_url: "https://ayr/cached.png" }), { ...img("au"), kind: "audio", mime: "audio/mpeg" }];
  h.socialRows = [];
  h.inserts = [];
  h.updates = [];
  h.downloads = [];
});

describe("publishMaster", () => {
  it("uploads uncached media, posts to every platform, records rows and flips the master", async () => {
    const provider = fakeProvider();
    const { publishMaster } = await import("./publish");
    const r = await publishMaster({ master, variants: [{ id: "v1", platform: "instagram_reel", caption: "IG เฉพาะ", hook: null }], platforms: ["facebook", "instagram"], assetIds: ["a1", "a2"], scheduleAt: null, userId: "u1" }, { provider });
    expect(r.ok).toBe(true);
    expect(h.downloads).toEqual([`${MASTER}/a1.png`]); // a2 already cached
    const post = provider.calls.find((c) => c.post)!.post as { mediaUrls: string[]; platforms: string[]; text: string };
    expect(post.mediaUrls).toEqual(["https://ayr/a1.png", "https://ayr/cached.png"]);
    expect(post.platforms).toEqual(["facebook", "instagram"]);
    const rows = h.inserts.filter((i) => i.platform);
    expect(rows.map((x) => [x.platform, x.status])).toEqual([["facebook", "published"], ["instagram", "published"]]);
    expect(rows[1].caption_chars).toBe("IG เฉพาะ".length);
    expect(rows[0].media_asset_ids).toEqual(["a1", "a2"]);
    expect(JSON.stringify(rows)).not.toContain("แคปชัน"); // captions never stored
    const cache = h.updates.find((u) => u.table === "studio_creative_assets");
    expect(cache?.payload.external_url).toBe("https://ayr/a1.png");
  });
  it("keeps rows scheduled when the provider holds the schedule and does not flip the master", async () => {
    const provider = fakeProvider();
    h.socialRows = [];
    const { publishMaster } = await import("./publish");
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const r = await publishMaster({ master, variants: [], platforms: ["facebook"], assetIds: [], scheduleAt: future, userId: "u1" }, { provider });
    expect(r.ok && r.scheduled).toBe(true);
    expect(h.inserts[0]).toMatchObject({ status: "scheduled", scheduled_at: future, published_at: null });
    expect(h.updates.some((u) => u.table === "studio_content_masters")).toBe(false);
  });
  it("refuses platforms not linked at the aggregator", async () => {
    const { publishMaster } = await import("./publish");
    const r = await publishMaster({ master, variants: [], platforms: ["youtube"], assetIds: [], scheduleAt: null, userId: "u1" }, { provider: fakeProvider() });
    expect(r).toMatchObject({ ok: false, code: "not_connected" });
  });
  it("blocks a caption that still carries an identifier before any provider call", async () => {
    const provider = fakeProvider();
    const { publishMaster } = await import("./publish");
    const r = await publishMaster({ master: { ...master, caption: "โทร 081-234-5678" }, variants: [], platforms: ["facebook"], assetIds: [], scheduleAt: null, userId: "u1" }, { provider });
    expect(r).toMatchObject({ ok: false, code: "blocked" });
    const d = await publishMaster({ master: { ...master, caption: "งานของ บริษัทลับ" }, variants: [], platforms: ["facebook"], assetIds: [], scheduleAt: null, userId: "u1" }, { provider });
    expect(d).toMatchObject({ ok: false, code: "blocked" });
    expect(provider.calls).toHaveLength(0);
  });
  it("enforces platform media requirements and asset ownership", async () => {
    const provider = fakeProvider();
    const { publishMaster } = await import("./publish");
    const ig = await publishMaster({ master, variants: [], platforms: ["instagram"], assetIds: [], scheduleAt: null, userId: "u1" }, { provider });
    expect(ig).toMatchObject({ ok: false, code: "requirements" });
    if (!ig.ok) expect(ig.details?.instagram).toMatch(/Instagram/);
    const audio = await publishMaster({ master, variants: [], platforms: ["facebook"], assetIds: ["au"], scheduleAt: null, userId: "u1" }, { provider });
    expect(audio).toMatchObject({ ok: false, code: "requirements" });
    const foreign = await publishMaster({ master, variants: [], platforms: ["facebook"], assetIds: ["not-mine"], scheduleAt: null, userId: "u1" }, { provider });
    expect(foreign).toMatchObject({ ok: false, code: "requirements" });
    expect(provider.calls).toHaveLength(0);
  });
  it("maps a provider rejection to per-platform details", async () => {
    const { PublishRejectedError } = await import("./provider");
    const provider = fakeProvider({
      createPost: async () => {
        throw new PublishRejectedError("nope", { facebook: "token expired" });
      },
    });
    const { publishMaster } = await import("./publish");
    const r = await publishMaster({ master, variants: [], platforms: ["facebook"], assetIds: [], scheduleAt: null, userId: "u1" }, { provider });
    expect(r).toMatchObject({ ok: false, code: "rejected", details: { facebook: "token expired" } });
    expect(h.inserts).toHaveLength(0);
  });
});

describe("syncSocialPosts", () => {
  it("marks scheduled rows published from provider status and flips the master", async () => {
    h.socialRows = [{ id: "sp1", master_id: MASTER, platform: "facebook", provider_post_id: "P1", status: "scheduled", post_url: null, published_at: null }];
    const provider = fakeProvider();
    const { syncSocialPosts } = await import("./publish");
    const r = await syncSocialPosts({ provider });
    expect(r).toMatchObject({ checked: 1, published: 1, failed: 0 });
    const upd = h.updates.find((u) => u.table === "studio_social_posts");
    expect(upd?.payload).toMatchObject({ status: "published", post_url: "https://fb/9" });
  });
  it("marks failures and counts provider lookup errors without aborting", async () => {
    h.socialRows = [
      { id: "sp1", master_id: MASTER, platform: "facebook", provider_post_id: "P1", status: "queued" },
      { id: "sp2", master_id: MASTER, platform: "instagram", provider_post_id: "P2", status: "queued" },
    ];
    const provider = fakeProvider({
      postStatus: async (id) => {
        if (id === "P2") throw new Error("network");
        return { providerPostId: id, status: "error", perPlatform: { facebook: { status: "error", error: "rejected by platform" } } };
      },
    });
    const { syncSocialPosts } = await import("./publish");
    const r = await syncSocialPosts({ provider });
    expect(r.failed).toBe(1);
    expect(r.errors).toHaveLength(1);
    expect(h.updates.find((u) => u.table === "studio_social_posts")?.payload).toMatchObject({ status: "failed", error: "rejected by platform" });
  });
});

describe("refreshConnections / deleteProviderPost", () => {
  it("persists the connection snapshot into settings", async () => {
    const { refreshConnections } = await import("./publish");
    const r = await refreshConnections({ provider: fakeProvider() });
    expect(r).toMatchObject({ ok: true, active: ["facebook"] });
    const upd = h.updates.find((u) => u.table === "studio_settings");
    expect((upd?.payload.social_connections as { ayrshare: { active: string[] } }).ayrshare.active).toEqual(["facebook"]);
  });
  it("deletes at the provider then marks rows deleted", async () => {
    const provider = fakeProvider();
    const { deleteProviderPost } = await import("./publish");
    expect(await deleteProviderPost("P1", { provider })).toEqual({ ok: true });
    expect(provider.calls.some((c) => c.delete)).toBe(true);
    expect(h.updates.find((u) => u.table === "studio_social_posts")?.payload).toEqual({ status: "deleted" });
  });
});
