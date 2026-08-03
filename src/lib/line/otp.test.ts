import { describe, expect, it } from "vitest";
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  isOtpExpired,
  canRequestNewOtp,
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
} from "./otp";

describe("generateOtp", () => {
  it("generates a zero-padded numeric string of OTP_LENGTH digits", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtp();
      expect(code).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));
    }
  });
});

describe("hashOtp / verifyOtpHash", () => {
  it("never stores/compares the raw code — hash differs from input", () => {
    const hash = hashOtp("123456");
    expect(hash).not.toBe("123456");
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("verifies a matching code against its own hash", () => {
    const hash = hashOtp("042817");
    expect(verifyOtpHash("042817", hash)).toBe(true);
  });

  it("rejects a non-matching code", () => {
    const hash = hashOtp("042817");
    expect(verifyOtpHash("000000", hash)).toBe(false);
  });

  it("rejects safely when lengths differ (no throw)", () => {
    const hash = hashOtp("042817");
    expect(verifyOtpHash("1", hash)).toBe(false);
  });
});

describe("isOtpExpired", () => {
  it("treats null/undefined as expired", () => {
    expect(isOtpExpired(null)).toBe(true);
    expect(isOtpExpired(undefined)).toBe(true);
  });

  it("treats a future timestamp as not expired", () => {
    const future = new Date(Date.now() + OTP_TTL_MS).toISOString();
    expect(isOtpExpired(future)).toBe(false);
  });

  it("treats a past timestamp as expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isOtpExpired(past)).toBe(true);
  });
});

describe("canRequestNewOtp", () => {
  it("allows a first request (null/undefined requestedAt)", () => {
    expect(canRequestNewOtp(null)).toBe(true);
    expect(canRequestNewOtp(undefined)).toBe(true);
  });

  it("blocks a resend within the cooldown window", () => {
    const justNow = new Date(Date.now() - 1000).toISOString();
    expect(canRequestNewOtp(justNow)).toBe(false);
  });

  it("allows a resend once the cooldown has elapsed", () => {
    const longAgo = new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1000).toISOString();
    expect(canRequestNewOtp(longAgo)).toBe(true);
  });
});
