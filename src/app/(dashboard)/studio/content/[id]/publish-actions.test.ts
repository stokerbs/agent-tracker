/**
 * Publishing action tests: admin gate, zod, status gate (approved|scheduled
 * only), fresh privacy scan gate, server-side variant loading, delete path.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const MASTER = "11111111-1111-4111-8111-111111111111";
const POST = "44444444-4444-4444-8444-444444444444";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  rows: {} as Record<string, Row | Row[] | null>,
  publish: vi.fn(),
  deleteProvider: vi.fn(),
  privacy: { ok: true, check: { status: "safe" } } as Row,
  updates: [] as { table: string; payload: Row }[],
  audit: [] as { action: string }[],
  rate: { allowed: true, remaining: 9, retryAfterMs: 0 } as Row,
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async (e: { action: string }) => void h.audit.push(e)) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => h.rate) }));
vi.mock("@/lib/studio/auth", () => ({ getStudioAdmin: vi.fn(async () => h.profile) }));
vi.mock("./privacy-check", () => ({ revalidateContentPaths: vi.fn(), runAndStorePrivacyCheck: vi.fn(async () => h.privacy) }));
vi.mock("@/lib/studio/publish/publish", () => ({
  SCHEDULE_MIN_LEAD_MS: 60_000,
  publishMaster: (i: unknown) => h.publish(i),
  deleteProviderPost: (id: string) => h.deleteProvider(id),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      let op = "select";
      let payload: Row | null = null;
      for (const m of ["select", "eq"]) b[m] = () => b;
      b.update = (p: Row) => ((op = "update"), (payload = p), b);
      b.maybeSingle = async () => ({ data: (h.rows[table] as Row | null) ?? null, error: null });
      b.then = (r: (v: unknown) => unknown) => {
        if (op === "update") h.updates.push({ table, payload: payload! });
        const data = op === "select" ? (Array.isArray(h.rows[table]) ? h.rows[table] : []) : null;
        return Promise.resolve(r({ data, error: null }));
      };
      return b;
    },
  }),
}));

beforeEach(() => {
  h.profile = { id: "admin-1", role: "admin" };
  h.rows = {
    studio_content_masters: { id: MASTER, title: "T", status: "approved", caption: "แคปชัน", cta: "CTA", hook: "hook", scheduled_at: "2030-01-01T00:00:00.000Z" },
    studio_content_variants: [{ id: "v1", platform: "instagram_reel", caption: "IG", hook: null }],
    studio_social_posts: { id: POST, master_id: MASTER, provider_post_id: "P1", status: "published" },
  };
  h.privacy = { ok: true, check: { status: "safe" } };
  h.updates = [];
  h.audit = [];
  h.rate = { allowed: true, remaining: 9, retryAfterMs: 0 };
  h.publish.mockReset().mockResolvedValue({ ok: true, posts: [{ id: "sp1" }], providerPostId: "P1", scheduled: false });
  h.deleteProvider.mockReset().mockResolvedValue({ ok: true });
});

describe("publishToSocial", () => {
  it("gates on admin, input, and master status", async () => {
    const { publishToSocial } = await import("./publish-actions");
    h.profile = null;
    expect(await publishToSocial({ masterId: MASTER, platforms: ["facebook"] })).toMatchObject({ ok: false, code: "unauthorized" });
    h.profile = { id: "admin-1", role: "admin" };
    expect(await publishToSocial({ masterId: MASTER, platforms: [] })).toMatchObject({ ok: false, code: "invalid" });
    expect(await publishToSocial({ masterId: MASTER, platforms: ["linkedin"] })).toMatchObject({ ok: false, code: "invalid" });
    h.rows.studio_content_masters = { ...(h.rows.studio_content_masters as Row), status: "draft" };
    expect(await publishToSocial({ masterId: MASTER, platforms: ["facebook"] })).toMatchObject({ ok: false, code: "status" });
    expect(h.publish).not.toHaveBeenCalled();
  });
  it("refuses when the fresh privacy scan is blocked", async () => {
    h.privacy = { ok: true, check: { status: "blocked" } };
    const { publishToSocial } = await import("./publish-actions");
    expect(await publishToSocial({ masterId: MASTER, platforms: ["facebook"] })).toMatchObject({ ok: false, code: "blocked" });
    expect(h.publish).not.toHaveBeenCalled();
  });
  it("passes RLS-loaded master + variants and the schedule to the core, then audits", async () => {
    const { publishToSocial } = await import("./publish-actions");
    const r = await publishToSocial({ masterId: MASTER, platforms: ["facebook", "instagram"], assetIds: [], when: "scheduled" });
    expect(r.ok).toBe(true);
    expect(h.publish).toHaveBeenCalledWith(expect.objectContaining({ platforms: ["facebook", "instagram"], scheduleAt: "2030-01-01T00:00:00.000Z", variants: [{ id: "v1", platform: "instagram_reel", caption: "IG", hook: null }], userId: "admin-1" }));
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_SOCIAL_POST");
  });
  it("enforces the per-admin rate limit before touching the master", async () => {
    h.rate = { allowed: false, remaining: 0, retryAfterMs: 120_000 };
    const { publishToSocial } = await import("./publish-actions");
    const r = await publishToSocial({ masterId: MASTER, platforms: ["facebook"] });
    expect(r).toMatchObject({ ok: false, code: "rate_limited" });
    if (!r.ok) expect(r.error).toContain("2 นาที");
    expect(h.publish).not.toHaveBeenCalled();
  });
  it("requires a future scheduled_at when posting 'scheduled' and forwards core failures", async () => {
    const { publishToSocial } = await import("./publish-actions");
    h.rows.studio_content_masters = { ...(h.rows.studio_content_masters as Row), scheduled_at: null };
    expect(await publishToSocial({ masterId: MASTER, platforms: ["facebook"], when: "scheduled" })).toMatchObject({ ok: false, code: "invalid" });
    h.rows.studio_content_masters = { ...(h.rows.studio_content_masters as Row), scheduled_at: "2020-01-01T00:00:00.000Z" };
    const past = await publishToSocial({ masterId: MASTER, platforms: ["facebook"], when: "scheduled" });
    expect(past).toMatchObject({ ok: false, code: "invalid" });
    if (!past.ok) expect(past.error).toContain("ผ่านไปแล้ว");
    expect(h.publish).not.toHaveBeenCalled();
    h.rows.studio_content_masters = { ...(h.rows.studio_content_masters as Row), scheduled_at: "2030-01-01T00:00:00.000Z" };
    h.publish.mockResolvedValue({ ok: false, error: "x", code: "not_connected" });
    expect(await publishToSocial({ masterId: MASTER, platforms: ["facebook"] })).toMatchObject({ ok: false, code: "not_connected" });
    expect(h.audit).toHaveLength(0);
  });
});

describe("previewCaptions", () => {
  it("returns a preview for every social platform with limits and variant provenance", async () => {
    const { previewCaptions } = await import("./publish-actions");
    const r = await previewCaptions({ masterId: MASTER });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.previews.map((p) => p.platform)).toEqual(["facebook", "instagram", "tiktok", "youtube"]);
      expect(r.previews.find((p) => p.platform === "instagram")).toMatchObject({ text: "IG", fromVariant: true, limit: 2200 });
      expect(r.previews.find((p) => p.platform === "facebook")).toMatchObject({ text: "แคปชัน\n\nCTA", fromVariant: false });
      expect(r.previews.find((p) => p.platform === "youtube")?.youtubeTitle).toBe("T"); // hook too short → title
    }
  });
});

describe("removeSocialPost", () => {
  it("deletes at the provider when a provider id exists and audits", async () => {
    const { removeSocialPost } = await import("./publish-actions");
    expect(await removeSocialPost({ postId: POST })).toEqual({ ok: true });
    expect(h.deleteProvider).toHaveBeenCalledWith("P1");
    expect(h.audit.map((a) => a.action)).toContain("STUDIO_SOCIAL_DELETE");
  });
  it("marks local-only rows deleted without a provider call; non-admins refused", async () => {
    const { removeSocialPost } = await import("./publish-actions");
    h.rows.studio_social_posts = { id: POST, master_id: MASTER, provider_post_id: null, status: "failed" };
    expect(await removeSocialPost({ postId: POST })).toEqual({ ok: true });
    expect(h.deleteProvider).not.toHaveBeenCalled();
    expect(h.updates[0]).toMatchObject({ table: "studio_social_posts", payload: { status: "deleted" } });
    h.profile = null;
    expect((await removeSocialPost({ postId: POST })).ok).toBe(false);
  });
});
