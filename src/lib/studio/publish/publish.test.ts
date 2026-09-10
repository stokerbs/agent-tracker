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
      for (const m of ["select", "order", "limit", "not"]) b[m] = () => b;
      const neq: [string, unknown][] = [];
      b.neq = (c: string, v: unknown) => (neq.push([c, v]), b);
      b.eq = (c: string, v: unknown) => (st.eq.push([c, v]), b);
      b.in = (c: string, v: unknown[]) => (st.in.push([c, v]), b);
      b.insert = (rows: Row[] | Row) => ((st.op = "insert"), (st.payload = rows as Row), h.inserts.push(...(Array.isArray(rows) ? rows : [rows])), b);
      b.update = (row: Row) => ((st.op = "update"), (st.payload = row), b);
      b.then = (resolve: (v: unknown) => unknown) => {
        if (st.op === "update") {
          h.updates.push({ table, payload: st.payload!, eq: st.eq, in: st.in });
          // Apply row patches to the social fixture so follow-up reads (flip check) see the DB as it would be.
          if (table === "studio_social_posts") {
            for (const r of h.socialRows) if (st.eq.every(([c, v]) => r[c] === v)) Object.assign(r, st.payload);
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        }
        if (st.op === "insert") return Promise.resolve(resolve({ data: (Array.isArray(st.payload) ? st.payload : [st.payload]).map((r, i) => ({ ...(r as Row), id: `sp-${i}` })), error: null }));
        let data: Row[] = table === "studio_creative_assets" ? h.assets : table === "studio_social_posts" ? h.socialRows : [];
        for (const [c, v] of st.eq) data = data.filter((r) => r[c] === v);
        for (const [c, v] of st.in) data = data.filter((r) => (v as unknown[]).includes(r[c]));
        for (const [c, v] of neq) data = data.filter((r) => r[c] !== v);
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
  it("uploads uncached media once, sends one request per distinct caption, records rows and flips the master", async () => {
    const provider = fakeProvider();
    const { publishMaster } = await import("./publish");
    const r = await publishMaster({ master, variants: [{ id: "v1", platform: "instagram_reel", caption: "IG เฉพาะ", hook: null }], platforms: ["facebook", "instagram", "tiktok"], assetIds: ["a1", "a2"], scheduleAt: null, userId: "u1" }, { provider });
    expect(r.ok).toBe(true);
    expect(h.downloads).toEqual([`${MASTER}/a1.png`]); // a2 already cached
    const posts = provider.calls.filter((c) => c.post).map((c) => c.post as { mediaUrls: string[]; platforms: string[]; text: string });
    expect(posts).toHaveLength(2); // facebook+tiktok share the master caption, instagram has its own
    expect(posts[0]).toMatchObject({ platforms: ["facebook", "tiktok"], text: "แคปชันปลอดภัย\n\nปรึกษาทาง LINE" });
    expect(posts[1]).toMatchObject({ platforms: ["instagram"], text: "IG เฉพาะ" });
    expect(posts[0].mediaUrls).toEqual(["https://ayr/a1.png", "https://ayr/cached.png"]);
    const rows = h.inserts.filter((i) => i.platform);
    expect(rows.map((x) => [x.platform, x.status])).toEqual([["facebook", "published"], ["tiktok", "published"], ["instagram", "published"]]);
    expect(rows.find((x) => x.platform === "instagram")).toMatchObject({ caption_chars: "IG เฉพาะ".length, variant_id: "v1" });
    expect(rows[0].variant_id).toBeNull();
    expect(rows[0].media_asset_ids).toEqual(["a1", "a2"]);
    expect(JSON.stringify(rows)).not.toContain("แคปชัน"); // captions never stored
    expect(h.updates.find((u) => u.table === "studio_creative_assets")?.payload.external_url).toBe("https://ayr/a1.png");
  });
  it("refuses a platform that already has a live/queued post for this master", async () => {
    h.socialRows = [{ id: "sp0", master_id: MASTER, platform: "facebook", status: "published" }];
    const provider = fakeProvider();
    const { publishMaster } = await import("./publish");
    const r = await publishMaster({ master, variants: [], platforms: ["facebook", "instagram"], assetIds: ["a1"], scheduleAt: null, userId: "u1" }, { provider });
    expect(r).toMatchObject({ ok: false, code: "duplicate" });
    if (!r.ok) expect(r.details?.facebook).toMatch(/โพสต์ไปแล้ว/);
    expect(provider.calls).toHaveLength(0);
  });
  it("rejects oversized media before any download or upload", async () => {
    h.assets.push(img("big", { bytes: 30 * 1024 * 1024 }));
    const provider = fakeProvider();
    const { publishMaster } = await import("./publish");
    const r = await publishMaster({ master, variants: [], platforms: ["facebook"], assetIds: ["big"], scheduleAt: null, userId: "u1" }, { provider });
    expect(r).toMatchObject({ ok: false, code: "requirements" });
    if (!r.ok) expect(r.error).toMatch(/25 MB/);
    expect(h.downloads).toHaveLength(0);
    expect(provider.calls).toHaveLength(0);
  });
  it("records a rejected caption group as failed rows while the other group proceeds", async () => {
    const { PublishRejectedError } = await import("./provider");
    const provider = fakeProvider();
    const base = provider.createPost;
    provider.createPost = async (i) => {
      if (i.platforms.includes("instagram")) throw new PublishRejectedError("nope", { instagram: "media required" });
      return base(i);
    };
    const { publishMaster } = await import("./publish");
    const r = await publishMaster({ master, variants: [{ id: "v1", platform: "instagram_reel", caption: "IG", hook: null }], platforms: ["facebook", "instagram"], assetIds: ["a1"], scheduleAt: null, userId: "u1" }, { provider });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.failures).toEqual({ instagram: "media required" });
    const rows = h.inserts.filter((i) => i.platform);
    expect(rows.find((x) => x.platform === "instagram")).toMatchObject({ status: "failed", error: "media required", provider_post_id: null });
    expect(rows.find((x) => x.platform === "facebook")).toMatchObject({ status: "published" });
    // a failed sibling row keeps the master from flipping
    expect(h.updates.some((u) => u.table === "studio_content_masters")).toBe(false);
  });
  it("keeps a platform that answers success/id=pending (TikTok processing) as queued, not published", async () => {
    const provider = fakeProvider({
      createPost: async (i) => ({ providerPostId: "P7", refId: null, status: "success", perPlatform: { facebook: { status: "success", id: "fb1", postUrl: "https://fb/7" }, tiktok: { status: "success", id: "pending" } } }),
    });
    const { publishMaster } = await import("./publish");
    const r = await publishMaster({ master, variants: [], platforms: ["facebook", "tiktok"], assetIds: ["a1"], scheduleAt: null, userId: "u1" }, { provider });
    expect(r.ok).toBe(true);
    const rows = h.inserts.filter((i) => i.platform);
    expect(rows.find((x) => x.platform === "facebook")).toMatchObject({ status: "published" });
    expect(rows.find((x) => x.platform === "tiktok")).toMatchObject({ status: "queued", published_at: null, post_url: null });
    expect(h.updates.some((u) => u.table === "studio_content_masters")).toBe(false); // waits for the sync to confirm TikTok
  });
  it("drops non-http urls coming back from the provider", async () => {
    const provider = fakeProvider({
      createPost: async (i) => ({ providerPostId: "P9", refId: null, status: "success", perPlatform: { facebook: { status: "success", id: "x", postUrl: "javascript:alert(1)" } } }),
    });
    const { publishMaster } = await import("./publish");
    const r = await publishMaster({ master, variants: [], platforms: ["facebook"], assetIds: [], scheduleAt: null, userId: "u1" }, { provider });
    expect(r.ok).toBe(true);
    expect(h.inserts[0].post_url).toBeNull();
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
  it("leaves a still-pending TikTok row untouched until the platform returns a url", async () => {
    h.socialRows = [{ id: "sp1", master_id: MASTER, platform: "tiktok", provider_post_id: "P1", status: "queued" }];
    const provider = fakeProvider({ postStatus: async (id) => ({ providerPostId: id, status: "success", perPlatform: { tiktok: { status: "success", id: "pending" } } }) });
    const { syncSocialPosts } = await import("./publish");
    const r = await syncSocialPosts({ provider });
    expect(r).toMatchObject({ checked: 1, published: 0, failed: 0 });
    expect(h.updates).toHaveLength(0);
    const done = fakeProvider({ postStatus: async (id) => ({ providerPostId: id, status: "success", perPlatform: { tiktok: { status: "success", id: "7400", postUrl: "https://www.tiktok.com/@dttp60/video/7400" } } }) });
    await syncSocialPosts({ provider: done });
    expect(h.updates.find((u) => u.table === "studio_social_posts")?.payload).toMatchObject({ status: "published", post_url: "https://www.tiktok.com/@dttp60/video/7400" });
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

describe("master flip rules (via sync)", () => {
  it("does not flip while a sibling row is failed; ignores deleted rows; flips when the rest are published", async () => {
    const { syncSocialPosts } = await import("./publish");
    // scheduled fb → published by provider; ig failed sibling → no flip
    h.socialRows = [
      { id: "sp1", master_id: MASTER, platform: "facebook", provider_post_id: "P1", status: "scheduled", post_url: null, published_at: null },
      { id: "sp2", master_id: MASTER, platform: "instagram", provider_post_id: "P2", status: "failed", post_url: null, published_at: null },
    ];
    await syncSocialPosts({ provider: fakeProvider() });
    expect(h.updates.some((u) => u.table === "studio_content_masters")).toBe(false);
    // deleted sibling is ignored → flips
    h.updates = [];
    h.socialRows = [
      { id: "sp1", master_id: MASTER, platform: "facebook", provider_post_id: "P1", status: "scheduled", post_url: null, published_at: null },
      { id: "sp3", master_id: MASTER, platform: "tiktok", provider_post_id: "P3", status: "deleted", post_url: null, published_at: null },
    ];
    await syncSocialPosts({ provider: fakeProvider() });
    const flip = h.updates.find((u) => u.table === "studio_content_masters");
    expect(flip?.payload).toMatchObject({ status: "published", published_url: "https://fb/9" });
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
