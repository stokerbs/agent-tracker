import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentProfile: vi.fn(),
  isStaff: (r: string) => r === "admin" || r === "supervisor",
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceClient: vi.fn() }));
vi.mock("@/lib/gps903", () => ({
  getOrRefreshCredentialSession: vi.fn(),
  gps903GetHistory: vi.fn(),
}));

import { GET } from "./route";
import { getCurrentProfile } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrRefreshCredentialSession, gps903GetHistory } from "@/lib/gps903";

const UUID = "11111111-1111-1111-1111-111111111111";

// User-session client: gps_devices lookup.
function userClient(deviceRow: unknown) {
  const b: Record<string, unknown> = {};
  Object.assign(b, { select: () => b, eq: () => b, maybeSingle: async () => ({ data: deviceRow }) });
  return { from: () => b };
}
// Service client: gps903_credentials lookup.
function svcClient(credRow: unknown) {
  const b: Record<string, unknown> = {};
  Object.assign(b, { select: () => b, eq: () => b, maybeSingle: async () => ({ data: credRow }) });
  return { from: () => b };
}

const req = (qs: string) =>
  ({ nextUrl: { searchParams: new URLSearchParams(qs) } }) as unknown as Parameters<typeof GET>[0];

const cred = { id: "c1", imei: "123", device_password: "pw", gps903_device_id: 999 };

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: "u1", role: "admin" } as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 29, retryAfterMs: 0 } as never);
  vi.mocked(createClient).mockResolvedValue(userClient({ gps903_device_id: 999 }) as never);
  vi.mocked(createServiceClient).mockReturnValue(svcClient(cred) as never);
  vi.mocked(getOrRefreshCredentialSession).mockResolvedValue("cookie" as never);
  vi.mocked(gps903GetHistory).mockResolvedValue([
    { lat: 13.7, lng: 100.5, speed: 0, course: 0, fixTime: "2026-06-30 07:00:00", stopMinutes: 0 },
  ] as never);
});
afterEach(() => vi.clearAllMocks());

describe("GET /api/gps/history — auth ladder", () => {
  it("401 when not authenticated", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(null as never);
    expect((await GET(req(`deviceId=${UUID}`))).status).toBe(401);
  });
  it("403 for non-staff", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: "u1", role: "agent" } as never);
    expect((await GET(req(`deviceId=${UUID}`))).status).toBe(403);
  });
  it("429 when rate-limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 } as never);
    expect((await GET(req(`deviceId=${UUID}`))).status).toBe(429);
  });
  it("400 on a bad deviceId", async () => {
    expect((await GET(req("deviceId=nope"))).status).toBe(400);
  });
  it("404 when the device is not visible (RLS)", async () => {
    vi.mocked(createClient).mockResolvedValue(userClient(null) as never);
    expect((await GET(req(`deviceId=${UUID}`))).status).toBe(404);
  });
  it("502 when the GPS903 login fails", async () => {
    vi.mocked(getOrRefreshCredentialSession).mockResolvedValue(null as never);
    expect((await GET(req(`deviceId=${UUID}`))).status).toBe(502);
  });
});

describe("GET /api/gps/history — track from the live 903 history API", () => {
  it("returns mapped points with a normalised ISO timestamp", async () => {
    const res = await GET(req(`deviceId=${UUID}&hours=24`));
    expect(res.status).toBe(200);
    const { points } = await res.json();
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ lat: 13.7, lng: 100.5, speed: 0 });
    expect(points[0].t).toBe("2026-06-30T07:00:00.000Z"); // gps903DateToIso normalised
  });

  it("clamps hours to the schema (rejects >72)", async () => {
    expect((await GET(req(`deviceId=${UUID}&hours=999`))).status).toBe(400);
  });

  it("returns empty when the device has no gps903_device_id", async () => {
    vi.mocked(createClient).mockResolvedValue(userClient({ gps903_device_id: null }) as never);
    const res = await GET(req(`deviceId=${UUID}`));
    expect(res.status).toBe(200);
    expect((await res.json()).points).toEqual([]);
    expect(gps903GetHistory).not.toHaveBeenCalled();
  });
});
