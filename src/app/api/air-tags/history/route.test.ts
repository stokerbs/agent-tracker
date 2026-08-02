import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const UUID = "11111111-1111-1111-1111-111111111111";

// RLS-scoped user-session client: air_tag_trackers lookup + air_tag_positions query,
// both routed through the same chainable builder (mirrors route.ts's `supabase` reuse).
function userClient(trackerRow: unknown, positionRows: unknown[] = []) {
  const b: Record<string, unknown> = {};
  Object.assign(b, {
    select: () => b,
    eq: () => b,
    is: () => b,
    gte: () => b,
    lte: () => b,
    maybeSingle: async () => ({ data: trackerRow }),
    order: async () => ({ data: positionRows, error: null }),
  });
  return { from: () => b };
}

const req = (qs: string) =>
  ({ nextUrl: { searchParams: new URLSearchParams(qs) } }) as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: "u1", role: "admin" } as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 59, retryAfterMs: 0 } as never);
  vi.mocked(createClient).mockResolvedValue(userClient({ id: UUID }) as never);
});
afterEach(() => vi.clearAllMocks());

describe("GET /api/air-tags/history — auth ladder", () => {
  it("401 when not authenticated", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(null as never);
    expect((await GET(req(`airTagId=${UUID}&date=2026-06-08`))).status).toBe(401);
  });
  it("403 for non-staff", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: "u1", role: "agent" } as never);
    expect((await GET(req(`airTagId=${UUID}&date=2026-06-08`))).status).toBe(403);
  });
  it("429 when rate-limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 } as never);
    expect((await GET(req(`airTagId=${UUID}&date=2026-06-08`))).status).toBe(429);
  });
  it("400 on a bad airTagId", async () => {
    expect((await GET(req(`airTagId=nope&date=2026-06-08`))).status).toBe(400);
  });
  it("400 when date is missing", async () => {
    expect((await GET(req(`airTagId=${UUID}`))).status).toBe(400);
  });
  it("400 on a malformed date (not zero-padded)", async () => {
    expect((await GET(req(`airTagId=${UUID}&date=2026-6-8`))).status).toBe(400);
  });
  it("400 on a well-formed but impossible date", async () => {
    expect((await GET(req(`airTagId=${UUID}&date=2026-13-40`))).status).toBe(400);
  });
  it("400 on a rolled-over date like 2026-02-30 (not silently March 1)", async () => {
    expect((await GET(req(`airTagId=${UUID}&date=2026-02-30`))).status).toBe(400);
  });
  it("404 when the tracker is not visible (RLS) — does not leak existence", async () => {
    vi.mocked(createClient).mockResolvedValue(userClient(null) as never);
    const res = await GET(req(`airTagId=${UUID}&date=2026-06-08`));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/air-tags/history — response contract", () => {
  it("returns points with NO speed/heading fields (unlike /api/gps/history)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      userClient({ id: UUID }, [
        { lat: 13.7, lng: 100.5, recorded_at: "2026-06-08T03:00:00.000Z", accuracy_m: 5, note: "seen at market" },
        { lat: 13.71, lng: 100.51, recorded_at: "2026-06-08T04:00:00.000Z", accuracy_m: null, note: null },
      ]) as never,
    );
    const res = await GET(req(`airTagId=${UUID}&date=2026-06-08`));
    expect(res.status).toBe(200);
    const { points } = await res.json();
    expect(points).toEqual([
      { lat: 13.7, lng: 100.5, t: "2026-06-08T03:00:00.000Z", accuracyM: 5, note: "seen at market" },
      { lat: 13.71, lng: 100.51, t: "2026-06-08T04:00:00.000Z", accuracyM: null, note: null },
    ]);
    for (const p of points) {
      expect(p).not.toHaveProperty("speed");
      expect(p).not.toHaveProperty("heading");
    }
  });

  it("returns an empty points array for a day with no pings", async () => {
    vi.mocked(createClient).mockResolvedValue(userClient({ id: UUID }, []) as never);
    const res = await GET(req(`airTagId=${UUID}&date=2026-06-08`));
    expect(res.status).toBe(200);
    expect((await res.json()).points).toEqual([]);
  });
});
