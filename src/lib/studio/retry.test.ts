import { describe, expect, it } from "vitest";
import { computeDelay, isTransientError, retryResult, withRetry } from "./retry";

describe("isTransientError", () => {
  const cases: [string, unknown, boolean][] = [
    ["undici fetch failed", new TypeError("fetch failed"), true],
    ["fetch failed with a reset cause", Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }), true],
    ["anthropic connection error", new Error("Connection error."), true],
    ["settings loader wrapping a network failure", new Error("studio settings unavailable: TypeError: fetch failed"), true],
    ["supabase error object", { message: "TypeError: fetch failed", code: "" }, true],
    ["dns failure", new Error("getaddrinfo ENOTFOUND api.anthropic.com"), true],
    ["rate limited", { status: 429, message: "rate_limit_error" }, true],
    ["overloaded", { status: 529, message: "overloaded_error" }, true],
    ["bad gateway", { status: 502, message: "Bad Gateway" }, true],
    ["credit balance", { status: 400, message: "Your credit balance is too low to access the Anthropic API." }, false],
    ["auth", { status: 401, message: "authentication_error" }, false],
    ["truncated model output", new Error("Failed to parse structured output: Unterminated string in JSON"), false],
    ["unique violation", { code: "23505", message: "duplicate key value violates unique constraint" }, false],
    ["permission", new Error("studio settings unavailable: permission denied for table studio_settings"), false],
    ["nothing", null, false],
  ];
  it.each(cases)("%s", (label, err, expected) => {
    expect(isTransientError(err), label).toBe(expected);
  });
  it("retries timeouts only when the caller says the operation is safe to repeat", () => {
    const timeout = new Error("Request timed out.");
    expect(isTransientError(timeout)).toBe(false);
    expect(isTransientError(timeout, { allowTimeouts: true })).toBe(true);
    // a connect timeout never reached the server, so it is always safe
    expect(isTransientError(new Error("UND_ERR_CONNECT_TIMEOUT"))).toBe(true);
  });
});

describe("computeDelay", () => {
  it("doubles per attempt, caps at the maximum and keeps jitter within 20 %", () => {
    const p = { attempts: 9, baseDelayMs: 1_000, maxDelayMs: 5_000 };
    expect(computeDelay(p, 1, () => 0.5)).toBe(1_000);
    expect(computeDelay(p, 3, () => 0.5)).toBe(4_000);
    expect(computeDelay(p, 6, () => 0.5)).toBe(5_000);
    expect(computeDelay(p, 1, () => 0)).toBe(800);
    expect(computeDelay(p, 1, () => 1)).toBe(1_200);
    expect(computeDelay(p, 9, () => 1)).toBe(5_000);
  });
});

describe("withRetry", () => {
  it("retries transient failures with growing delays, then returns the value", async () => {
    const delays: number[] = [];
    let calls = 0;
    let retries = 0;
    const out = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new TypeError("fetch failed");
        return "ok";
      },
      { policy: { attempts: 5, baseDelayMs: 100, maxDelayMs: 10_000 }, sleep: async (ms) => void delays.push(ms), onRetry: () => void (retries += 1), random: () => 0.5 },
    );
    expect(out).toBe("ok");
    expect(calls).toBe(3);
    expect(delays).toEqual([100, 200]);
    expect(retries).toBe(2);
  });
  it("does not retry a permanent failure", async () => {
    const delays: number[] = [];
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error("Your credit balance is too low");
        },
        { policy: { attempts: 5 }, sleep: async (ms) => void delays.push(ms) },
      ),
    ).rejects.toThrow(/credit balance/);
    expect(calls).toBe(1);
    expect(delays).toEqual([]);
  });
  it("gives up after the configured attempts and rethrows the last error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new TypeError(`fetch failed #${calls}`);
        },
        { policy: { attempts: 3 }, sleep: async () => {} },
      ),
    ).rejects.toThrow("fetch failed #3");
    expect(calls).toBe(3);
  });
});

describe("retryResult", () => {
  it("retries result-style errors and returns the first success", async () => {
    const delays: number[] = [];
    let calls = 0;
    const r = await retryResult(
      async () => {
        calls += 1;
        return calls < 2 ? { data: null as number[] | null, error: { message: "TypeError: fetch failed" } as { message: string } | null } : { data: [1], error: null };
      },
      { policy: { attempts: 4, baseDelayMs: 10 }, sleep: async (ms) => void delays.push(ms), random: () => 0.5 },
    );
    expect(r).toEqual({ data: [1], error: null });
    expect(delays).toEqual([10]);
  });
  it("returns a permanent error result straight away", async () => {
    let calls = 0;
    const r = await retryResult(
      async () => {
        calls += 1;
        return { data: null, error: { message: "permission denied for table studio_settings" } };
      },
      { policy: { attempts: 4 }, sleep: async () => {} },
    );
    expect(r.error?.message).toMatch(/permission denied/);
    expect(calls).toBe(1);
  });
});
