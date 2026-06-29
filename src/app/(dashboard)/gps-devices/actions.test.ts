/**
 * setAnomalyWatch server-action contract: admin/supervisor gate, the audited
 * success path, and the {error} shape the optimistic toggle relies on to revert.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const makeBuilder = (result: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "update", "insert", "delete", "eq", "is", "maybeSingle"]) b[m] = () => b;
    (b as { then: unknown }).then = (res: (v: unknown) => unknown) => res(result);
    return b;
  };
  return {
    result: { error: null } as { error: unknown },
    updatedWith: undefined as unknown,
    makeBuilder,
    requireRole: vi.fn(),
    logAudit: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/errors", () => ({ handleDbError: (e: { message?: string }) => e?.message ?? "db error" }));
vi.mock("@/lib/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/gps903", () => ({
  getOrRefreshCredentialSession: vi.fn(),
  gps903GetTracking: vi.fn(),
  applyPositionToDevice: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => {
      const b = h.makeBuilder(h.result) as Record<string, unknown>;
      b.update = (vals: unknown) => { h.updatedWith = vals; return b; };
      return b;
    },
  }),
}));

import { setAnomalyWatch } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  h.result = { error: null };
  h.updatedWith = undefined;
  h.requireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
});

describe("setAnomalyWatch", () => {
  it("requires admin/supervisor before touching the DB", async () => {
    h.requireRole.mockRejectedValueOnce(new Error("redirect"));
    await expect(setAnomalyWatch("dev-1", false)).rejects.toThrow();
    expect(h.updatedWith).toBeUndefined();
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("disables watch and writes an audit entry on success", async () => {
    const res = await setAnomalyWatch("dev-1", false);
    expect(res).toEqual({ ok: true });
    expect(h.requireRole).toHaveBeenCalledWith(["admin", "supervisor"]);
    expect(h.updatedWith).toMatchObject({ anomaly_watch_enabled: false });
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DEVICE_ANOMALY_WATCH_SET", entityId: "dev-1", metadata: { enabled: false } }),
    );
  });

  it("returns an {error} (no audit) when the update fails", async () => {
    h.result = { error: { message: "boom" } };
    const res = await setAnomalyWatch("dev-1", true);
    expect(res).toEqual({ error: "boom" });
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});
