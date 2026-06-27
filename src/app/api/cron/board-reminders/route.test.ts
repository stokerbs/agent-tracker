/**
 * board-reminders cron: fail-closed CRON_SECRET auth, the 60-minute start window
 * filter, and that only due claims notify (dedup is enforced by the reminded_at
 * IS NULL query filter + the post-send update).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const makeBuilder = (result: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "update", "eq", "in", "is", "order"]) b[m] = () => b;
    (b as { then: unknown }).then = (res: (v: unknown) => unknown) => res(result);
    return b;
  };
  const claimsQueue: unknown[] = [];
  return {
    claimsQueue,
    notifyUsers: vi.fn(),
    makeClient: () => ({
      from: () => makeBuilder(claimsQueue.length > 1 ? claimsQueue.shift() : claimsQueue[0] ?? { data: [], error: null }),
    }),
  };
});

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => h.makeClient() }));
vi.mock("@/lib/notifications", () => ({
  notifyUsers: h.notifyUsers,
  notificationLinks: { case: (id: string) => `/cases/${id}` },
}));

function req(authHeader?: string) {
  return { headers: { get: (k: string) => (k === "authorization" ? authHeader ?? null : null) } } as unknown as Request;
}

async function load() {
  return import("@/app/api/cron/board-reminders/route");
}

beforeEach(() => {
  vi.clearAllMocks();
  h.claimsQueue.length = 0;
  process.env.CRON_SECRET = "test-secret";
});

describe("board-reminders auth", () => {
  it("401 without authorization header", async () => {
    const { GET } = await load();
    const res = await GET(req() as never);
    expect(res.status).toBe(401);
    expect(h.notifyUsers).not.toHaveBeenCalled();
  });
  it("401 with wrong secret", async () => {
    const { GET } = await load();
    const res = await GET(req("Bearer nope") as never);
    expect(res.status).toBe(401);
  });
});

describe("board-reminders window", () => {
  it("notifies only claims whose case starts within 60 minutes", async () => {
    const now = Date.now();
    const inWindow = new Date(now + 30 * 60 * 1000).toISOString(); // 30 min → due
    const farAway = new Date(now + 3 * 60 * 60 * 1000).toISOString(); // 3 h → not due
    h.claimsQueue.push(
      {
        data: [
          { id: "claim-due", cases: { id: "c1", case_number: "C1", board_start_at: inWindow }, agents: { profile_id: "p1" } },
          { id: "claim-far", cases: { id: "c2", case_number: "C2", board_start_at: farAway }, agents: { profile_id: "p2" } },
        ],
        error: null,
      },
      { error: null }, // the reminded_at update for the due claim
    );
    const { GET } = await load();
    const res = await GET(req("Bearer test-secret") as never);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, sent: 1 });
    expect(h.notifyUsers).toHaveBeenCalledTimes(1);
    expect(h.notifyUsers).toHaveBeenCalledWith(["p1"], expect.objectContaining({ url: "/cases/c1" }));
  });
});
