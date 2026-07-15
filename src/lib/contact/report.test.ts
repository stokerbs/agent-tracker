import { describe, it, expect } from "vitest";
import { buildContactFactSheet, normalizeContactReport } from "./report";
import type { PhoneInfo } from "./types";

const phone: PhoneInfo = {
  valid: true,
  possible: true,
  e164: "+66812345678",
  national: "081 234 5678",
  international: "+66 81 234 5678",
  country: "TH",
  countryCallingCode: "+66",
  lineType: "mobile",
};

describe("buildContactFactSheet", () => {
  it("includes the identifier and phone facts", () => {
    const s = buildContactFactSheet({ inputType: "phone", inputDisplay: "+66812345678", phone });
    expect(s).toContain("type: phone");
    expect(s).toContain("+66812345678");
    expect(s).toContain("line_type: mobile");
    expect(s).toContain("country: TH");
  });

  it("omits the phone block for non-phone identifiers", () => {
    const s = buildContactFactSheet({ inputType: "email", inputDisplay: "a@b.com", phone: null });
    expect(s).toContain("type: email");
    expect(s).not.toContain("== PHONE ==");
  });
});

describe("normalizeContactReport", () => {
  it("clamps scores and coerces arrays", () => {
    const r = normalizeContactReport({
      summary: "s",
      leads: ["one", "two"],
      recommendations: "nope",
      risk_score: 250,
      confidence: -3,
    });
    expect(r.riskScore).toBe(100);
    expect(r.confidence).toBe(0);
    expect(r.leads).toEqual(["one", "two"]);
    expect(r.recommendations).toEqual([]);
  });
});
