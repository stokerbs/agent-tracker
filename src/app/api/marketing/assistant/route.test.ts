import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { POST } from "./route";
import { checkRateLimit } from "@/lib/rate-limit";

function req(body: unknown, { ip = "1.2.3.4", badJson = false } = {}): NextRequest {
  const headers = new Map([["x-forwarded-for", ip]]);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => {
      if (badJson) throw new Error("bad json");
      return body;
    },
  } as unknown as NextRequest;
}

const valid = { messages: [{ role: "user", content: "ค่าบริการเท่าไหร่" }], locale: "th" };

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 29, retryAfterMs: 0 } as never);
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
    const res = await POST(req(null, { badJson: true }));
    expect(res.status).toBe(400);
  });

  it("400 on invalid input (empty messages)", async () => {
    const res = await POST(req({ messages: [], locale: "th" }));
    expect(res.status).toBe(400);
  });

  it("400 when a message exceeds the length cap", async () => {
    const res = await POST(req({ messages: [{ role: "user", content: "x".repeat(2001) }], locale: "th" }));
    expect(res.status).toBe(400);
  });

  it("400 when there are too many messages", async () => {
    const messages = Array.from({ length: 21 }, () => ({ role: "user", content: "hi" }));
    const res = await POST(req({ messages, locale: "th" }));
    expect(res.status).toBe(400);
  });

  it("returns a graceful fallback (200) when no API key is configured", async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; reply: string };
    expect(json.ok).toBe(true);
    expect(json.reply).toContain("@detectivepluse");
  });

  it("returns the model reply when Anthropic responds", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ content: [{ text: "ราคาขึ้นกับลักษณะงานครับ" }] }), { status: 200 }),
    );
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { reply: string };
    expect(json.reply).toBe("ราคาขึ้นกับลักษณะงานครับ");
  });

  it("falls back gracefully (200) when Anthropic errors", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { reply: string };
    expect(json.reply).toContain("@detectivepluse");
  });
});
