/**
 * checkin-monitor cron: fail-closed CRON_SECRET auth, reminding assigned agents
 * when overdue (within grace) and escalating to supervisors past grace, with the
 * per-case stage deduping repeat notifications.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  notifyUsers: vi.fn(),
  notifyRole: vi.fn(),
  getCaseRecipients: vi.fn(async () => ({ agents: ["agent-1"], client: null })),
  cases: [] as unknown[],
  latestByCase: {} as Record<string, { created_at: string } | null>,
  updates: [] as unknown[],
}));

vi.mock("@/lib/notifications", () => ({
  notifyUsers: h.notifyUsers,
  notifyRole: h.notifyRole,
  getCaseRecipients: h.getCaseRecipients,
  notificationLinks: { case: (id: string) => `/cases/${id}` },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      let curCaseId = "";
      let isUpdate = false;
      for (const m of ["select", "neq", "not", "is", "order", "limit"]) b[m] = () => b;
      b.eq = (_col: string, val: string) => { curCaseId = val; return b; };
      b.update = (vals: unknown) => { isUpdate = true; h.updates.push(vals); return b; };
      b.maybeSingle = async () => ({ data: h.latestByCase[curCaseId] ?? null });
      (b as { then: unknown }).then = (res: (v: unknown) => unknown) => {
        if (table === "cases" && isUpdate) return res({ error: null });
        if (table === "cases") return res({ data: h.cases, error: null });
        return res({ data: null, error: null });
      };
      return b;
    },
  }),
}));

function req(authHeader?: string) {
  return { headers: { get: (k: string) => (k === "authorization" ? authHeader ?? null : null) } } as unknown as import("next/server").NextRequest;
}
const load = () => import("@/app/api/cron/checkin-monitor/route");
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  h.cases.length = 0;
  h.latestByCase = {};
  h.updates.length = 0;
  process.env.CRON_SECRET = "test-secret";
  delete process.env.CHECKIN_GRACE_MIN;
});

describe("checkin-monitor auth", () => {
  it("401 without authorization header", async () => {
    const { GET } = await load();
    expect((await GET(req())).status).toBe(401);
    expect(h.notifyUsers).not.toHaveBeenCalled();
  });
  it("401 with wrong secret", async () => {
    const { GET } = await load();
    expect((await GET(req("Bearer nope"))).status).toBe(401);
  });
});

describe("checkin-monitor cadence", () => {
  it("reminds assigned agents when overdue within grace", async () => {
    h.cases.push({ id: "case-1", case_number: "C-1", created_at: minsAgo(999), checkin_interval_minutes: 30, checkin_stage: "ok" });
    h.latestByCase["case-1"] = { created_at: minsAgo(35) }; // 35 > 30, < 30+15

    const { GET } = await load();
    const body = await (await GET(req("Bearer test-secret"))).json();

    expect(body).toMatchObject({ ok: true, scanned: 1, reminded: 1, escalated: 0 });
    expect(h.notifyUsers).toHaveBeenCalledWith(["agent-1"], expect.objectContaining({ url: "/cases/case-1" }));
    expect(h.updates[0]).toMatchObject({ checkin_stage: "reminded" });
  });

  it("escalates to supervisors past the grace window", async () => {
    h.cases.push({ id: "case-1", case_number: "C-1", created_at: minsAgo(999), checkin_interval_minutes: 30, checkin_stage: "reminded" });
    h.latestByCase["case-1"] = { created_at: minsAgo(60) };

    const { GET } = await load();
    const body = await (await GET(req("Bearer test-secret"))).json();

    expect(body).toMatchObject({ ok: true, scanned: 1, reminded: 0, escalated: 1 });
    expect(h.notifyRole).toHaveBeenCalledWith(["admin", "supervisor"], expect.objectContaining({ url: "/cases/case-1" }));
    expect(h.updates[0]).toMatchObject({ checkin_stage: "escalated" });
  });

  it("does nothing (no notify, no update) when on track", async () => {
    h.cases.push({ id: "case-1", case_number: "C-1", created_at: minsAgo(999), checkin_interval_minutes: 30, checkin_stage: "ok" });
    h.latestByCase["case-1"] = { created_at: minsAgo(5) };

    const { GET } = await load();
    const body = await (await GET(req("Bearer test-secret"))).json();

    expect(body).toMatchObject({ ok: true, scanned: 1, reminded: 0, escalated: 0 });
    expect(h.notifyUsers).not.toHaveBeenCalled();
    expect(h.notifyRole).not.toHaveBeenCalled();
    expect(h.updates).toHaveLength(0);
  });

  it("resets stage to ok after a fresh report without notifying", async () => {
    h.cases.push({ id: "case-1", case_number: "C-1", created_at: minsAgo(999), checkin_interval_minutes: 30, checkin_stage: "escalated" });
    h.latestByCase["case-1"] = { created_at: minsAgo(3) }; // reported again

    const { GET } = await load();
    const body = await (await GET(req("Bearer test-secret"))).json();

    expect(body).toMatchObject({ reminded: 0, escalated: 0 });
    expect(h.notifyUsers).not.toHaveBeenCalled();
    expect(h.updates[0]).toMatchObject({ checkin_stage: "ok" });
  });
});
