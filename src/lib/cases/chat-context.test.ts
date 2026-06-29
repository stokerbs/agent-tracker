import { describe, expect, it } from "vitest";
import { buildIntelText, mediaTypeFor, type TargetIntel } from "./chat-context";

const empty: TargetIntel = {
  name: null, alias: null, phone: null, email: null, dob: null, notes: null,
  locations: [], vehicles: [], relationships: [],
};

describe("buildIntelText", () => {
  it("returns empty string when there is no intelligence", () => {
    expect(buildIntelText(empty)).toBe("");
  });

  it("renders target identity fields that are present", () => {
    const out = buildIntelText({ ...empty, name: "สมชาย", alias: "เสี่ยช.", phone: "0812345678" });
    expect(out).toContain("ข่าวกรองเป้าหมาย:");
    expect(out).toContain("ชื่อ: สมชาย");
    expect(out).toContain("นามแฝง: เสี่ยช.");
    expect(out).toContain("โทร: 0812345678");
  });

  it("includes a prebuilt Google Maps link for located places", () => {
    const out = buildIntelText({
      ...empty,
      locations: [{ name: "บ้านพัก", type: "home", address: "ซอย 5", notes: null, lat: 13.7563, lng: 100.5018 }],
    });
    expect(out).toContain("บ้านพัก");
    expect(out).toContain("ซอย 5");
    expect(out).toContain("https://www.google.com/maps?q=13.75630,100.50180");
  });

  it("omits the maps link when coordinates are missing", () => {
    const out = buildIntelText({
      ...empty,
      locations: [{ name: "ที่ทำงาน", type: null, address: null, notes: null, lat: null, lng: null }],
    });
    expect(out).toContain("ที่ทำงาน");
    expect(out).not.toContain("google.com/maps");
  });

  it("renders vehicles with plate and relationships", () => {
    const out = buildIntelText({
      ...empty,
      vehicles: [{ label: "Toyota Vios สีขาว", plate: "1กก 1234", notes: "ใช้ประจำ" }],
      relationships: [{ name: "สมหญิง", relation: "ภรรยา", notes: null }],
    });
    expect(out).toContain("Toyota Vios สีขาว");
    expect(out).toContain("ทะเบียน 1กก 1234");
    expect(out).toContain("สมหญิง");
    expect(out).toContain("(ภรรยา)");
  });
});

describe("mediaTypeFor", () => {
  it("maps known extensions", () => {
    expect(mediaTypeFor("a/b.png", null)).toBe("image/png");
    expect(mediaTypeFor("a/b.webp", null)).toBe("image/webp");
    expect(mediaTypeFor("a/b.gif", null)).toBe("image/gif");
    expect(mediaTypeFor("a/b.jpg", null)).toBe("image/jpeg");
    expect(mediaTypeFor("a/b.JPEG", null)).toBe("image/jpeg");
  });
  it("falls back to the mime when the extension is unknown", () => {
    expect(mediaTypeFor("a/b.heic", "image/heic")).toBe("image/heic");
  });
  it("defaults to image/jpeg when neither extension nor mime is usable", () => {
    expect(mediaTypeFor("a/b", null)).toBe("image/jpeg");
    expect(mediaTypeFor("a/b.bin", "application/pdf")).toBe("image/jpeg");
  });
});
