import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

vi.mock("@/lib/line/router", () => ({ handleLineMessage: vi.fn() }));

import { POST } from "./route";
import { handleLineMessage } from "@/lib/line/router";

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
  it("401 on a bad signature (and does not dispatch)", async () => {
    const body = JSON.stringify({ events: [] });
    const res = await POST(req(body, "wrong-signature"));
    expect(res.status).toBe(401);
    expect(handleLineMessage).not.toHaveBeenCalled();
  });

  it("dispatches a valid signed text-message event to the router with userId/text/replyToken", async () => {
    const body = JSON.stringify({
      events: [
        { type: "message", replyToken: "rt1", source: { userId: "Uabc123" }, message: { type: "text", text: "hello" } },
      ],
    });
    const res = await POST(req(body, sign("shhh", body)));
    expect(res.status).toBe(200);
    expect(handleLineMessage).toHaveBeenCalledTimes(1);
    expect(handleLineMessage).toHaveBeenCalledWith("Uabc123", "hello", "rt1");
  });

  it("200 without dispatching when there are no message events", async () => {
    const body = JSON.stringify({ events: [{ type: "follow", source: { userId: "U1" } }] });
    const res = await POST(req(body, sign("shhh", body)));
    expect(res.status).toBe(200);
    expect(handleLineMessage).not.toHaveBeenCalled();
  });

  it("does not dispatch non-text message events (e.g. sticker/image/location)", async () => {
    const body = JSON.stringify({
      events: [
        { type: "message", replyToken: "rt1", source: { userId: "Uabc123" }, message: { type: "sticker" } },
      ],
    });
    const res = await POST(req(body, sign("shhh", body)));
    expect(res.status).toBe(200);
    expect(handleLineMessage).not.toHaveBeenCalled();
  });

  it("200 and does not throw when the router dispatch itself rejects", async () => {
    vi.mocked(handleLineMessage).mockRejectedValueOnce(new Error("boom"));
    const body = JSON.stringify({
      events: [
        { type: "message", replyToken: "rt1", source: { userId: "Uabc123" }, message: { type: "text", text: "hi" } },
      ],
    });
    const res = await POST(req(body, sign("shhh", body)));
    expect(res.status).toBe(200);
  });
});
