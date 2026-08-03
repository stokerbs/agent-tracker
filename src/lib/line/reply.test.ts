import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

import { replyLineMessage, replyLineMessages } from "./reply";
import { reportError } from "@/lib/errors";

const REPLY_TOKEN = "rt-123";
const ORIGINAL_ENV = process.env.LINE_CHANNEL_ACCESS_TOKEN;

function mockFetchOk() {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    text: async () => "",
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Parses the JSON body sent on the given fetch mock call, requiring `init`
 * (the second fetch() argument) to be present — every call under test here
 * always passes one, so a missing `init` is itself a test failure worth
 * surfacing rather than silently coercing away. */
function requestBody(fetchMock: ReturnType<typeof mockFetchOk>, callIndex = 0): { replyToken: string; messages: unknown[] } {
  const call = fetchMock.mock.calls[callIndex];
  if (!call) throw new Error(`fetch was not called (index ${callIndex})`);
  const [, init] = call;
  if (!init?.body) throw new Error("fetch was called without a request body");
  return JSON.parse(init.body as string);
}

beforeEach(() => {
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
});

afterEach(() => {
  process.env.LINE_CHANNEL_ACCESS_TOKEN = ORIGINAL_ENV;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("replyLineMessages", () => {
  it("sends a mix of text and image messages in a single reply call, preserving order and shape", async () => {
    const fetchMock = mockFetchOk();

    await replyLineMessages(REPLY_TOKEN, [
      { type: "text", text: "สรุปข่าวกรอง" },
      {
        type: "image",
        originalContentUrl: "https://example.com/photo1-orig.jpg",
        previewImageUrl: "https://example.com/photo1-preview.jpg",
      },
      {
        type: "image",
        originalContentUrl: "https://example.com/photo2-orig.jpg",
        previewImageUrl: "https://example.com/photo2-preview.jpg",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.line.me/v2/bot/message/reply");
    expect(init?.headers).toMatchObject({ authorization: "Bearer test-token" });

    const body = requestBody(fetchMock);
    expect(body.replyToken).toBe(REPLY_TOKEN);
    expect(body.messages).toEqual([
      { type: "text", text: "สรุปข่าวกรอง" },
      {
        type: "image",
        originalContentUrl: "https://example.com/photo1-orig.jpg",
        previewImageUrl: "https://example.com/photo1-preview.jpg",
      },
      {
        type: "image",
        originalContentUrl: "https://example.com/photo2-orig.jpg",
        previewImageUrl: "https://example.com/photo2-preview.jpg",
      },
    ]);
  });

  it("truncates to LINE's 5-message limit and logs a warning, rather than sending 6+ or dropping the whole reply", async () => {
    const fetchMock = mockFetchOk();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const messages = Array.from({ length: 7 }, (_, i) => ({
      type: "text" as const,
      text: `msg-${i}`,
    }));

    await replyLineMessages(REPLY_TOKEN, messages);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = requestBody(fetchMock);
    expect(body.messages).toHaveLength(5);
    expect(body.messages).toEqual([
      { type: "text", text: "msg-0" },
      { type: "text", text: "msg-1" },
      { type: "text", text: "msg-2" },
      { type: "text", text: "msg-3" },
      { type: "text", text: "msg-4" },
    ]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("truncates each text message to LINE's ~5000 char cap", async () => {
    const fetchMock = mockFetchOk();
    const longText = "a".repeat(6000);

    await replyLineMessages(REPLY_TOKEN, [{ type: "text", text: longText }]);

    const body = requestBody(fetchMock);
    expect((body.messages[0] as { text: string }).text.length).toBe(4900);
  });

  it("no-ops silently when LINE_CHANNEL_ACCESS_TOKEN is not configured", async () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const fetchMock = mockFetchOk();

    await replyLineMessages(REPLY_TOKEN, [{ type: "text", text: "hi" }]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops silently when replyToken is empty", async () => {
    const fetchMock = mockFetchOk();
    await replyLineMessages("", [{ type: "text", text: "hi" }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops silently when messages is empty", async () => {
    const fetchMock = mockFetchOk();
    await replyLineMessages(REPLY_TOKEN, []);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs (but does not throw) on a non-ok LINE API response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "server error",
    }));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      replyLineMessages(REPLY_TOKEN, [{ type: "text", text: "hi" }]),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("reports (but does not throw) on a fetch/network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(
      replyLineMessages(REPLY_TOKEN, [{ type: "text", text: "hi" }]),
    ).resolves.toBeUndefined();

    expect(reportError).toHaveBeenCalledWith(expect.any(Error), "line:reply");
  });
});

describe("replyLineMessage (existing single-text-message behavior, unchanged)", () => {
  it("sends exactly one text message via the same LINE reply endpoint", async () => {
    const fetchMock = mockFetchOk();

    await replyLineMessage(REPLY_TOKEN, "hello");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.line.me/v2/bot/message/reply");
    const body = requestBody(fetchMock);
    expect(body).toEqual({ replyToken: REPLY_TOKEN, messages: [{ type: "text", text: "hello" }] });
  });

  it("truncates text to the ~5000 char cap", async () => {
    const fetchMock = mockFetchOk();
    await replyLineMessage(REPLY_TOKEN, "b".repeat(6000));
    const body = requestBody(fetchMock);
    expect((body.messages[0] as { text: string }).text.length).toBe(4900);
  });

  it("no-ops silently when LINE_CHANNEL_ACCESS_TOKEN is not configured", async () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const fetchMock = mockFetchOk();
    await replyLineMessage(REPLY_TOKEN, "hello");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops silently when replyToken is empty", async () => {
    const fetchMock = mockFetchOk();
    await replyLineMessage("", "hello");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
