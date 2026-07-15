import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const getCurrentProfile = vi.fn();
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentProfile: () => getCurrentProfile() };
});
const checkRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
const runContactPipeline = vi.fn();
vi.mock("@/lib/contact/pipeline", () => ({ runContactPipeline: (...a: unknown[]) => runContactPipeline(...a) }));
const logAudit = vi.fn();
vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));
const caseMaybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => caseMaybeSingle() }) }) }) }),
}));

import { POST } from "./route";

function req(body: unknown): NextRequest {
  return new Request("http://localhost/api/osint/contact", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as NextRequest;
}

const staff = { id: "u1", role: "supervisor" as const };

beforeEach(() => {
  getCurrentProfile.mockReset();
  checkRateLimit.mockReset();
  runContactPipeline.mockReset();
  logAudit.mockReset();
  caseMaybeSingle.mockReset();
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 39, retryAfterMs: 0 });
});

describe("POST /api/osint/contact", () => {
  it("401 when not authenticated", async () => {
    getCurrentProfile.mockResolvedValue(null);
    expect((await POST(req({ type: "phone", value: "0812345678" }))).status).toBe(401);
  });

  it("403 for non-staff", async () => {
    getCurrentProfile.mockResolvedValue({ id: "u2", role: "agent" });
    expect((await POST(req({ type: "phone", value: "0812345678" }))).status).toBe(403);
  });

  it("429 when rate-limited", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 5000 });
    expect((await POST(req({ type: "phone", value: "0812345678" }))).status).toBe(429);
  });

  it("400 on invalid body", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    expect((await POST(req({ type: "bogus", value: "x" }))).status).toBe(400);
  });

  it("201 on success and writes an audit log without the raw value", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    runContactPipeline.mockResolvedValue({ id: "c1", inputType: "phone", stageStatus: { phone: "complete" } });
    const res = await POST(req({ type: "phone", value: "0812345678" }));
    expect(res.status).toBe(201);
    const call = logAudit.mock.calls[0][0];
    expect(call.action).toBe("CONTACT_LOOKUP");
    expect(call.entityId).toBe("c1");
    // The raw identifier must never appear in the audit metadata.
    expect(JSON.stringify(call.metadata)).not.toContain("0812345678");
  });

  it("403 when the linked case is not accessible", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    caseMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(req({ type: "phone", value: "0812345678", case_id: "00000000-0000-0000-0000-000000000000" }));
    expect(res.status).toBe(403);
    expect(runContactPipeline).not.toHaveBeenCalled();
  });

  it("500 on unexpected error", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    runContactPipeline.mockRejectedValue(new Error("boom"));
    expect((await POST(req({ type: "phone", value: "0812345678" }))).status).toBe(500);
  });
});
