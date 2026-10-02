// @vitest-environment node
import { describe, expect, it } from "vitest";
import { businessJsonLd } from "./json-ld";
import { FACTS } from "@/lib/marketing/facts";

function walk(v: unknown, path = "root"): string[] {
  if (v === null || v === undefined) return [path];
  if (Array.isArray(v)) return v.flatMap((x, i) => walk(x, `${path}[${i}]`));
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => walk(x, `${path}.${k}`));
  return [];
}

describe("businessJsonLd", () => {
  it("omits legalName/award while unconfirmed and serialises no null/undefined", () => {
    const b = businessJsonLd("th");
    expect(b).not.toHaveProperty("legalName");
    expect(b).not.toHaveProperty("award");
    expect(walk(b)).toEqual([]);
    expect(b["@id"]).toBe("https://detectivepulse.com/#business");
    expect(b.aggregateRating.reviewCount).toBe(String(FACTS.confirmed.reviews.count));
  });
  it("includes legalName and award once the owner supplies them", () => {
    const facts = {
      ...FACTS,
      pending: { ...FACTS.pending, legalName: "บริษัท ตัวอย่าง จำกัด", awards: [{ name: "Award", issuer: "Issuer", year: 2025 }] },
    } as typeof FACTS;
    const b = businessJsonLd("en", facts);
    expect(b).toHaveProperty("legalName", "บริษัท ตัวอย่าง จำกัด");
    expect(b).toHaveProperty("award", ["Award (Issuer, 2025)"]);
    expect(b.description).toContain("since 2016");
    expect(b.url).toBe("https://detectivepulse.com/en");
  });
});
