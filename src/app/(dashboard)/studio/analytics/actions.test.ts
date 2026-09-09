/**
 * Studio Analytics action tests: admin gate, completion_rate 0–100 and
 * non-negative-int validation, published-only guard, happy insert.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  profile: { id: "admin-1", role: "admin" } as { id: string; role: string } | null,
  master: { data: { id: "11111111-1111-4111-8111-111111111111", status: "published" } as { id: string; status: string } | null, error: null as unknown },
  inserted: [] as Record<string, unknown>[],
  insertResult: { data: { id: "snap-1" } as { id: string } | null, error: null as unknown },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/auth", () => ({
  requireStudioAdmin: vi.fn(async () => {
    if (!h.profile || h.profile.role !== "admin") throw new Error("Unauthorized");
    return h.profile;
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "studio_content_masters") {
        const b: Record<string, unknown> = {};
        for (const m of ["select", "eq"]) b[m] = () => b;
        b.maybeSingle = () => Promise.resolve(h.master);
        return b;
      }
      return {
        insert: (row: Record<string, unknown>) => {
          h.inserted.push(row);
          return { select: () => ({ single: () => Promise.resolve(h.insertResult) }) };
        },
      };
    },
  }),
}));

async function load() {
  return import("./actions");
}

const MASTER = "11111111-1111-4111-8111-111111111111";
const base = {
  master_id: MASTER,
  platform: "tiktok",
  recorded_at: "2026-09-01T12:00:00.000Z",
};

beforeEach(() => {
  h.profile = { id: "admin-1", role: "admin" };
  h.master = { data: { id: MASTER, status: "published" }, error: null };
  h.inserted = [];
  h.insertResult = { data: { id: "snap-1" }, error: null };
});

describe("recordMetrics", () => {
  it("rejects non-admins", async () => {
    h.profile = { id: "agent-1", role: "agent" };
    const { recordMetrics } = await load();
    await expect(recordMetrics({ ...base, views: 10 })).rejects.toThrow("Unauthorized");
    expect(h.inserted).toHaveLength(0);
  });

  it("rejects completion_rate outside 0–100", async () => {
    const { recordMetrics } = await load();
    const over = await recordMetrics({ ...base, completion_rate: 101 });
    expect(over).toEqual({ ok: false, error: expect.stringContaining("completion_rate") });
    const under = await recordMetrics({ ...base, completion_rate: -1 });
    expect(under.ok).toBe(false);
    expect(h.inserted).toHaveLength(0);
  });

  it("rejects negative or fractional counts", async () => {
    const { recordMetrics } = await load();
    expect((await recordMetrics({ ...base, views: -5 })).ok).toBe(false);
    expect((await recordMetrics({ ...base, likes: 1.5 })).ok).toBe(false);
    expect(h.inserted).toHaveLength(0);
  });

  it("rejects an unknown platform and a future recorded_at", async () => {
    const { recordMetrics } = await load();
    expect((await recordMetrics({ ...base, platform: "myspace" })).ok).toBe(false);
    expect((await recordMetrics({ ...base, recorded_at: "2099-01-01T00:00:00.000Z" })).ok).toBe(false);
  });

  it("refuses metrics on a non-published master", async () => {
    h.master = { data: { id: MASTER, status: "draft" }, error: null };
    const { recordMetrics } = await load();
    const res = await recordMetrics({ ...base, views: 10 });
    expect(res.ok).toBe(false);
    expect(h.inserted).toHaveLength(0);
  });

  it("inserts a manual snapshot with created_by from the session and nulls for blanks", async () => {
    const { recordMetrics } = await load();
    const res = await recordMetrics({ ...base, views: "12400", likes: 610, completion_rate: "41.2", reach: "", note: "  7 วันหลังโพสต์ " });
    expect(res).toEqual({ ok: true, data: { id: "snap-1" } });
    expect(h.inserted).toHaveLength(1);
    expect(h.inserted[0]).toMatchObject({
      master_id: MASTER,
      platform: "tiktok",
      source: "manual",
      created_by: "admin-1",
      views: 12400,
      likes: 610,
      completion_rate: 41.2,
      reach: null,
      dms: null,
      note: "7 วันหลังโพสต์",
    });
  });

  it("returns a safe error when the insert fails", async () => {
    h.insertResult = { data: null, error: { message: "duplicate key value violates", code: "23505" } };
    const { recordMetrics } = await load();
    const res = await recordMetrics({ ...base, views: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("duplicate key");
  });
});
