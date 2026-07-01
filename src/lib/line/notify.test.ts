import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

import { pushLineNotify } from "./notify";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
  delete process.env.LINE_NOTIFY_USER_ID;
});
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.clearAllMocks();
});

describe("pushLineNotify", () => {
  it("no-ops (no fetch) when env is not configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await pushLineNotify("hi");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no-ops when token set but no recipient", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "tok";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await pushLineNotify("hi");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("pushes to each recipient with the bearer token", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "tok";
    process.env.LINE_NOTIFY_USER_ID = "U111, U222";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await pushLineNotify("new lead");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.line.me/v2/bot/message/push");
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer tok" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.to).toBe("U111");
    expect(body.messages[0].text).toBe("new lead");
  });

  it("never throws when fetch rejects", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "tok";
    process.env.LINE_NOTIFY_USER_ID = "U111";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    await expect(pushLineNotify("x")).resolves.toBeUndefined();
  });
});
