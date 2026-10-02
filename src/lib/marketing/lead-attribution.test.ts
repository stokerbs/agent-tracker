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

  it("drops a landing_page that is not a site-relative path and a referrer that is not http(s)", () => {
    const parsed = attributionSchema.safeParse({ landing_page: "javascript:alert(1)", referrer: "javascript:alert(1)" });
    expect(parsed.success).toBe(true); // shape is fine; values are sanitised at mapping time, not rejected
    const cols = attributionColumns(parsed.success ? parsed.data : undefined);
    expect(cols.landing_page).toBeNull();
    expect(cols.referrer).toBeNull();
    const ok = attributionColumns({ landing_page: "/en/contact", referrer: "https://www.google.com/" });
    expect(ok.landing_page).toBe("/en/contact");
    expect(ok.referrer).toBe("https://www.google.com/");
    expect(attributionColumns({ landing_page: "en/contact" }).landing_page).toBeNull();
    expect(attributionColumns({ referrer: "ftp://x.example/" }).referrer).toBeNull();
  });

  it("rejects over-long values (the API is the authority, not the client)", () => {
    expect(attributionSchema.safeParse({ gclid: "x".repeat(201) }).success).toBe(false);
    expect(attributionSchema.safeParse({ landing_page: "x".repeat(301) }).success).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(attributionSchema.safeParse({ utm_source: 123 }).success).toBe(false);
  });
});
