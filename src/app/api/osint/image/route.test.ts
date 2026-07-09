import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────
const getCurrentProfile = vi.fn();
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentProfile: () => getCurrentProfile() };
});

const checkRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));

const runPipeline = vi.fn();
vi.mock("@/lib/osint/pipeline", () => ({ runPipeline: (...a: unknown[]) => runPipeline(...a) }));

const logAudit = vi.fn();
vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));

vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

const caseMaybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => caseMaybeSingle() }) }) }),
  }),
}));

import { POST } from "./route";
import { SsrfError } from "@/lib/osint/fetch-guard";
import { IngestError } from "@/lib/osint/ingest";

function req(body: unknown): NextRequest {
  return new Request("http://localhost/api/osint/image", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as NextRequest;
}

const staff = { id: "u1", role: "admin" as const };

beforeEach(() => {
  getCurrentProfile.mockReset();
  checkRateLimit.mockReset();
  runPipeline.mockReset();
  logAudit.mockReset();
  caseMaybeSingle.mockReset();
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 19, retryAfterMs: 0 });
});

describe("POST /api/osint/image", () => {
  it("401 when not authenticated", async () => {
    getCurrentProfile.mockResolvedValue(null);
    const res = await POST(req({ image_url: "https://x/y.jpg" }));
    expect(res.status).toBe(401);
  });

  it("403 for non-staff", async () => {
    getCurrentProfile.mockResolvedValue({ id: "u2", role: "agent" });
    const res = await POST(req({ image_url: "https://x/y.jpg" }));
    expect(res.status).toBe(403);
  });

  it("429 when rate-limited", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 5000 });
    const res = await POST(req({ image_url: "https://x/y.jpg" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
  });

  it("400 on invalid JSON", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
  });

  it("400 when no input source is provided", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    const res = await POST(req({ file_name: "x.jpg" }));
    expect(res.status).toBe(400);
  });

  it("403 when the linked case is not accessible", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    caseMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(
      req({ image_url: "https://x/y.jpg", case_id: "00000000-0000-0000-0000-000000000000" }),
    );
    expect(res.status).toBe(403);
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("201 on success and writes an audit log", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    runPipeline.mockResolvedValue({
      id: "an1",
      sourceType: "url",
      stageStatus: { hashes: "complete" },
      hashes: { sha256: "abc" },
    });
    const res = await POST(req({ image_url: "https://x/y.jpg" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.analysis.id).toBe("an1");
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "OSINT_IMAGE_ANALYZE", entityId: "an1" }),
    );
  });

  it("maps SsrfError to 400", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    runPipeline.mockRejectedValue(new SsrfError("Blocked address: 10.0.0.1"));
    const res = await POST(req({ image_url: "https://x/y.jpg" }));
    expect(res.status).toBe(400);
  });

  it("maps IngestError to 422", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    runPipeline.mockRejectedValue(new IngestError("Malformed image"));
    const res = await POST(req({ image_url: "https://x/y.jpg" }));
    expect(res.status).toBe(422);
  });

  it("500 on unexpected error", async () => {
    getCurrentProfile.mockResolvedValue(staff);
    runPipeline.mockRejectedValue(new Error("boom"));
    const res = await POST(req({ image_url: "https://x/y.jpg" }));
    expect(res.status).toBe(500);
  });
});
