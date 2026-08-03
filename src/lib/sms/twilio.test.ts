import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendSms } from "./twilio";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.TWILIO_ACCOUNT_SID = "ACxxxx";
  process.env.TWILIO_AUTH_TOKEN = "secret-token";
  process.env.TWILIO_FROM_NUMBER = "+15555550123";
});
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.clearAllMocks();
});

describe("sendSms", () => {
  it("returns not_configured (and never throws) when Twilio env vars are missing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const result = await sendSms("+66812345678", "your code is 123456");
    expect(result).toEqual({ ok: false, error: "not_configured" });
  });

  it("posts to the Twilio Messages REST endpoint with Basic auth and form-encoded body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 201 }));
    const result = await sendSms("+66812345678", "your code is 123456");
    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACxxxx/Messages.json");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from("ACxxxx:secret-token").toString("base64")}`);
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get("To")).toBe("+66812345678");
    expect(body.get("From")).toBe("+15555550123");
    expect(body.get("Body")).toBe("your code is 123456");
  });

  it("returns ok:false with the http status on a non-2xx response (does not throw)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad request", { status: 400 }));
    const result = await sendSms("+66812345678", "code");
    expect(result).toEqual({ ok: false, error: "http_400" });
  });

  it("returns ok:false on a network/fetch exception (does not throw)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const result = await sendSms("+66812345678", "code");
    expect(result).toEqual({ ok: false, error: "exception" });
  });

  it("never logs the message body (which may contain the raw OTP) or the auth token", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("server error", { status: 500 }));
    await sendSms("+66812345678", "รหัส OTP ของคุณคือ 999888");
    const lines = errorSpy.mock.calls.flat().map((a) => (typeof a === "string" ? a : JSON.stringify(a)));
    for (const line of lines) {
      expect(line).not.toContain("999888");
      expect(line).not.toContain("secret-token");
    }
    errorSpy.mockRestore();
  });
});
