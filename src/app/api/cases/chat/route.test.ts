import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// isStaff is the real pure check; getCurrentProfile is stubbed.
vi.mock("@/lib/auth", () => ({
  getCurrentProfile: vi.fn(),
  isStaff: (r: string) => r === "admin" || r === "supervisor",
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { POST } from "./route";
import { getCurrentProfile } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const UUID = "11111111-1111-1111-1111-111111111111";
const okBody = { caseId: UUID, messages: [{ role: "user", content: "สรุปคดี" }] };

// Minimal Supabase stub: cases → maybeSingle; timeline_entries → limit.
function supa({ caseRow }: { caseRow: unknown }) {
  const from = (table: string) => {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b, eq: () => b, order: () => b,
      maybeSingle: async () => ({ data: table === "cases" ? caseRow : null }),
      limit: async () => ({ data: table === "timeline_entries" ? [] : [] }),
    });
    return b;
  };
  return { from };
}

const call = (body: unknown) =>
  POST({ json: async () => body } as unknown as Parameters<typeof POST>[0]);

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: "u1", role: "admin" } as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 39, retryAfterMs: 0 } as never);
  vi.mocked(createClient).mockResolvedValue(supa({ caseRow: { case_number: "C-1", case_type: "x", status: "active", client_name: "ACME" } }) as never);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ content: [{ text: "คำตอบ" }] }) }) as Response));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("POST /api/cases/chat — auth & branch ladder", () => {
  it("401 when not authenticated", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(null as never);
    expect((await call(okBody)).status).toBe(401);
  });

  it("403 for non-staff (agent)", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: "u1", role: "agent" } as never);
    expect((await call(okBody)).status).toBe(403);
  });

  it("429 when rate-limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 } as never);
    expect((await call(okBody)).status).toBe(429);
  });

  it("400 on invalid payload", async () => {
    expect((await call({ caseId: "not-a-uuid", messages: [] })).status).toBe(400);
  });

  it("404 when the case is not visible (RLS)", async () => {
    vi.mocked(createClient).mockResolvedValue(supa({ caseRow: null }) as never);
    expect((await call(okBody)).status).toBe(404);
  });

  it("returns a friendly reply (200) when no API key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await call(okBody);
    expect(res.status).toBe(200);
    expect((await res.json()).reply).toContain("ยังไม่ได้ตั้งค่า");
  });

  it("200 with the model reply on success", async () => {
    const res = await call(okBody);
    expect(res.status).toBe(200);
    expect((await res.json()).reply).toBe("คำตอบ");
  });

  it("502 when the AI request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 }) as Response));
    expect((await call(okBody)).status).toBe(502);
  });
});
