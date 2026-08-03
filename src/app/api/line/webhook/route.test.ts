import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

vi.mock("@/lib/line/router", () => ({ handleLineMessage: vi.fn(), handleLineMediaMessage: vi.fn() }));

import { POST } from "./route";
import { handleLineMessage, handleLineMediaMessage } from "@/lib/line/router";

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

  it("401 (fails CLOSED) when LINE_CHANNEL_SECRET is not configured — even with a well-formed body/signature-shaped header", async () => {
    delete process.env.LINE_CHANNEL_SECRET;
    // An unconfigured secret must be rejected outright, never treated as
    // "skip verification" — this gates OTP-triggering SMS sends and
    // case/timeline PII reads.
    const body = JSON.stringify({
      events: [
        { type: "message", replyToken: "rt1", source: { userId: "Uabc123" }, message: { type: "text", text: "hello" } },
      ],
    });
    const res = await POST(req(body, "anything"));
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

  it("does not dispatch a sticker message event (still ignored)", async () => {
    const body = JSON.stringify({
      events: [
        { type: "message", replyToken: "rt1", source: { userId: "Uabc123" }, message: { type: "sticker" } },
      ],
    });
    const res = await POST(req(body, sign("shhh", body)));
    expect(res.status).toBe(200);
    expect(handleLineMessage).not.toHaveBeenCalled();
    expect(handleLineMediaMessage).not.toHaveBeenCalled();
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

  describe("image/location message events (Round 3)", () => {
    it("dispatches a valid signed image-message event to handleLineMediaMessage with { type: 'image', messageId }", async () => {
      const body = JSON.stringify({
        events: [
          {
            type: "message",
            replyToken: "rt1",
            source: { userId: "Uabc123" },
            message: { type: "image", id: "msg-id-1" },
          },
        ],
      });
      const res = await POST(req(body, sign("shhh", body)));
      expect(res.status).toBe(200);
      expect(handleLineMessage).not.toHaveBeenCalled();
      expect(handleLineMediaMessage).toHaveBeenCalledTimes(1);
      expect(handleLineMediaMessage).toHaveBeenCalledWith(
        "Uabc123",
        { type: "image", messageId: "msg-id-1" },
        "rt1",
      );
    });

    it("does not dispatch an image-message event missing message.id", async () => {
      const body = JSON.stringify({
        events: [
          { type: "message", replyToken: "rt1", source: { userId: "Uabc123" }, message: { type: "image" } },
        ],
      });
      const res = await POST(req(body, sign("shhh", body)));
      expect(res.status).toBe(200);
      expect(handleLineMediaMessage).not.toHaveBeenCalled();
    });

    it("dispatches a valid signed location-message event to handleLineMediaMessage with lat/lng + address", async () => {
      const body = JSON.stringify({
        events: [
          {
            type: "message",
            replyToken: "rt1",
            source: { userId: "Uabc123" },
            message: { type: "location", address: "123 Main St", latitude: 13.75, longitude: 100.5 },
          },
        ],
      });
      const res = await POST(req(body, sign("shhh", body)));
      expect(res.status).toBe(200);
      expect(handleLineMediaMessage).toHaveBeenCalledWith(
        "Uabc123",
        { type: "location", latitude: 13.75, longitude: 100.5, address: "123 Main St" },
        "rt1",
      );
    });

    it("falls back to title when address is absent on a location-message event", async () => {
      const body = JSON.stringify({
        events: [
          {
            type: "message",
            replyToken: "rt1",
            source: { userId: "Uabc123" },
            message: { type: "location", title: "Home", latitude: 13.75, longitude: 100.5 },
          },
        ],
      });
      const res = await POST(req(body, sign("shhh", body)));
      expect(res.status).toBe(200);
      expect(handleLineMediaMessage).toHaveBeenCalledWith(
        "Uabc123",
        { type: "location", latitude: 13.75, longitude: 100.5, address: "Home" },
        "rt1",
      );
    });

    it("passes null address when neither address nor title is present on a location-message event", async () => {
      const body = JSON.stringify({
        events: [
          {
            type: "message",
            replyToken: "rt1",
            source: { userId: "Uabc123" },
            message: { type: "location", latitude: 13.75, longitude: 100.5 },
          },
        ],
      });
      const res = await POST(req(body, sign("shhh", body)));
      expect(res.status).toBe(200);
      expect(handleLineMediaMessage).toHaveBeenCalledWith(
        "Uabc123",
        { type: "location", latitude: 13.75, longitude: 100.5, address: null },
        "rt1",
      );
    });

    it("does not dispatch a location-message event with a non-numeric latitude/longitude", async () => {
      const body = JSON.stringify({
        events: [
          {
            type: "message",
            replyToken: "rt1",
            source: { userId: "Uabc123" },
            message: { type: "location", latitude: "13.75", longitude: 100.5 },
          },
        ],
      });
      const res = await POST(req(body, sign("shhh", body)));
      expect(res.status).toBe(200);
      expect(handleLineMediaMessage).not.toHaveBeenCalled();
    });

    it("200 and does not throw when handleLineMediaMessage rejects", async () => {
      vi.mocked(handleLineMediaMessage).mockRejectedValueOnce(new Error("boom"));
      const body = JSON.stringify({
        events: [
          {
            type: "message",
            replyToken: "rt1",
            source: { userId: "Uabc123" },
            message: { type: "image", id: "msg-id-1" },
          },
        ],
      });
      const res = await POST(req(body, sign("shhh", body)));
      expect(res.status).toBe(200);
    });
  });
});
