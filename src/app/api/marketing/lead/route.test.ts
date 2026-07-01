import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Keep NextResponse real; only stub after() so the notification isn't scheduled.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    void fn();
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  notifyRole: vi.fn(),
  notificationLinks: { leads: () => "/leads" },
}));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

import { POST } from "./route";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyRole } from "@/lib/notifications";

function svc(insertResult: { error: unknown } = { error: null }) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  return { client: { from: () => ({ insert }) }, insert };
}

function req(
  body: unknown,
  { ip = "1.2.3.4", ua = "test-ua", badJson = false } = {},
): NextRequest {
  const headers = new Map([
    ["x-forwarded-for", ip],
    ["user-agent", ua],
  ]);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => {
      if (badJson) throw new Error("bad json");
      return body;
    },
  } as unknown as NextRequest;
}

const valid = { name: "สมชาย", phone: "0812345678", caseType: "สืบชู้สาว", message: "hi", locale: "th" };

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 4, retryAfterMs: 0 } as never);
  vi.mocked(createServiceClient).mockReturnValue(svc().client as never);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/marketing/lead", () => {
  it("200 and inserts on a valid submission", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(s.insert).toHaveBeenCalledTimes(1);
    expect(s.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "สมชาย", phone: "0812345678", case_type: "สืบชู้สาว", locale: "th", source: "website" }),
    );
    expect(vi.mocked(notifyRole)).toHaveBeenCalled();
  });

  it("429 when rate-limited (and does not insert)", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 5000 } as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(429);
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("400 on invalid input (missing name/phone)", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req({ name: "", phone: "" }));
    expect(res.status).toBe(400);
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("400 on malformed JSON", async () => {
    const res = await POST(req(null, { badJson: true }));
    expect(res.status).toBe(400);
  });

  it("honeypot: silent 200 without storing when 'website' is filled", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req({ ...valid, website: "http://spam.example" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(s.insert).not.toHaveBeenCalled();
    expect(vi.mocked(notifyRole)).not.toHaveBeenCalled();
  });

  it("500 when the insert fails", async () => {
    const s = svc({ error: { message: "boom" } });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(500);
  });
});
