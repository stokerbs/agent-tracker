import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  result: { ok: true, messages: 12, inserted: 2, merged: 1, purged: 0, generationId: "g1" } as Record<string, unknown>,
}));
vi.mock("@/lib/studio/faq-mining", () => ({ mineLineInbox: vi.fn(async () => h.result) }));
vi.mock("@/lib/line/notify", () => ({ pushLineNotify: vi.fn() }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

import { GET } from "./route";
import { pushLineNotify } from "@/lib/line/notify";

function req(auth?: string): NextRequest {
  const hd = new Map<string, string>();
  if (auth) hd.set("authorization", auth);
  return { headers: { get: (k: string) => hd.get(k.toLowerCase()) ?? null } } as unknown as NextRequest;
}

const OLD = { ...process.env };
beforeEach(() => {
  process.env.CRON_SECRET = "secret";
  h.result = { ok: true, messages: 12, inserted: 2, merged: 1, purged: 0, generationId: "g1" };
});
afterEach(() => {
  process.env = { ...OLD };
  vi.clearAllMocks();
});

describe("GET /api/cron/studio-faq-mine", () => {
  it("401 without the CRON_SECRET bearer (and when the secret is unset)", async () => {
    expect((await GET(req())).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer secret"))).status).toBe(401);
  });
  it("mines and notifies the owner when questions landed", async () => {
    const res = await GET(req("Bearer secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, inserted: 2, merged: 1 });
    expect(vi.mocked(pushLineNotify)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(pushLineNotify).mock.calls[0][0]).toContain("คำถามใหม่: 2");
  });
  it("stays quiet when nothing new was found", async () => {
    h.result = { ok: true, messages: 3, inserted: 0, merged: 0, purged: 0, generationId: null, skipped: "too_few" };
    const res = await GET(req("Bearer secret"));
    expect(res.status).toBe(200);
    expect(vi.mocked(pushLineNotify)).not.toHaveBeenCalled();
  });
  it("500 when mining fails", async () => {
    h.result = { ok: false, error: "AI ล้มเหลว", messages: 9, inserted: 0, merged: 0, purged: 0, generationId: null };
    const res = await GET(req("Bearer secret"));
    expect(res.status).toBe(500);
  });
});
