/**
 * SEC-4 (Register #14): the GPS903 debug endpoint is a service-role,
 * live-credential-probing diagnostic with no in-app caller. It must be
 * unreachable in production (VERCEL_ENV === "production") and must remain
 * fail-closed behind CRON_SECRET everywhere else.
 *
 * These tests mock the supabase service client and the gps903 lib so NO live
 * network/DB is hit. Mocks are top-level so vi.mock hoisting works correctly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock transitive imports so importing the route never touches real I/O.
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(async () => ({ data: [] })),
    })),
  })),
}));

vi.mock("@/lib/gps903", () => ({
  gps903Login: vi.fn(),
  gps903GetTracking: vi.fn(),
  runGps903Discovery: vi.fn(),
}));

const CRON_SECRET = "test-cron-secret";

function makeRequest(headers: Record<string, string> = {}) {
  // Minimal NextRequest-shaped stub sufficient for the handler's reads.
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as import("next/server").NextRequest;
}

describe("GET /api/debug/gps903 — production exposure guard (SEC-4)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("returns 404 in production EVEN WITH a correct CRON_SECRET bearer, leaking no diagnostics", async () => {
    process.env.VERCEL_ENV = "production";

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ authorization: `Bearer ${CRON_SECRET}` }));

    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toEqual({ error: "Not found" });
    // Must not leak any diagnostic shape from the real handler.
    expect(body).not.toHaveProperty("credentials");
    expect(body).not.toHaveProperty("sessions");
    expect(body).not.toHaveProperty("devices");
    expect(body).not.toHaveProperty("probe");
  });

  it("returns 401 when not production and the bearer is missing (fail-closed CRON_SECRET guard intact)", async () => {
    delete process.env.VERCEL_ENV; // unset => not production (dev/local)

    const { GET } = await import("./route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 in preview when the bearer is wrong (fail-closed CRON_SECRET guard intact)", async () => {
    process.env.VERCEL_ENV = "preview";

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ authorization: "Bearer wrong" }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });
});
