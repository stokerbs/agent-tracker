/**
 * setCheckinInterval server-action: admin/supervisor gate, input validation
 * (1–1440 or null), and that it writes the interval + resets the dedup stage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  result: { error: null } as { error: unknown },
  updatedWith: undefined as unknown,
  requireRole: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/errors", () => ({ handleDbError: (e: { message?: string }) => e?.message ?? "db error" }));
vi.mock("@/lib/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/email", () => ({ sendAssignmentEmail: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  notifyCaseParticipants: vi.fn(),
  notifyUsers: vi.fn(),
  notificationLinks: { case: (id: string) => `/cases/${id}` },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      b.update = (vals: unknown) => { h.updatedWith = vals; return b; };
      b.eq = () => h.result;
      return b;
    },
  }),
}));

import { setCheckinInterval } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  h.result = { error: null };
  h.updatedWith = undefined;
  h.requireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
});

describe("setCheckinInterval", () => {
  it("requires admin/supervisor", async () => {
    h.requireRole.mockRejectedValueOnce(new Error("redirect"));
    await expect(setCheckinInterval("case-1", 30)).rejects.toThrow();
    expect(h.updatedWith).toBeUndefined();
  });

  it("sets the interval and resets the stage", async () => {
    const res = await setCheckinInterval("case-1", 30);
    expect(res).toEqual({ ok: true });
    expect(h.updatedWith).toMatchObject({ checkin_interval_minutes: 30, checkin_stage: "ok" });
  });

  it("clears the cadence with null", async () => {
    const res = await setCheckinInterval("case-1", null);
    expect(res).toEqual({ ok: true });
    expect(h.updatedWith).toMatchObject({ checkin_interval_minutes: null, checkin_stage: "ok" });
  });

  it("rejects out-of-range / non-integer values before any write", async () => {
    expect(await setCheckinInterval("case-1", 0)).toEqual({ error: expect.any(String) });
    expect(await setCheckinInterval("case-1", 5000)).toEqual({ error: expect.any(String) });
    expect(await setCheckinInterval("case-1", 12.5)).toEqual({ error: expect.any(String) });
    expect(h.updatedWith).toBeUndefined();
  });
});
