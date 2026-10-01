import { describe, it, expect } from "vitest";
import { generateLeadRef, LEAD_REF_PATTERN } from "./lead-ref";

describe("generateLeadRef", () => {
  it("produces CN-YYMMDD-XXXX from the UTC date", () => {
    const ref = generateLeadRef(new Date("2026-10-01T23:59:00Z"), () => 0);
    expect(ref).toBe("CN-261001-2222");
    expect(LEAD_REF_PATTERN.test(ref)).toBe(true);
  });

  it("never uses ambiguous characters (0, O, 1, I)", () => {
    for (let i = 0; i < 500; i++) {
      const tail = generateLeadRef().slice(-4);
      expect(tail).not.toMatch(/[01OI]/);
    }
  });

  it("uses the full alphabet range at the top end", () => {
    expect(generateLeadRef(new Date("2026-01-05T00:00:00Z"), () => 0.999999)).toBe("CN-260105-ZZZZ");
  });
});
