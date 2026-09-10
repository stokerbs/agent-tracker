import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  sync: vi.fn(),
  notify: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/studio/publish/publish", () => ({ syncSocialPosts: () => h.sync() }));
vi.mock("@/lib/line/notify", () => ({ pushLineNotify: (m: string) => h.notify(m) }));
vi.mock("@/lib/audit", () => ({ logAudit: (e: unknown) => h.audit(e) }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

const req = (auth?: string) => new NextRequest("https://x/api/cron/studio-social-sync", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  process.env.AYRSHARE_API_KEY = "k";
  h.sync.mockReset().mockResolvedValue({ checked: 2, published: 1, failed: 1, errors: [] });
  h.notify.mockReset();
  h.audit.mockReset();
});

describe("GET /api/cron/studio-social-sync", () => {
  it("fails closed without the cron secret", async () => {
    const { GET } = await import("./route");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer s3cret"))).status).toBe(401);
    expect(h.sync).not.toHaveBeenCalled();
  });
  it("skips quietly when the publishing provider is not configured", async () => {
    delete process.env.AYRSHARE_API_KEY;
    const { GET } = await import("./route");
    const res = await GET(req("Bearer s3cret"));
    expect(await res.json()).toEqual({ ok: true, skipped: "not_configured" });
    expect(h.sync).not.toHaveBeenCalled();
  });
  it("syncs, audits, and pings the owner only when something failed", async () => {
    const { GET } = await import("./route");
    const res = await GET(req("Bearer s3cret"));
    expect(await res.json()).toMatchObject({ ok: true, checked: 2, published: 1, failed: 1 });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "STUDIO_SOCIAL_SYNC" }));
    expect(h.notify).toHaveBeenCalledTimes(1);
    h.sync.mockResolvedValue({ checked: 1, published: 1, failed: 0, errors: [] });
    await GET(req("Bearer s3cret"));
    expect(h.notify).toHaveBeenCalledTimes(1);
  });
  it("returns 500 when the sync throws", async () => {
    h.sync.mockRejectedValue(new Error("boom"));
    const { GET } = await import("./route");
    expect((await GET(req("Bearer s3cret"))).status).toBe(500);
  });
});
