import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({ run: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/studio/autopilot/run", () => ({ runAutopilot: (o: unknown) => h.run(o) }));
vi.mock("@/lib/audit", () => ({ logAudit: (e: unknown) => h.audit(e) }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

const req = (auth?: string) => new NextRequest("https://x/api/cron/studio-autopilot", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  h.run.mockReset().mockResolvedValue({ ok: true, runId: "r1", status: "done", masterId: "m1", posts: 2 });
  h.audit.mockReset();
});

describe("GET /api/cron/studio-autopilot", () => {
  it("fails closed without the cron secret", async () => {
    const { GET } = await import("./route");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer s3cret"))).status).toBe(401);
    expect(h.run).not.toHaveBeenCalled();
  });
  it("runs the autopilot as a cron trigger and audits the outcome", async () => {
    const { GET } = await import("./route");
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "done", posts: 2 });
    expect(h.run).toHaveBeenCalledWith({ userId: null, trigger: "cron" });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "STUDIO_AUTOPILOT_RUN" }));
  });
  it("does not audit a skipped run and reports review as success", async () => {
    const { GET } = await import("./route");
    h.run.mockResolvedValue({ ok: true, runId: null, status: "skipped", stopReason: "off_day" });
    expect((await GET(req("Bearer s3cret"))).status).toBe(200);
    expect(h.audit).not.toHaveBeenCalled();
    h.run.mockResolvedValue({ ok: false, runId: "r2", status: "review", stopReason: "privacy_blocked" });
    expect((await GET(req("Bearer s3cret"))).status).toBe(200);
    expect(h.audit).toHaveBeenCalledTimes(1);
  });
  it("returns 500 when a run fails or throws", async () => {
    const { GET } = await import("./route");
    h.run.mockResolvedValue({ ok: false, runId: "r3", status: "failed", error: "boom" });
    expect((await GET(req("Bearer s3cret"))).status).toBe(500);
    h.run.mockRejectedValue(new Error("kaboom"));
    expect((await GET(req("Bearer s3cret"))).status).toBe(500);
  });
});
