/**
 * Calendar action tests: auth guard, status gate (drafts can't be scheduled),
 * and the happy path for rescheduling an already-scheduled master.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  admin: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  master: { data: null as Record<string, unknown> | null, error: null as { message: string } | null },
  updateResult: { error: null as { message: string } | null },
  insertResult: { data: { id: "new-1" } as { id: string } | null, error: null as { message: string } | null },
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  audits: [] as Record<string, unknown>[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async (e: Record<string, unknown>) => void h.audits.push(e)) }));
vi.mock("@/lib/studio/auth", () => ({
  getStudioAdmin: vi.fn(async () => h.admin),
  requireStudioAdmin: vi.fn(async () => {
    if (!h.admin) throw new Error("Unauthorized");
    return h.admin;
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit"]) b[m] = () => b;
      b.maybeSingle = async () => h.master;
      b.single = async () => h.insertResult;
      b.update = (payload: Record<string, unknown>) => {
        h.updates.push(payload);
        return b;
      };
      b.insert = (payload: Record<string, unknown>) => {
        h.inserts.push(payload);
        return b;
      };
      (b as { then: unknown }).then = (r: (v: unknown) => unknown) => r(h.updateResult);
      return b;
    },
  }),
}));

async function load() {
  return import("./actions");
}

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.admin = { id: "admin-1", role: "admin" };
  h.master = { data: null, error: null };
  h.updateResult = { error: null };
  h.insertResult = { data: { id: "new-1" }, error: null };
  h.updates.length = 0;
  h.inserts.length = 0;
  h.audits.length = 0;
});

describe("authorization", () => {
  it("refuses every action when the caller is not a studio admin", async () => {
    h.admin = null;
    const a = await load();
    expect(await a.rescheduleMaster(ID, "2026-09-10T12:00:00.000Z")).toMatchObject({ ok: false });
    expect(await a.scheduleMasterToDay(ID, "2026-09-10", "19:00")).toMatchObject({ ok: false });
    expect(await a.moveMasterToDay(ID, "2026-09-10")).toMatchObject({ ok: false });
    expect(await a.unscheduleMaster(ID)).toMatchObject({ ok: false });
    expect(await a.createDraftOnDay({ day: "2026-09-10" })).toMatchObject({ ok: false });
    expect(h.updates).toHaveLength(0);
    expect(h.inserts).toHaveLength(0);
  });
});

describe("scheduling gate", () => {
  it("refuses to schedule a draft with a Thai message and writes nothing", async () => {
    h.master = { data: { id: ID, title: "x", status: "draft", scheduled_at: null }, error: null };
    const { scheduleMasterToDay, rescheduleMaster } = await load();
    const res = await scheduleMasterToDay(ID, "2026-09-10", "19:00");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("ร่าง");
    expect(await rescheduleMaster(ID, "2026-09-10T12:00:00.000Z")).toMatchObject({ ok: false });
    expect(h.updates).toHaveLength(0);
  });

  it("refuses review / rejected / archived too", async () => {
    const { scheduleMasterToDay } = await load();
    for (const status of ["review", "rejected", "archived", "published"]) {
      h.master = { data: { id: ID, title: "x", status, scheduled_at: null }, error: null };
      expect(await scheduleMasterToDay(ID, "2026-09-10")).toMatchObject({ ok: false });
    }
    expect(h.updates).toHaveLength(0);
  });

  it("rejects malformed ids and dates before touching the database", async () => {
    const { scheduleMasterToDay, rescheduleMaster } = await load();
    expect(await scheduleMasterToDay("not-a-uuid", "2026-09-10")).toMatchObject({ ok: false });
    expect(await scheduleMasterToDay(ID, "10/09/2026")).toMatchObject({ ok: false });
    expect(await scheduleMasterToDay(ID, "2026-09-10", "25:00")).toMatchObject({ ok: false });
    expect(await rescheduleMaster(ID, "tomorrow")).toMatchObject({ ok: false });
    expect(h.updates).toHaveLength(0);
  });

  it("returns not-found when the master does not exist", async () => {
    h.master = { data: null, error: null };
    const { rescheduleMaster } = await load();
    expect(await rescheduleMaster(ID, "2026-09-10T12:00:00.000Z")).toMatchObject({ ok: false, error: "ไม่พบคอนเทนต์นี้" });
  });
});

describe("happy paths", () => {
  it("reschedules a scheduled master and audits the change", async () => {
    h.master = { data: { id: ID, title: "x", status: "scheduled", scheduled_at: "2026-09-09T12:00:00.000Z" }, error: null };
    const { rescheduleMaster } = await load();
    const res = await rescheduleMaster(ID, "2026-09-12T12:00:00.000Z");
    expect(res).toEqual({ ok: true, data: { id: ID, scheduled_at: "2026-09-12T12:00:00.000Z", status: "scheduled" } });
    expect(h.updates).toEqual([{ scheduled_at: "2026-09-12T12:00:00.000Z", status: "scheduled" }]);
    expect(h.audits[0]).toMatchObject({ action: "studio.content.reschedule", entityId: ID, actorId: "admin-1" });
  });

  it("schedules an approved master to a Bangkok day/time and flips it to scheduled", async () => {
    h.master = { data: { id: ID, title: "x", status: "approved", scheduled_at: null }, error: null };
    const { scheduleMasterToDay } = await load();
    const res = await scheduleMasterToDay(ID, "2026-09-10", "19:00");
    expect(res).toMatchObject({ ok: true, data: { scheduled_at: "2026-09-10T12:00:00.000Z", status: "scheduled" } });
    expect(h.updates[0]).toEqual({ scheduled_at: "2026-09-10T12:00:00.000Z", status: "scheduled" });
  });

  it("moves to another day keeping the original Bangkok time-of-day", async () => {
    h.master = { data: { id: ID, title: "x", status: "scheduled", scheduled_at: "2026-09-09T14:15:00.000Z" }, error: null }; // 21:15 BKK
    const { moveMasterToDay } = await load();
    const res = await moveMasterToDay(ID, "2026-09-20");
    expect(res).toMatchObject({ ok: true, data: { scheduled_at: "2026-09-20T14:15:00.000Z" } });
  });

  it("unschedules only a scheduled master, back to approved with no date", async () => {
    h.master = { data: { id: ID, title: "x", status: "scheduled", scheduled_at: "2026-09-09T12:00:00.000Z" }, error: null };
    const { unscheduleMaster } = await load();
    expect(await unscheduleMaster(ID)).toEqual({ ok: true, data: { id: ID, status: "approved" } });
    expect(h.updates[0]).toEqual({ scheduled_at: null, status: "approved" });

    h.updates.length = 0;
    h.master = { data: { id: ID, title: "x", status: "approved", scheduled_at: null }, error: null };
    expect(await unscheduleMaster(ID)).toMatchObject({ ok: false });
    expect(h.updates).toHaveLength(0);
  });

  it("creates a draft pre-dated to the day and returns its id", async () => {
    const { createDraftOnDay } = await load();
    const res = await createDraftOnDay({ day: "2026-09-10", time: "08:00", title: "  คลิป GPS  " });
    expect(res).toEqual({ ok: true, data: { id: "new-1" } });
    expect(h.inserts[0]).toMatchObject({ title: "คลิป GPS", status: "draft", scheduled_at: "2026-09-10T01:00:00.000Z", created_by: "admin-1" });
  });

  it("surfaces a database failure as a Thai error", async () => {
    h.master = { data: { id: ID, title: "x", status: "approved", scheduled_at: null }, error: null };
    h.updateResult = { error: { message: "boom" } };
    const { scheduleMasterToDay } = await load();
    expect(await scheduleMasterToDay(ID, "2026-09-10")).toMatchObject({ ok: false });
  });
});
