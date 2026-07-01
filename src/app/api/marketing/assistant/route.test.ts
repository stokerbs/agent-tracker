import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

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

function req(body: unknown, { ip = "1.2.3.4", badJson = false } = {}): NextRequest {
  const headers = new Map([["x-forwarded-for", ip], ["user-agent", "test-ua"]]);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => {
      if (badJson) throw new Error("bad json");
      return body;
    },
  } as unknown as NextRequest;
}

/** Mock an Anthropic /v1/messages response with the given content blocks. */
function anthropic(content: unknown[]) {
  return new Response(JSON.stringify({ content }), { status: 200 });
}

const valid = { messages: [{ role: "user", content: "ค่าบริการเท่าไหร่" }], locale: "th" };

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 29, retryAfterMs: 0 } as never);
  vi.mocked(createServiceClient).mockReturnValue(svc().client as never);
  delete process.env.ANTHROPIC_API_KEY;
  vi.restoreAllMocks();
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/marketing/assistant", () => {
  it("429 when rate-limited (and never calls Anthropic)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 5000 } as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("400 on malformed JSON", async () => {
    expect((await POST(req(null, { badJson: true }))).status).toBe(400);
  });

  it("400 on invalid input (empty messages)", async () => {
    expect((await POST(req({ messages: [], locale: "th" }))).status).toBe(400);
  });

  it("400 when a message exceeds the length cap", async () => {
    const res = await POST(req({ messages: [{ role: "user", content: "x".repeat(2001) }], locale: "th" }));
    expect(res.status).toBe(400);
  });

  it("400 when there are too many messages", async () => {
    const messages = Array.from({ length: 21 }, () => ({ role: "user", content: "hi" }));
    expect((await POST(req({ messages, locale: "th" }))).status).toBe(400);
  });

  it("graceful fallback (200) when no API key is configured", async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { reply: string };
    expect(json.reply).toContain("@detectivepluse");
  });

  it("returns the model text reply when Anthropic responds", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      anthropic([{ type: "text", text: "ราคาขึ้นกับลักษณะงานครับ" }]),
    );
    const res = await POST(req(valid));
    const json = (await res.json()) as { reply: string };
    expect(json.reply).toBe("ราคาขึ้นกับลักษณะงานครับ");
  });

  it("falls back gracefully (200) when Anthropic errors", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    const json = (await (await POST(req(valid))).json()) as { reply: string };
    expect(json.reply).toContain("@detectivepluse");
  });

  it("submit_case tool → stores a lead (source assistant) and notifies admins", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      anthropic([
        { type: "text", text: "รับเรื่องแล้วครับ" },
        {
          type: "tool_use",
          name: "submit_case",
          input: {
            service_type: "สืบชู้สาว",
            customer_contact: "0812345678",
            customer_name: "คุณเอ",
            summary: "พื้นที่ กทม. · เย็นวันศุกร์ · มีรูป+ทะเบียน",
            consent: true,
          },
        },
      ]),
    );
    const res = await POST(req(valid));
    const json = (await res.json()) as { reply: string; submitted?: boolean };
    expect(json.submitted).toBe(true);
    expect(s.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "คุณเอ",
        phone: "0812345678",
        case_type: "สืบชู้สาว",
        source: "assistant",
        consent_at: expect.any(String),
      }),
    );
    expect(vi.mocked(notifyRole)).toHaveBeenCalled();
  });

  it("submit_case WITHOUT consent → does not store and asks for consent", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      anthropic([
        {
          type: "tool_use",
          name: "submit_case",
          input: { service_type: "สืบชู้สาว", customer_contact: "0812345678", summary: "x", consent: false },
        },
      ]),
    );
    const res = await POST(req(valid));
    const json = (await res.json()) as { reply: string; submitted?: boolean };
    expect(json.submitted).toBeUndefined();
    expect(s.insert).not.toHaveBeenCalled();
    expect(vi.mocked(notifyRole)).not.toHaveBeenCalled();
  });
});
