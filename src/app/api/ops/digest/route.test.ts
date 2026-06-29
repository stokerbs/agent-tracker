import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// isStaff is the real pure check; getCurrentProfile is stubbed.
vi.mock("@/lib/auth", () => ({
  getCurrentProfile: vi.fn(),
  isStaff: (r: string) => r === "admin" || r === "supervisor",
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "./route";
import { getCurrentProfile } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Thenable query builder — every chained method returns itself; awaiting yields
// { data } keyed by table.
function supa(byTable: Record<string, unknown[]> = {}) {
  const from = (table: string) => {
    const result = { data: byTable[table] ?? [] };
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      is: () => b,
      gte: () => b,
      eq: () => b,
      order: () => b,
      then: (res: (v: typeof result) => unknown) => res(result),
    });
    return b;
  };
  return { from };
}

const req = (period = "day") =>
  ({ nextUrl: { searchParams: new URLSearchParams(`period=${period}`) } }) as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: "u1", role: "admin" } as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 4, retryAfterMs: 0 } as never);
  vi.mocked(createClient).mockResolvedValue(supa() as never);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ content: [{ text: "สรุป AI" }] }) }) as Response));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("GET /api/ops/digest — auth & branch ladder", () => {
  it("401 when not authenticated", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(null as never);
    expect((await GET(req())).status).toBe(401);
  });

  it("403 for non-staff (agent)", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: "u1", role: "agent" } as never);
    expect((await GET(req())).status).toBe(403);
  });

  it("429 when rate-limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 } as never);
    expect((await GET(req())).status).toBe(429);
  });

  it("200 with the AI digest on success", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ai).toBe(true);
    expect(body.digest).toBe("สรุป AI");
    expect(body.summary.period).toBe("day");
  });

  it("falls back to the template digest (ai:false) when no API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await GET(req("week"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ai).toBe(false);
    expect(body.digest).toContain("สรุปปฏิบัติการ");
    expect(body.summary.period).toBe("week");
  });
});
