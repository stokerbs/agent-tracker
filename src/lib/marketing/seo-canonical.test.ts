import { describe, expect, it } from "vitest";
import { canonicalMarketingHref, isArticleLibraryPage, isSecondaryMarketingPath, primaryMarketingPath } from "./seo-canonical";
import { CONSOLIDATION_REDIRECTS, consolidationRedirects } from "./redirects";
import { getMarketingPages, getMarketingPagesEN } from "./content";
import { SERVICE_PAGES } from "./pages";
import { EN_TO_TH } from "./i18n";

describe("legacy SEO canonical organization", () => {
  it("pairs twenty duplicate paths with live primary service pages in the same language", () => {
    expect(CONSOLIDATION_REDIRECTS).toHaveLength(20);
    const live = new Set([...SERVICE_PAGES.th.map((p) => `/${p.slug}`), ...SERVICE_PAGES.en.map((p) => `/en/${p.slug}`)]);
    const pages = new Set([...getMarketingPages(), ...getMarketingPagesEN()].map((p) => p.href));
    for (const { from, to } of CONSOLIDATION_REDIRECTS) {
      expect(pages.has(from), from).toBe(true);
      expect(live.has(to), to).toBe(true);
      expect(from.startsWith("/en/")).toBe(to.startsWith("/en/"));
      expect(primaryMarketingPath(encodeURI(from))).toBe(to);
      expect(isSecondaryMarketingPath(to)).toBe(false);
    }
    // Canonical tags do not silently enable permanently cached redirects.
    expect(consolidationRedirects({})).toEqual([]);
  });

  it("keeps Thai and English counterpart canonical mappings reciprocal", () => {
    for (const { from, to } of CONSOLIDATION_REDIRECTS.filter((r) => r.from.startsWith("/en/"))) {
      const thSource = `/${EN_TO_TH[from.slice(4)]}`;
      const thTarget = `/${EN_TO_TH[to.slice(4)]}`;
      expect(primaryMarketingPath(thSource)).toBe(thTarget);
    }
  });

  it.each(["/en/hire-a-detective-online", "/en/phone-usage-investigation", "/en/trace-assets-before-lawsuit", "/en/private-investigator", "/en/detective-services-overview", "/บริการตรวจสอบการใช้โทร"])(
    "retains the distinct intent of %s", (path) => {
      expect(primaryMarketingPath(path)).toBe(path);
      expect(isSecondaryMarketingPath(path)).toBe(false);
    },
  );

  it("normalizes relative/encoded/absolute internal links while retaining query and fragment", () => {
    expect(canonicalMarketingHref("/en/private-detective-pricing?utm_source=line#contact")).toBe("/en/pricing?utm_source=line#contact");
    expect(canonicalMarketingHref(`${encodeURI("/วิธีการคิดราคาจ้างนักส")}/#contact`)).toBe("/ราคานักสืบ#contact");
    expect(canonicalMarketingHref("https://www.detectivepulse.com/en/private-detective-pricing")).toBe("https://detectivepulse.com/en/pricing");
  });

  it.each([undefined, "#contact", "tel:+66968461406", "mailto:detectivepluse@gmail.com", "https://example.com/en/private-detective-pricing", "//example.com/en/private-detective-pricing", "https://detectivepulse.com.evil.test/en/private-detective-pricing", "/en/articles/a-new-guide"])(
    "leaves unrelated href %s untouched", (href) => { expect(canonicalMarketingHref(href)).toBe(href); },
  );

  it("keeps services, contact pages and aliases out of article cards while retaining supporting guides", () => {
    for (const lang of ["th", "en"] as const) {
      const registry = new Set(SERVICE_PAGES[lang].map((p) => p.slug));
      const pages = lang === "th" ? getMarketingPages() : getMarketingPagesEN();
      const cards = pages.filter((p) => isArticleLibraryPage(p.href, registry, p.slug));
      expect(cards.length).toBeGreaterThan(4);
      for (const p of cards) {
        expect(isSecondaryMarketingPath(p.href)).toBe(false);
        expect(registry.has(p.slug)).toBe(false);
        expect(p.href).not.toMatch(/^(\/ติดต่อนักสืบ|\/en\/contact)$/);
      }
    }
  });
});
