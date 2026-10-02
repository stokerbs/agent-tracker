import { describe, expect, it } from "vitest";
import { attributionSchema, attributionColumns } from "./lead-attribution";

describe("attributionSchema / attributionColumns", () => {
  it("accepts a missing object and maps it to all-null columns", () => {
    const parsed = attributionSchema.safeParse(undefined);
    expect(parsed.success).toBe(true);
    const cols = attributionColumns(undefined);
    expect(cols).toEqual({
      landing_page: null, referrer: null, utm_source: null, utm_medium: null, utm_campaign: null,
      utm_term: null, utm_content: null, gclid: null, fbclid: null,
    });
  });

  it("maps provided values and turns empty strings into null", () => {
    const parsed = attributionSchema.safeParse({ landing_page: "/en", utm_source: "google", gclid: "", utm_term: "  สืบชู้  " });
    expect(parsed.success).toBe(true);
    const cols = attributionColumns(parsed.success ? parsed.data : undefined);
    expect(cols.landing_page).toBe("/en");
    expect(cols.utm_source).toBe("google");
    expect(cols.gclid).toBeNull();
    expect(cols.utm_term).toBe("สืบชู้");
  });

  it("rejects over-long values (the API is the authority, not the client)", () => {
    expect(attributionSchema.safeParse({ gclid: "x".repeat(201) }).success).toBe(false);
    expect(attributionSchema.safeParse({ landing_page: "x".repeat(301) }).success).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(attributionSchema.safeParse({ utm_source: 123 }).success).toBe(false);
  });
});
