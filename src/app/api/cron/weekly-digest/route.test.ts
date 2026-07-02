import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/line/notify", () => ({ pushLineNotify: vi.fn() }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

import { GET } from "./route";
import { createServiceClient } from "@/lib/supabase/server";
import { pushLineNotify } from "@/lib/line/notify";

// Chainable, awaitable Supabase query-builder stub that resolves { count }.
function qb(count: number) {
  const obj: Record<string, unknown> = {};
  obj.select = () => obj;
  obj.gte = () => obj;
  obj.eq = () => obj;
  obj.then = (resolve: (v: { count: number }) => unknown) => resolve({ count });
  return obj;
}

function req(auth?: string): NextRequest {
  const h = new Map<string, string>();
  if (auth) h.set("authorization", auth);
  return { headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null } } as unknown as NextRequest;
}

const OLD = { ...process.env };
beforeEach(() => {
  vi.restoreAllMocks();
  process.env.CRON_SECRET = "secret";
  vi.mocked(createServiceClient).mockReturnValue({ from: () => qb(3) } as never);
});
afterEach(() => { process.env = { ...OLD }; vi.clearAllMocks(); });

describe("GET /api/cron/weekly-digest", () => {
  it("401 without the CRON_SECRET bearer", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(vi.mocked(pushLineNotify)).not.toHaveBeenCalled();
  });

  it("sends a LINE digest when authorized", async () => {
    const res = await GET(req("Bearer secret"));
    expect(res.status).toBe(200);
    expect(vi.mocked(pushLineNotify)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(pushLineNotify).mock.calls[0]![0]).toContain("สรุปรายสัปดาห์");
  });

  it("500 when a query throws", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => { throw new Error("db"); },
    } as never);
    const res = await GET(req("Bearer secret"));
    expect(res.status).toBe(500);
  });
});
