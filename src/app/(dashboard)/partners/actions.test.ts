import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  requireRole: vi.fn(),
  logAudit: vi.fn(),
  revalidatePath: vi.fn(),
  current: { data: { stage: "new" }, error: null } as unknown,
  updateResult: { error: null } as unknown,
  updatedWith: undefined as unknown,
}));
vi.mock("@/lib/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/errors", () => ({ handleDbError: () => "safe message" }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => h.current }) }),
      update: (vals: unknown) => { h.updatedWith = vals; return { eq: async () => h.updateResult }; },
    }),
  }),
}));

import { updatePartner } from "./actions";

const ID = "33333333-3333-4333-8333-333333333333";
const fd = (o: Record<string, string> = {}) => { const f = new FormData(); for (const [k, v] of Object.entries({ id: ID, stage: "contacted", adminNotes: "", ...o })) f.set(k, v); return f; };

beforeEach(() => {
  vi.clearAllMocks();
  h.requireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
  h.current = { data: { stage: "new" }, error: null };
  h.updateResult = { error: null };
  h.updatedWith = undefined;
});

describe("updatePartner", () => {
  it("requires admin and validates input", async () => {
    h.requireRole.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(updatePartner(fd())).rejects.toThrow();
    expect(await updatePartner(fd({ stage: "won" }))).toEqual({ error: "invalid_input" });
    expect(await updatePartner(fd({ id: "x" }))).toEqual({ error: "invalid_input" });
  });
  it("stamps stage_changed_at only on change, nulls empty notes, audits without contact data", async () => {
    expect(await updatePartner(fd({ stage: "agreement", adminNotes: "" }))).toEqual({ ok: true });
    expect(h.updatedWith).toMatchObject({ stage: "agreement", admin_notes: null });
    expect((h.updatedWith as { stage_changed_at?: string }).stage_changed_at).toBeTypeOf("string");
    expect(h.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "PARTNER_STAGE_CHANGE", metadata: { from: "new", to: "agreement" } }));
    h.current = { data: { stage: "agreement" }, error: null };
    await updatePartner(fd({ stage: "agreement", adminNotes: "WeChat siamlegal" }));
    expect((h.updatedWith as { stage_changed_at?: string }).stage_changed_at).toBeUndefined();
    expect(JSON.stringify(h.logAudit.mock.calls[1]![0].metadata)).not.toContain("siamlegal");
    expect(h.revalidatePath).toHaveBeenCalledWith("/partners");
  });
  it("not_found / safe db error", async () => {
    h.current = { data: null, error: { message: "x" } };
    expect(await updatePartner(fd())).toEqual({ error: "not_found" });
    h.current = { data: { stage: "new" }, error: null };
    h.updateResult = { error: { message: "constraint marketing_partners_stage_check" } };
    expect(await updatePartner(fd())).toEqual({ error: "safe message" });
  });
});
