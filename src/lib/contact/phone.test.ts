import { describe, it, expect } from "vitest";
import { parsePhone } from "./phone";
import { buildContactReverseLinks } from "./reverse";

describe("parsePhone", () => {
  it("parses a Thai mobile in local format with region TH", () => {
    const p = parsePhone("0812345678", "TH");
    expect(p.valid).toBe(true);
    expect(p.e164).toBe("+66812345678");
    expect(p.country).toBe("TH");
    expect(p.countryCallingCode).toBe("+66");
    expect(p.lineType).toBe("mobile");
  });

  it("parses an E.164 number without a region hint", () => {
    const p = parsePhone("+66812345678");
    expect(p.valid).toBe(true);
    expect(p.e164).toBe("+66812345678");
    expect(p.national).toContain("081");
  });

  it("distinguishes a fixed line from mobile", () => {
    const p = parsePhone("021234567", "TH"); // Bangkok landline
    expect(p.valid).toBe(true);
    expect(p.lineType).toBe("fixed_line");
  });

  it("flags an invalid number", () => {
    const p = parsePhone("12345", "TH");
    expect(p.valid).toBe(false);
    expect(p.e164).toBeNull();
  });

  it("never throws on garbage", () => {
    const p = parsePhone("not a phone");
    expect(p.valid).toBe(false);
    expect(p.possible).toBe(false);
  });
});

describe("buildContactReverseLinks", () => {
  it("builds phone links using the E.164 form", () => {
    const p = parsePhone("0812345678", "TH");
    const links = buildContactReverseLinks("phone", "0812345678", p);
    const google = links.find((l) => l.engine === "google")!;
    expect(google.url).toContain(encodeURIComponent('"+66812345678"'));
    expect(links.some((l) => l.engine === "truecaller")).toBe(true);
    for (const l of links) expect(l.url).toMatch(/^https:\/\//);
  });

  it("builds email links (incl. HIBP)", () => {
    const links = buildContactReverseLinks("email", "a@b.com");
    expect(links.some((l) => l.engine === "hibp")).toBe(true);
    expect(links[0].url).toContain(encodeURIComponent('"a@b.com"'));
  });

  it("builds username links", () => {
    const links = buildContactReverseLinks("username", "johndoe");
    expect(links.some((l) => l.engine === "whatsmyname")).toBe(true);
  });
});
