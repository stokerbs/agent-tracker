import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => { void fn(); },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyRole: vi.fn(), notificationLinks: { partners: () => "/partners" } }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

import { POST } from "./route";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyRole } from "@/lib/notifications";
import { REFERRAL_SLUG_PATTERN } from "@/lib/marketing/zh/partner-schema";

function svc(errors: ({ code: string; message: string } | null)[] = [null]) {
  const queue = [...errors];
  const insert = vi.fn().mockImplementation(async () => ({ error: queue.shift() ?? null }));
  return { client: { from: () => ({ insert }) }, insert };
}
function req(body: unknown, { ip = "1.2.3.4", badJson = false } = {}): NextRequest {
  const headers = new Map([["x-forwarded-for", ip], ["user-agent", "ua"]]);
  return { headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null }, json: async () => { if (badJson) throw new Error("bad"); return body; } } as unknown as NextRequest;
}
const valid = { orgName: "Siam Legal", partnerType: "law_firm", contactName: "李", wechatId: "siam", country: "thailand", services: ["due_diligence"], expectedVolume: "occasional", consent: true };

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 4, retryAfterMs: 0 } as never);
  vi.mocked(createServiceClient).mockReturnValue(svc().client as never);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/marketing/partner", () => {
  it("inserts with a referral slug and notifies admins; slug is not returned", async () => {
    const s = svc(); vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    const row = s.insert.mock.calls[0]![0];
    expect(row).toMatchObject({ org_name: "Siam Legal", partner_type: "law_firm", wechat_id: "siam", email: null, services: ["due_diligence"], stage: "new", source: "website", locale: "zh" });
    expect(row.referral_slug).toMatch(REFERRAL_SLUG_PATTERN);
    expect(vi.mocked(notifyRole)).toHaveBeenCalledWith(["admin"], expect.objectContaining({ url: "/partners" }));
  });
  it("429 when rate-limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 30_000 } as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
  });
  it("honeypot → fake success, nothing stored, even with garbage fields", async () => {
    const s = svc(); vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req({ website: "spam" }));
    expect(res.status).toBe(200);
    expect(s.insert).not.toHaveBeenCalled();
    expect(vi.mocked(notifyRole)).not.toHaveBeenCalled();
  });
  it("400 on bad json / invalid input / no contact channel", async () => {
    expect((await POST(req(null, { badJson: true }))).status).toBe(400);
    expect((await POST(req({ ...valid, services: [] }))).status).toBe(400);
    expect((await POST(req({ ...valid, wechatId: "" }))).status).toBe(400);
  });
  it("retries the slug on a unique violation, 500 after three", async () => {
    const dup = { code: "23505", message: "dup" };
    const s = svc([dup, null]); vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    expect((await POST(req(valid))).status).toBe(200);
    expect(s.insert).toHaveBeenCalledTimes(2);
    const s2 = svc([dup, dup, dup]); vi.mocked(createServiceClient).mockReturnValue(s2.client as never);
    expect((await POST(req(valid))).status).toBe(500);
  });
});
