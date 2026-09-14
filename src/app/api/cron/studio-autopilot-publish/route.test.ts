import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({ sweep: vi.fn() }));
vi.mock("@/lib/studio/autopilot/publish-pending", () => ({ publishPendingAutopilotRuns: () => h.sweep() }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

const req = (auth?: string) => new NextRequest("https://x/api/cron/studio-autopilot-publish", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  h.sweep.mockReset().mockResolvedValue({ checked: 1, published: 1, skipped: 0, failed: 0, errors: [] });
});

describe("GET /api/cron/studio-autopilot-publish", () => {
  it("fails closed without the cron secret", async () => {
    const { GET } = await import("./route");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer s3cret"))).status).toBe(401);
    expect(h.sweep).not.toHaveBeenCalled();
  });
  it("reports what the sweep posted", async () => {
    const { GET } = await import("./route");
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, published: 1 });
  });
  it("is not ok when a run failed, and 500 when the sweep throws", async () => {
    const { GET } = await import("./route");
    h.sweep.mockResolvedValue({ checked: 1, published: 0, skipped: 0, failed: 1, errors: ["r1: blocked"] });
    expect(await (await GET(req("Bearer s3cret"))).json()).toMatchObject({ ok: false, failed: 1 });
    h.sweep.mockRejectedValue(new Error("boom"));
    expect((await GET(req("Bearer s3cret"))).status).toBe(500);
  });
});
