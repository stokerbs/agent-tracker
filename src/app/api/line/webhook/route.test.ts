import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

import { POST } from "./route";

const OLD_ENV = { ...process.env };

function sign(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

function req(body: string, signature: string): NextRequest {
  const headers = new Map([["x-line-signature", signature]]);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    text: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.LINE_CHANNEL_SECRET = "shhh";
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "tok";
});
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.clearAllMocks();
});

describe("POST /api/line/webhook", () => {
  it("401 on a bad signature (and does not reply)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const body = JSON.stringify({ events: [] });
    const res = await POST(req(body, "wrong-signature"));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("replies with the sender userId on a valid signed message event", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const body = JSON.stringify({
      events: [{ type: "message", replyToken: "rt1", source: { userId: "Uabc123" } }],
    });
    const res = await POST(req(body, sign("shhh", body)));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.line.me/v2/bot/message/reply");
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload.replyToken).toBe("rt1");
    expect(payload.messages[0].text).toContain("Uabc123");
  });

  it("200 without replying when there are no message events", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const body = JSON.stringify({ events: [{ type: "follow", source: { userId: "U1" } }] });
    const res = await POST(req(body, sign("shhh", body)));
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
