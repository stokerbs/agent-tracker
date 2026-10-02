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

function svc(insertResult: { error: unknown } = { error: null }, ...more: { error: unknown }[]) {
  const results = [insertResult, ...more];
  const insert = vi.fn().mockImplementation(async () => results.length > 1 ? results.shift()! : results[0]!);
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

const valid = { name: "สมชาย", phone: "0812345678", caseType: "สืบชู้สาว", message: "hi", locale: "th", consent: true };

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
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.leadRef).toMatch(/^TH-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    expect(s.insert).toHaveBeenCalledTimes(1);
    expect(s.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "สมชาย", phone: "0812345678", case_type: "สืบชู้สาว", locale: "th", source: "website", stage: "new", lead_ref: body.leadRef }),
    );
    expect(vi.mocked(notifyRole)).toHaveBeenCalled();
  });

  it("stores a valid email when provided", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req({ ...valid, email: "lead@example.com" }));
    expect(res.status).toBe(200);
    expect(s.insert).toHaveBeenCalledWith(expect.objectContaining({ email: "lead@example.com" }));
  });

  it("stores email as null when omitted", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await POST(req(valid));
    expect(s.insert).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
  });

  it("400 without PDPA consent (and does not insert)", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const { consent, ...noConsent } = valid;
    void consent;
    const res = await POST(req(noConsent));
    expect(res.status).toBe(400);
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("records consent_at when consent is given", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await POST(req(valid));
    expect(s.insert).toHaveBeenCalledWith(expect.objectContaining({ consent_at: expect.any(String) }));
  });

  it("400 on a malformed email (and does not insert)", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req({ ...valid, email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(s.insert).not.toHaveBeenCalled();
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
    // Same shape as a real submission so bots cannot detect the honeypot.
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.leadRef).toMatch(/^TH-/);
    expect(s.insert).not.toHaveBeenCalled();
    expect(vi.mocked(notifyRole)).not.toHaveBeenCalled();
  });


  it("stores first-touch attribution columns when provided", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const attribution = { landing_page: "/นักสืบชู้สาว", referrer: "https://www.google.com/", utm_source: "google", utm_medium: "cpc", utm_campaign: "th-infidelity", utm_term: "สืบชู้", utm_content: "", gclid: "g-123", fbclid: "" };
    const res = await POST(req({ ...valid, attribution }));
    expect(res.status).toBe(200);
    expect(s.insert).toHaveBeenCalledWith(
      expect.objectContaining({ landing_page: "/นักสืบชู้สาว", referrer: "https://www.google.com/", utm_source: "google", utm_medium: "cpc", utm_campaign: "th-infidelity", utm_term: "สืบชู้", utm_content: null, gclid: "g-123", fbclid: null }),
    );
  });

  it("400 when attribution values exceed their bounds", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req({ ...valid, attribution: { gclid: "x".repeat(500) } }));
    expect(res.status).toBe(400);
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("uses an EN- lead ref for English leads", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req({ ...valid, locale: "en" }));
    const body = await res.json();
    expect(body.leadRef).toMatch(/^EN-/);
  });

  it("retries with a new lead_ref on a unique-violation (23505) and then succeeds", async () => {
    const s = svc({ error: { code: "23505", message: "dup" } }, { error: null });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    expect(s.insert).toHaveBeenCalledTimes(2);
    const refs = s.insert.mock.calls.map((c) => (c[0] as { lead_ref: string }).lead_ref);
    expect(refs[0]).not.toBe(refs[1]);
  });

  it("500 when the insert fails", async () => {
    const s = svc({ error: { message: "boom" } });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(500);
  });
});
