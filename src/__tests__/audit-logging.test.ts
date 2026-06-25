/**
 * SEC-6: verifies privileged service-role mutations emit EXACTLY ONE audit_logs
 * entry on success, never leak secrets into metadata, and that audit writes are
 * non-fatal (a failed audit insert never changes the action's result, and no
 * audit fires when the underlying mutation errors).
 *
 * Strategy: the real logAudit helper runs against a mocked service client whose
 * `audit_logs` table exposes a dedicated `auditInsert` spy. We assert on that
 * spy directly — exercising the action + helper integration end to end.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- shared, hoisted mocks ---------------------------------------------------
const h = vi.hoisted(() => {
  const auditInsert = vi.fn();
  // Per-table terminal results, reset before each test.
  const tableResults: Record<string, unknown> = {};
  const state = { auditShouldThrow: false };

  // A thenable query builder: every chain method returns itself, and awaiting
  // any terminal resolves the configured result for that table.
  function builder(result: unknown) {
    const b: Record<string, unknown> = {};
    for (const m of [
      "insert",
      "update",
      "upsert",
      "delete",
      "select",
      "eq",
      "is",
      "single",
      "maybeSingle",
    ]) {
      b[m] = vi.fn(() => b);
    }
    b.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return b;
  }

  const createServiceClient = vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "audit_logs") {
        return {
          insert: (row: unknown) => {
            auditInsert(row);
            if (state.auditShouldThrow) {
              return Promise.reject(new Error("audit boom"));
            }
            return Promise.resolve({ error: null });
          },
        };
      }
      return builder(tableResults[table] ?? { data: null, error: null });
    }),
  }));

  const requireRole = vi.fn(async () => ({ id: "admin-id", role: "admin" }));

  return { auditInsert, tableResults, state, createServiceClient, requireRole };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/errors", () => ({ handleDbError: vi.fn(() => "db error") }));
// invoices/actions.ts pulls these in; they import "server-only" (unresolvable in tests).
vi.mock("@/lib/notifications", () => ({ notifyUsers: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendInvoiceEmail: vi.fn() }));

vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth")>();
  return { ...original, requireRole: h.requireRole };
});

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: h.createServiceClient,
  createClient: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(h.tableResults)) delete h.tableResults[k];
  h.state.auditShouldThrow = false;
});

// --- helper ------------------------------------------------------------------
describe("logAudit helper", () => {
  it("inserts the audit columns and never sets ip_address", async () => {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      actorId: "actor-1",
      action: "X_DO",
      entity: "things",
      entityId: "thing-1",
      metadata: { a: 1 },
    });

    expect(h.auditInsert).toHaveBeenCalledTimes(1);
    const row = h.auditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toEqual({
      actor_id: "actor-1",
      action: "X_DO",
      entity: "things",
      entity_id: "thing-1",
      metadata: { a: 1 },
    });
    expect(row).not.toHaveProperty("ip_address");
  });

  it("is non-fatal: a throwing insert is swallowed", async () => {
    h.state.auditShouldThrow = true;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { logAudit } = await import("@/lib/audit");

    await expect(
      logAudit({ actorId: null, action: "X", entity: "y" }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

// --- gps903 credentials ------------------------------------------------------
describe("gps903 credentials auditing", () => {
  it("createCredential logs CREDENTIAL_CREATE exactly once without the password", async () => {
    h.tableResults["gps903_credentials"] = { data: { id: "cred-9" }, error: null };
    const { createCredential } = await import(
      "@/app/(dashboard)/gps903-credentials/actions"
    );

    const res = await createCredential({
      device_name: "Tracker A",
      imei: "111222333",
      device_password: "s3cr3t-pw",
      is_active: true,
    });

    expect(res).toEqual({ ok: true });
    expect(h.auditInsert).toHaveBeenCalledTimes(1);
    const row = h.auditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.action).toBe("CREDENTIAL_CREATE");
    expect(row.entity).toBe("gps903_credentials");
    expect(row.entity_id).toBe("cred-9");
    expect(row.metadata).toEqual({ device_name: "Tracker A", imei: "111222333" });
    // No secret leakage.
    expect(row.metadata).not.toHaveProperty("device_password");
    expect(JSON.stringify(row)).not.toContain("s3cr3t-pw");
  });

  it("createCredential does NOT audit when the insert errors", async () => {
    h.tableResults["gps903_credentials"] = {
      data: null,
      error: { code: "23505", message: "dup" },
    };
    const { createCredential } = await import(
      "@/app/(dashboard)/gps903-credentials/actions"
    );

    const res = await createCredential({
      device_name: "X",
      imei: "1",
      device_password: "pw",
      is_active: true,
    });

    expect(res).toEqual({ error: "db error" });
    expect(h.auditInsert).not.toHaveBeenCalled();
  });

  it("createCredential succeeds even if the audit insert fails (non-fatal)", async () => {
    h.tableResults["gps903_credentials"] = { data: { id: "cred-9" }, error: null };
    h.state.auditShouldThrow = true;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createCredential } = await import(
      "@/app/(dashboard)/gps903-credentials/actions"
    );

    const res = await createCredential({
      device_name: "X",
      imei: "1",
      device_password: "pw",
      is_active: true,
    });

    expect(res).toEqual({ ok: true });
    expect(h.auditInsert).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("updateCredential logs CREDENTIAL_UPDATE with password_changed but no password value", async () => {
    h.tableResults["gps903_credentials"] = { error: null };
    const { updateCredential } = await import(
      "@/app/(dashboard)/gps903-credentials/actions"
    );

    const res = await updateCredential("cred-1", {
      device_name: "Renamed",
      device_password: "new-secret",
    });

    expect(res).toEqual({ ok: true });
    expect(h.auditInsert).toHaveBeenCalledTimes(1);
    const row = h.auditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.action).toBe("CREDENTIAL_UPDATE");
    expect(row.entity_id).toBe("cred-1");
    const meta = row.metadata as Record<string, unknown>;
    expect(meta.password_changed).toBe(true);
    expect(meta).not.toHaveProperty("device_password");
    expect(JSON.stringify(row)).not.toContain("new-secret");
  });
});

// --- gps device access -------------------------------------------------------
describe("gps device access auditing", () => {
  it("grantDeviceAccess logs DEVICE_ACCESS_GRANT exactly once", async () => {
    h.tableResults["gps_device_access"] = { error: null };
    const { grantDeviceAccess } = await import(
      "@/app/(dashboard)/gps-devices/actions"
    );

    const res = await grantDeviceAccess("dev-1", "prof-7");

    expect(res).toEqual({ ok: true });
    expect(h.auditInsert).toHaveBeenCalledTimes(1);
    const row = h.auditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.action).toBe("DEVICE_ACCESS_GRANT");
    expect(row.entity).toBe("gps_device_access");
    expect(row.entity_id).toBe("dev-1");
    expect(row.metadata).toEqual({ profile_id: "prof-7" });
  });
});

// --- geofences ---------------------------------------------------------------
describe("geofence auditing", () => {
  it("createGeofence logs GEOFENCE_CREATE exactly once with the new id", async () => {
    h.tableResults["geofences"] = {
      data: { id: "fence-3", name: "Zone" },
      error: null,
    };
    const { createGeofence } = await import("@/app/(dashboard)/map/actions");

    const res = await createGeofence({
      name: "Zone",
      description: null,
      color: "#fff",
      coordinates: [{ lat: 1, lng: 2 }],
    });

    expect(res.error).toBeUndefined();
    expect(h.auditInsert).toHaveBeenCalledTimes(1);
    const row = h.auditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.action).toBe("GEOFENCE_CREATE");
    expect(row.entity).toBe("geofences");
    expect(row.entity_id).toBe("fence-3");
    expect(row.metadata).toEqual({ name: "Zone" });
  });

  it("createGeofence does NOT audit when the insert errors", async () => {
    h.tableResults["geofences"] = { data: null, error: { message: "boom" } };
    const { createGeofence } = await import("@/app/(dashboard)/map/actions");

    const res = await createGeofence({
      name: "Zone",
      description: null,
      color: "#fff",
      coordinates: [],
    });

    expect(res).toHaveProperty("error");
    expect(h.auditInsert).not.toHaveBeenCalled();
  });
});

// --- invoices ----------------------------------------------------------------
describe("invoice auditing", () => {
  it("deleteInvoice logs INVOICE_SOFT_DELETE exactly once", async () => {
    h.tableResults["invoices"] = { error: null };
    const { deleteInvoice } = await import(
      "@/app/(dashboard)/invoices/actions"
    );

    const res = await deleteInvoice("inv-1");

    expect(res).toEqual({ ok: true });
    expect(h.auditInsert).toHaveBeenCalledTimes(1);
    const row = h.auditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.action).toBe("INVOICE_SOFT_DELETE");
    expect(row.entity).toBe("invoices");
    expect(row.entity_id).toBe("inv-1");
  });
});

// --- ai prompts --------------------------------------------------------------
describe("ai prompt auditing", () => {
  it("saveAiPrompt logs AI_PROMPT_UPDATE exactly once without dumping prompt text", async () => {
    h.tableResults["ai_prompts"] = { error: null };
    h.tableResults["ai_prompt_versions"] = { error: null };
    const { saveAiPrompt } = await import(
      "@/app/(dashboard)/settings/ai-prompts/actions"
    );

    const res = await saveAiPrompt("prompt-1", "Some long secret-ish prompt body");

    expect(res).toEqual({ ok: true });
    expect(h.auditInsert).toHaveBeenCalledTimes(1);
    const row = h.auditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.action).toBe("AI_PROMPT_UPDATE");
    expect(row.entity).toBe("ai_prompts");
    expect(row.entity_id).toBe("prompt-1");
    expect(row.metadata).toEqual({ version_saved: true });
    expect(JSON.stringify(row)).not.toContain("prompt body");
  });
});
