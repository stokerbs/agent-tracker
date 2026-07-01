import { describe, expect, it } from "vitest";
import { buildCsp, CSP_BASE, CSP_MARKETING_EXTRA, MARKETING_HOST } from "./csp";

describe("buildCsp", () => {
  it("the default (app) policy matches the known-good base CSP exactly", () => {
    const csp = buildCsp();
    for (const [key, values] of Object.entries(CSP_BASE)) {
      expect(csp).toContain(`${key} ${values.join(" ")}`);
    }
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    // No marketing/GTM hosts leak into the default policy.
    expect(csp).not.toContain("googletagmanager.com");
    expect(csp).not.toContain("facebook.com");
  });

  it("the marketing policy allows GTM/GA4/Ads/Pixel hosts", () => {
    const csp = buildCsp(CSP_MARKETING_EXTRA);
    expect(csp).toMatch(/script-src[^;]*https:\/\/www\.googletagmanager\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/www\.google-analytics\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/connect\.facebook\.net/);
  });

  it("the marketing policy overrides (not appends to) frame-src", () => {
    const csp = buildCsp(CSP_MARKETING_EXTRA);
    expect(csp).toContain("frame-src https://www.googletagmanager.com");
    expect(csp).not.toContain("frame-src 'none'");
  });

  it("the marketing policy still carries every base directive untouched otherwise", () => {
    const csp = buildCsp(CSP_MARKETING_EXTRA);
    expect(csp).toContain(`style-src ${CSP_BASE["style-src"]!.join(" ")}`);
    expect(csp).toContain(`font-src ${CSP_BASE["font-src"]!.join(" ")}`);
    expect(csp).toContain(`object-src ${CSP_BASE["object-src"]!.join(" ")}`);
  });

  it("MARKETING_HOST matches detectivepulse.com (with/without www) and rejects a spoofed suffix", () => {
    const re = new RegExp(`^${MARKETING_HOST}$`);
    expect(re.test("detectivepulse.com")).toBe(true);
    expect(re.test("www.detectivepulse.com")).toBe(true);
    expect(re.test("detectivepulse.com.evil.com")).toBe(false);
  });
});
