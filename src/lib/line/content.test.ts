import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadLineContent } from "./content";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "channel-token";
});
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.clearAllMocks();
});

describe("downloadLineContent", () => {
  it("returns not_configured (and never throws) when LINE_CHANNEL_ACCESS_TOKEN is missing", async () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const result = await downloadLineContent("msg-1");
    expect(result).toEqual({ ok: false, error: "not_configured" });
  });

  it("returns missing_message_id for an empty messageId", async () => {
    const result = await downloadLineContent("");
    expect(result).toEqual({ ok: false, error: "missing_message_id" });
  });

  it("fetches the Content API endpoint with Bearer auth and returns the body as a Buffer + content-type", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );

    const result = await downloadLineContent("msg-1");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api-data.line.me/v2/bot/message/msg-1/content");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer channel-token");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(Array.from(result.data)).toEqual([1, 2, 3, 4]);
      expect(result.contentType).toBe("image/jpeg");
    }
  });

  it("URL-encodes the messageId", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array(), { status: 200 }));
    await downloadLineContent("weird/id with space");
    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(
      `https://api-data.line.me/v2/bot/message/${encodeURIComponent("weird/id with space")}/content`,
    );
  });

  it("defaults contentType to application/octet-stream when the response has no content-type header", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([9]), { status: 200 }));
    const result = await downloadLineContent("msg-1");
    expect(result).toEqual({ ok: true, data: Buffer.from([9]), contentType: "application/octet-stream" });
  });

  it("returns ok:false with the http status on a non-2xx response (does not throw)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));
    const result = await downloadLineContent("msg-1");
    expect(result).toEqual({ ok: false, error: "http_404" });
  });

  it("returns ok:false on a network/fetch exception (does not throw)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const result = await downloadLineContent("msg-1");
    expect(result).toEqual({ ok: false, error: "exception" });
  });
});
