import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Fake timers: control Date.now() for window math and avoid the real sweep
// setTimeout keeping the process alive. Unique identifiers per test keep the
// module-level store from leaking state across cases.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-28T00:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows the first hit and decrements remaining", () => {
    const r = checkRateLimit("gps", "user-first");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(RATE_LIMITS.gps.limit - 1);
    expect(r.retryAfterMs).toBe(0);
  });

  it("allows exactly `limit` hits, then denies the next", () => {
    const id = "user-burst";
    const { limit } = RATE_LIMITS.otp; // 3
    for (let i = 0; i < limit; i++) {
      expect(checkRateLimit("otp", id).allowed).toBe(true);
    }
    const denied = checkRateLimit("otp", id);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("frees a slot once the window has elapsed", () => {
    const id = "user-window";
    const { limit, windowMs } = RATE_LIMITS.otp;
    for (let i = 0; i < limit; i++) checkRateLimit("otp", id);
    expect(checkRateLimit("otp", id).allowed).toBe(false);

    // Advance just past the window — the oldest hits expire.
    vi.advanceTimersByTime(windowMs + 1);
    expect(checkRateLimit("otp", id).allowed).toBe(true);
  });

  it("tracks identifiers independently", () => {
    const { limit } = RATE_LIMITS.otp;
    for (let i = 0; i < limit; i++) checkRateLimit("otp", "user-a");
    expect(checkRateLimit("otp", "user-a").allowed).toBe(false);
    // A different identifier has its own fresh budget.
    expect(checkRateLimit("otp", "user-b").allowed).toBe(true);
  });

  it("tracks buckets independently for the same identifier", () => {
    const { limit } = RATE_LIMITS.otp;
    for (let i = 0; i < limit; i++) checkRateLimit("otp", "shared-id");
    expect(checkRateLimit("otp", "shared-id").allowed).toBe(false);
    // Same id, different bucket — independent budget.
    expect(checkRateLimit("login", "shared-id").allowed).toBe(true);
  });
});
