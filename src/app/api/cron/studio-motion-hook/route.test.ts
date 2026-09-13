import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({ sweep: vi.fn() }));
vi.mock("@/lib/studio/media/motion", () => ({ finishPendingHookMotions: () => h.sweep() }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

const req = (auth?: string) => new NextRequest("https://x/api/cron/studio-motion-hook", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  h.sweep.mockReset().mockResolvedValue({ checked: 2, ready: 1, failed: 0, pending: 1, errors: [] });
});

describe("GET /api/cron/studio-motion-hook", () => {
  it("fails closed without the cron secret", async () => {
    const { GET } = await import("./route");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer s3cret"))).status).toBe(401);
    expect(h.sweep).not.toHaveBeenCalled();
  });
  it("reports what the sweep finished", async () => {
    const { GET } = await import("./route");
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ready: 1, pending: 1 });
  });
  it("reports a sweep that hit errors as not ok, and a throw as 500", async () => {
    const { GET } = await import("./route");
    h.sweep.mockResolvedValue({ checked: 1, ready: 0, failed: 0, pending: 1, errors: ["a1: fetch failed"] });
    expect(await (await GET(req("Bearer s3cret"))).json()).toMatchObject({ ok: false, errors: ["a1: fetch failed"] });
    h.sweep.mockRejectedValue(new Error("boom"));
    expect((await GET(req("Bearer s3cret"))).status).toBe(500);
  });
});
