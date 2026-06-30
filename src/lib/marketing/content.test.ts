import { describe, expect, it } from "vitest";
import { getMarketingPages, getMarketingPage } from "./content";

describe("marketing content loader", () => {
  const pages = getMarketingPages();

  it("loads the migrated WordPress pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(20);
  });

  it("parses frontmatter into clean fields", () => {
    for (const p of pages) {
      expect(p.slug).not.toContain("/"); // single decoded segment
      expect(p.path.startsWith("/")).toBe(true);
      expect(p.title.length).toBeGreaterThan(0);
      expect(typeof p.body).toBe("string");
      // seoTitle falls back to title, never empty
      expect(p.seoTitle.length).toBeGreaterThan(0);
    }
  });

  it("finds a page by its decoded Thai slug AND by the encoded slug", () => {
    const decoded = getMarketingPage("นักสืบชู้สาว");
    expect(decoded?.slug).toBe("นักสืบชู้สาว");
    const encoded = getMarketingPage(encodeURIComponent("นักสืบชู้สาว"));
    expect(encoded?.slug).toBe("นักสืบชู้สาว");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getMarketingPage("does-not-exist")).toBeUndefined();
  });

  it("every page has a unique slug", () => {
    const slugs = pages.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
