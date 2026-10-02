import { describe, expect, it } from "vitest";
import { getMarketingPages, getMarketingPage, getMarketingPagesEN } from "./content";

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

  it("exposes a decoded, non-trailing-slash href for linking", () => {
    for (const p of pages) {
      expect(p.href).toBe(`/${p.slug}`);
      expect(p.href.endsWith("/")).toBe(false);
    }
  });

  it("in-body internal links are relative and do not end with a slash (no 308 hops)", () => {
    for (const p of pages) {
      const links = [...p.body.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]!);
      for (const l of links) {
        expect(l.startsWith("https://detectivepulse.com"), `${p.slug}: ${l}`).toBe(false);
        if (l.startsWith("/") && l !== "/") expect(l.endsWith("/"), `${p.slug}: ${l}`).toBe(false);
      }
    }
  });

  it("descriptions fit a search snippet (≤155 chars) and titles carry no brand suffix (the layout template adds it)", () => {
    for (const p of [...pages, ...getMarketingPagesEN()]) {
      expect(p.description.length, `${p.slug}: ${p.description.length}`).toBeLessThanOrEqual(155);
      expect(p.seoTitle.includes("| Detective Pulse"), p.slug).toBe(false);
    }
  });
});
