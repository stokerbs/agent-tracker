import { describe, expect, it } from "vitest";
import { isMarketingHost } from "./host";

describe("isMarketingHost", () => {
  it.each([
    ["detectivepulse.com", true],
    ["www.detectivepulse.com", true],
    ["detectivepulse.com:443", true],
    ["DETECTIVEPULSE.COM", true],
    ["detectivepulse.app", false],
    ["localhost:3000", false],
    ["", false],
    [null, false],
    [undefined, false],
    ["detectivepulse.com.evil.com", false],
    ["notdetectivepulse.com", false],
  ])("isMarketingHost(%p) → %p", (host, expected) => {
    expect(isMarketingHost(host as string | null)).toBe(expected);
  });
});
