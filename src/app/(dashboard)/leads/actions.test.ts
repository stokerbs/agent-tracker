/**
 * Admin lead-pipeline actions: validation, stage/status/converted_at rules,
 * audit-log contents (no contact data), and signed-URL guards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  requireRole: vi.fn(),
  logAudit: vi.fn(),
  reportError: vi.fn(),
  revalidatePath: vi.fn(),
  current: { data: { stage: "new", converted_at: null }, error: null } as unknown,
  updateResult: { error: null } as unknown,
  updatedWith: undefined as unknown,
  fileRow: { data: { id: "11111111-1111-4111-8111-111111111111", lead_id: "lead-1", storage_path: "lead-files/lead-1/abc.jpg", file_name: "photo.jpg" }, error: null } as unknown,
  signed: { data: { signedUrl: "https://signed.example/x" }, error: null } as unknown,
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/errors", () => ({ handleDbError: () => "safe message", reportError: h.reportError }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "marketing_lead_files") {
        return { select: () => ({ eq: () => ({ single: async () => h.fileRow }) }) };
      }
      return {
        select: () => ({ eq: () => ({ single: async () => h.current }) }),
        update: (vals: unknown) => {
          h.updatedWith = vals;
          return { eq: async () => h.updateResult };
        },
      };
    },
  }),
  createServiceClient: () => ({ storage: { from: () => ({ createSignedUrl: h.createSignedUrl }) } }),
}));

import { updateLeadPipeline, getLeadFileUrl } from "./actions";

const LEAD = "22222222-2222-4222-8222-222222222222";
function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  const base: Record<string, string> = { id: LEAD, stage: "contacted", estimatedValue: "", quotedValue: "", finalRevenue: "", adminNotes: "" };
  for (const [k, v] of Object.entries({ ...base, ...over })) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
  h.current = { data: { stage: "new", converted_at: null }, error: null };
  h.updateResult = { error: null };
  h.updatedWith = undefined;
  h.createSignedUrl.mockResolvedValue(h.signed);
});

describe("updateLeadPipeline", () => {
  it("requires an admin before touching the DB", async () => {
    h.requireRole.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(updateLeadPipeline(fd())).rejects.toThrow();
    expect(h.updatedWith).toBeUndefined();
    expect(h.requireRole).toHaveBeenCalledWith(["admin"]);
  });

  it("rejects bad ids, unknown stages and non-numeric or negative money", async () => {
    expect(await updateLeadPipeline(fd({ id: "nope" }))).toEqual({ error: "invalid_input" });
    expect(await updateLeadPipeline(fd({ stage: "won" }))).toEqual({ error: "invalid_input" });
    expect(await updateLeadPipeline(fd({ quotedValue: "abc" }))).toEqual({ error: "invalid_input" });
    expect(await updateLeadPipeline(fd({ finalRevenue: "-5" }))).toEqual({ error: "invalid_input" });
    expect(h.updatedWith).toBeUndefined();
  });

  it("not_found when the lead cannot be read", async () => {
    h.current = { data: null, error: { message: "x" } };
    expect(await updateLeadPipeline(fd())).toEqual({ error: "not_found" });
  });

  it("syncs legacy status, stamps stage_changed_at only on change, nulls empty notes", async () => {
    expect(await updateLeadPipeline(fd({ stage: "quotation_sent", quotedValue: "45000", adminNotes: "" }))).toEqual({ ok: true });
    expect(h.updatedWith).toMatchObject({ stage: "quotation_sent", status: "contacted", quoted_value: 45000, admin_notes: null, estimated_value: null });
    expect((h.updatedWith as { stage_changed_at?: string }).stage_changed_at).toBeTypeOf("string");
    expect((h.updatedWith as { converted_at?: string }).converted_at).toBeUndefined();
    expect(h.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "LEAD_STAGE_CHANGE", entity: "marketing_leads", entityId: LEAD }));
    expect(h.revalidatePath).toHaveBeenCalledWith("/leads");

    h.current = { data: { stage: "quotation_sent", converted_at: null }, error: null };
    await updateLeadPipeline(fd({ stage: "quotation_sent", adminNotes: "called twice" }));
    expect((h.updatedWith as { stage_changed_at?: string }).stage_changed_at).toBeUndefined();
    expect(h.logAudit).toHaveBeenLastCalledWith(expect.objectContaining({ action: "LEAD_PIPELINE_UPDATE" }));
  });

  it("stamps converted_at the first time a paid stage is reached and never overwrites it", async () => {
    await updateLeadPipeline(fd({ stage: "paid" }));
    expect((h.updatedWith as { converted_at?: string }).converted_at).toBeTypeOf("string");
    expect((h.updatedWith as { status: string }).status).toBe("contacted");

    h.current = { data: { stage: "paid", converted_at: "2026-01-01T00:00:00Z" }, error: null };
    await updateLeadPipeline(fd({ stage: "closed", finalRevenue: "90000" }));
    expect((h.updatedWith as { converted_at?: string }).converted_at).toBeUndefined();
    expect(h.updatedWith).toMatchObject({ status: "closed", final_revenue: 90000 });
  });

  it("audit metadata never carries notes or contact data", async () => {
    await updateLeadPipeline(fd({ stage: "qualified", adminNotes: "client WeChat wang_88, phone 0812345678" }));
    const meta = JSON.stringify(h.logAudit.mock.calls[0]![0].metadata);
    expect(meta).not.toContain("wang_88");
    expect(meta).not.toContain("0812345678");
  });

  it("returns a safe message on a DB error", async () => {
    h.updateResult = { error: { message: 'relation "marketing_leads" violates constraint marketing_leads_stage_check' } };
    expect(await updateLeadPipeline(fd())).toEqual({ error: "safe message" });
  });
});

describe("getLeadFileUrl", () => {
  it("validates the id and requires admin", async () => {
    expect(await getLeadFileUrl("not-a-uuid")).toEqual({ error: "invalid_input" });
    h.requireRole.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(getLeadFileUrl("11111111-1111-4111-8111-111111111111")).rejects.toThrow();
  });

  it("not_found for a missing row or a path outside the lead-files bucket", async () => {
    const saved = h.fileRow;
    h.fileRow = { data: null, error: { message: "x" } };
    expect(await getLeadFileUrl("11111111-1111-4111-8111-111111111111")).toEqual({ error: "not_found" });
    h.fileRow = { data: { id: "f", lead_id: "l", storage_path: "evidence/secret.jpg", file_name: "x" }, error: null };
    expect(await getLeadFileUrl("11111111-1111-4111-8111-111111111111")).toEqual({ error: "not_found" });
    expect(h.createSignedUrl).not.toHaveBeenCalled();
    h.fileRow = saved;
  });

  it("mints a 10-minute download URL for the object path and audits the view", async () => {
    expect(await getLeadFileUrl("11111111-1111-4111-8111-111111111111")).toEqual({ url: "https://signed.example/x" });
    expect(h.createSignedUrl).toHaveBeenCalledWith("lead-1/abc.jpg", 600, { download: "photo.jpg" });
    expect(h.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "LEAD_FILE_VIEW", entity: "marketing_lead_files", metadata: { lead_id: "lead-1" } }));
  });

  it("storage_error is logged, not leaked", async () => {
    h.createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "bucket exploded" } });
    expect(await getLeadFileUrl("11111111-1111-4111-8111-111111111111")).toEqual({ error: "storage_error" });
    expect(h.reportError).toHaveBeenCalledWith(expect.anything(), "leads:fileUrl");
  });
});
