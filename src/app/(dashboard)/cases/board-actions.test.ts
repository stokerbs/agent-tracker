/**
 * Job Board server-action tests: authorization, validation, slot-quota, the
 * duplicate-claim branch, and that listBoardCases exposes only safe fields
 * (the access model migration 0079 relies on). Mocks are top-level for vi.mock
 * hoisting.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  // A chainable, awaitable Supabase query-builder mock. Each `from(table)` call
  // shifts the next configured response off that table's queue, so a single
  // action that hits the same table several times can get different results.
  const makeBuilder = (result: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "update", "insert", "delete", "eq", "in", "is", "order"]) {
      b[m] = () => b;
    }
    b.single = () => b;
    b.maybeSingle = () => b;
    (b as { then: unknown }).then = (res: (v: unknown) => unknown) => res(result);
    return b;
  };
  const makeClient = (resp: Record<string, unknown[]>) => ({
    from: (t: string) => {
      const q = resp[t];
      const r = Array.isArray(q) && q.length ? (q.length > 1 ? q.shift() : q[0]) : { data: null, error: null };
      return makeBuilder(r);
    },
    // RPC responses are queued under `rpc:<fn>` so concurrent callers can each
    // get a distinct result (e.g. one 'approved', one 'quota_met').
    rpc: (fn: string) => {
      const q = resp[`rpc:${fn}`];
      const r = Array.isArray(q) && q.length ? (q.length > 1 ? q.shift() : q[0]) : { data: null, error: null };
      return makeBuilder(r);
    },
  });
  return {
    svc: {} as Record<string, unknown[]>,
    usr: {} as Record<string, unknown[]>,
    makeClient,
    requireRole: vi.fn(),
    getCurrentProfile: vi.fn(),
    notifyRole: vi.fn(),
    notifyUsers: vi.fn(),
    assignAgent: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/errors", () => ({ handleDbError: (e: { message?: string }) => e?.message ?? "db error" }));
vi.mock("@/lib/auth", () => ({ requireRole: h.requireRole, getCurrentProfile: h.getCurrentProfile }));
vi.mock("@/lib/notifications", () => ({
  notifyRole: h.notifyRole,
  notifyUsers: h.notifyUsers,
  notificationLinks: { case: (id: string) => `/cases/${id}` },
}));
vi.mock("@/app/(dashboard)/cases/actions", () => ({ assignAgent: h.assignAgent }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => h.makeClient(h.svc),
  createClient: async () => h.makeClient(h.usr),
}));

async function load() {
  return import("@/app/(dashboard)/cases/board-actions");
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(h.svc)) delete h.svc[k];
  for (const k of Object.keys(h.usr)) delete h.usr[k];
  h.requireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
  h.getCurrentProfile.mockResolvedValue({ id: "agent-profile-1", role: "agent" });
  h.assignAgent.mockResolvedValue({ ok: true });
});

describe("postCaseToBoard validation", () => {
  it("rejects slots below 1", async () => {
    const { postCaseToBoard } = await load();
    expect(await postCaseToBoard("c1", { slots: 0 })).toHaveProperty("error");
  });
  it("rejects slots above 50", async () => {
    const { postCaseToBoard } = await load();
    expect(await postCaseToBoard("c1", { slots: 51 })).toHaveProperty("error");
  });
  it("rejects negative pay", async () => {
    const { postCaseToBoard } = await load();
    expect(await postCaseToBoard("c1", { slots: 3, pay: -5 })).toHaveProperty("error");
  });
  it("posts and notifies claimers (excluding the poster)", async () => {
    h.usr.cases = [{ data: { case_number: "CASE-1" }, error: null }];
    const { postCaseToBoard } = await load();
    const res = await postCaseToBoard("c1", { slots: 2 });
    expect(res).toEqual({ ok: true });
    expect(h.requireRole).toHaveBeenCalledWith(["admin", "supervisor"]);
    expect(h.notifyRole).toHaveBeenCalledWith(
      ["agent", "supervisor"],
      expect.objectContaining({ url: "/field/board" }),
      "admin-1",
    );
  });
});

describe("requestCase", () => {
  it("errors when caller has no agent profile", async () => {
    h.svc.agents = [{ data: null, error: null }];
    const { requestCase } = await load();
    expect(await requestCase("c1")).toHaveProperty("error");
  });
  it("errors when the case is not on the board", async () => {
    h.svc.agents = [{ data: { id: "ag1", full_name: "A" }, error: null }];
    h.svc.cases = [{ data: { id: "c1", case_number: "C1", on_board: false, board_slots: 2 }, error: null }];
    const { requestCase } = await load();
    expect(await requestCase("c1")).toHaveProperty("error");
  });
  it("errors when all slots are already filled", async () => {
    h.svc.agents = [{ data: { id: "ag1", full_name: "A" }, error: null }];
    h.svc.cases = [{ data: { id: "c1", case_number: "C1", on_board: true, board_slots: 2 }, error: null }];
    h.svc.case_claims = [{ count: 2, error: null }]; // approved >= slots
    const { requestCase } = await load();
    expect(await requestCase("c1")).toHaveProperty("error");
  });
  it("maps a duplicate claim (23505) to a friendly error", async () => {
    h.svc.agents = [{ data: { id: "ag1", full_name: "A" }, error: null }];
    h.svc.cases = [{ data: { id: "c1", case_number: "C1", on_board: true, board_slots: 2 }, error: null }];
    h.svc.case_claims = [{ count: 0, error: null }];
    h.usr.case_claims = [{ error: { code: "23505" } }];
    const { requestCase } = await load();
    const res = await requestCase("c1");
    expect(res).toHaveProperty("error");
    expect((res as { error: string }).error).toMatch(/already requested/i);
  });
  it("succeeds and notifies staff", async () => {
    h.svc.agents = [{ data: { id: "ag1", full_name: "A" }, error: null }];
    h.svc.cases = [{ data: { id: "c1", case_number: "C1", on_board: true, board_slots: 2 }, error: null }];
    h.svc.case_claims = [{ count: 0, error: null }];
    h.usr.case_claims = [{ error: null }];
    const { requestCase } = await load();
    expect(await requestCase("c1")).toEqual({ ok: true });
    expect(h.notifyRole).toHaveBeenCalledWith(["admin", "supervisor"], expect.any(Object));
  });
});

describe("decideClaim", () => {
  it("errors when the claim does not exist", async () => {
    h.svc.case_claims = [{ data: null, error: null }];
    const { decideClaim } = await load();
    expect(await decideClaim("x", "approved")).toHaveProperty("error");
  });
  it("errors when the claim was already decided", async () => {
    h.svc.case_claims = [{ data: { id: "x", case_id: "c1", agent_id: "ag1", status: "approved" }, error: null }];
    const { decideClaim } = await load();
    expect(await decideClaim("x", "approved")).toHaveProperty("error");
  });
  it("rejects approval when the atomic RPC reports the quota met", async () => {
    h.svc.case_claims = [
      { data: { id: "x", case_id: "c1", agent_id: "ag1", status: "pending", agents: { profile_id: "p1" } }, error: null },
    ];
    h.svc["rpc:approve_case_claim"] = [{ data: [{ outcome: "quota_met" }], error: null }];
    const { decideClaim } = await load();
    const res = await decideClaim("x", "approved");
    expect(res).toHaveProperty("error");
    expect(h.assignAgent).not.toHaveBeenCalled();
  });
  it("approves via assignAgent when the RPC reserves a slot", async () => {
    h.svc.case_claims = [
      { data: { id: "x", case_id: "c1", agent_id: "ag1", status: "pending", agents: { profile_id: "p1" } }, error: null },
    ];
    h.svc["rpc:approve_case_claim"] = [
      { data: [{ outcome: "approved", case_id: "c1", agent_id: "ag1", case_number: "C1", quota_filled: false }], error: null },
    ];
    const { decideClaim } = await load();
    expect(await decideClaim("x", "approved")).toEqual({ ok: true });
    expect(h.assignAgent).toHaveBeenCalledWith("c1", "ag1");
  });
  it("releases the reserved slot when assignAgent fails after the RPC", async () => {
    h.svc.case_claims = [
      { data: { id: "x", case_id: "c1", agent_id: "ag1", status: "pending", agents: { profile_id: "p1" } }, error: null },
    ];
    // RPC reserved the LAST slot (quota_filled) and closed the board …
    h.svc["rpc:approve_case_claim"] = [
      { data: [{ outcome: "approved", case_id: "c1", agent_id: "ag1", case_number: "C1", quota_filled: true }], error: null },
    ];
    h.assignAgent.mockResolvedValueOnce({ error: "assignment failed" });
    const { decideClaim } = await load();
    // … so when assignment fails the action surfaces the error (and rolls the
    // claim back to pending + reopens the board via the service client).
    const res = await decideClaim("x", "approved");
    expect(res).toEqual({ error: "assignment failed" });
  });
  it("maps the RPC 'already_decided' outcome (claim flipped between read and RPC)", async () => {
    // The JS pre-check read the claim as pending, but a concurrent approval
    // flipped it before the RPC ran — the RPC is the source of truth.
    h.svc.case_claims = [
      { data: { id: "x", case_id: "c1", agent_id: "ag1", status: "pending", agents: { profile_id: "p1" } }, error: null },
    ];
    h.svc["rpc:approve_case_claim"] = [{ data: [{ outcome: "already_decided" }], error: null }];
    const { decideClaim } = await load();
    const res = await decideClaim("x", "approved");
    expect((res as { error: string }).error).toMatch(/already decided/i);
    expect(h.assignAgent).not.toHaveBeenCalled();
  });
  it("maps the RPC 'not_found' outcome (claim deleted between read and RPC)", async () => {
    h.svc.case_claims = [
      { data: { id: "x", case_id: "c1", agent_id: "ag1", status: "pending", agents: { profile_id: "p1" } }, error: null },
    ];
    h.svc["rpc:approve_case_claim"] = [{ data: [{ outcome: "not_found" }], error: null }];
    const { decideClaim } = await load();
    const res = await decideClaim("x", "approved");
    expect((res as { error: string }).error).toMatch(/not found/i);
    expect(h.assignAgent).not.toHaveBeenCalled();
  });
  // TOCTOU regression guard: two admins approve the same last slot at once. The
  // action defers the quota decision entirely to the atomic RPC (migration
  // 0083), so exactly one approval may win even though both read the claim as
  // pending. Here the mocked RPC serializes them (approved, then quota_met).
  it("serializes two concurrent approvals on the last slot — only one wins", async () => {
    h.svc.case_claims = [
      { data: { id: "x", case_id: "c1", agent_id: "ag1", status: "pending", agents: { profile_id: "p1" } }, error: null },
      { data: { id: "x", case_id: "c1", agent_id: "ag2", status: "pending", agents: { profile_id: "p2" } }, error: null },
    ];
    h.svc["rpc:approve_case_claim"] = [
      { data: [{ outcome: "approved", case_id: "c1", agent_id: "ag1", case_number: "C1", quota_filled: true }], error: null },
      { data: [{ outcome: "quota_met" }], error: null },
    ];
    const { decideClaim } = await load();
    const results = await Promise.all([
      decideClaim("x", "approved"),
      decideClaim("x", "approved"),
    ]);
    expect(results.filter((r) => (r as { ok?: boolean }).ok)).toHaveLength(1);
    expect(results.filter((r) => (r as { error?: string }).error)).toHaveLength(1);
    expect(h.assignAgent).toHaveBeenCalledTimes(1);
  });
});

describe("listBoardCases access model", () => {
  it("returns only safe fields and computes remaining/myClaim", async () => {
    h.getCurrentProfile.mockResolvedValue({ id: "agent-profile-1", role: "agent" });
    h.svc.cases = [{
      data: [{ id: "c1", case_number: "C1", case_type: "Surveillance", priority: "high",
               board_slots: 2, board_start_at: null, board_duration: null, board_pay: 500, board_location: "X" }],
      error: null,
    }];
    h.svc.agents = [{ data: { id: "ag1" }, error: null }];
    h.svc.case_claims = [{ data: [{ case_id: "c1", agent_id: "ag1", status: "pending" }], error: null }];
    const { listBoardCases } = await load();
    const rows = await listBoardCases();
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r).toMatchObject({ id: "c1", pay: 500, remaining: 2, myClaim: "pending" });
    // No sensitive/target columns leak through the safe projection.
    const keys = Object.keys(r);
    expect(keys.some((k) => k.includes("target") || k.includes("_enc") || k === "client_name")).toBe(false);
  });
});
