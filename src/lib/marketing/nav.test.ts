import { describe, expect, it } from "vitest";
import { TH_NAV, EN_NAV } from "./nav";
import { getMarketingPages, getMarketingPagesEN } from "./content";

const STATIC = new Set(["/articles", "/careers", "/privacy", "/en/articles", "/en/careers"]);

describe("marketing navigation", () => {
  it("every Thai nav href resolves to a content page or a static route, without a trailing slash", () => {
    const hrefs = new Set(getMarketingPages().map((p) => p.href));
    for (const l of [...TH_NAV.services, ...TH_NAV.primary, ...TH_NAV.footer]) {
      expect(l.href.endsWith("/")).toBe(false);
      expect(hrefs.has(l.href) || STATIC.has(l.href), l.href).toBe(true);
    }
  });
  it("every English nav href resolves to a content page or a static route", () => {
    const hrefs = new Set(getMarketingPagesEN().map((p) => p.href));
    for (const l of [...EN_NAV.services, ...EN_NAV.primary, ...EN_NAV.footer]) {
      expect(l.href.endsWith("/")).toBe(false);
      expect(hrefs.has(l.href) || STATIC.has(l.href), l.href).toBe(true);
    }
  });
});
