import { describe, expect, it } from "vitest";
import { isMarketingHost } from "./host";

describe("isMarketingHost", () => {
  it.each([
    ["detectivepulse.com", true],
    ["www.detectivepulse.com", true],
    ["detectivepulse.com:3000", true],
    ["www.detectivepulse.com:443", true],
    ["DetectivePulse.COM", true],
    ["detectivepulse.app", false],
    ["www.detectivepulse.app", false],
    ["agent-tracker-xxxx.vercel.app", false],
    ["localhost:3000", false],
    ["", false],
    [null, false],
    [undefined, false],
    // spoof attempts that startsWith would have wrongly allowed:
    ["detectivepulse.com.evil.com", false],
    ["detectivepulse.com.attacker.test", false],
    ["notdetectivepulse.com", false],
  ])("isMarketingHost(%p) → %p", (host, expected) => {
    expect(isMarketingHost(host as string | null)).toBe(expected);
  });
});
