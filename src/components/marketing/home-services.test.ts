// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SERVICES as TH_SERVICES } from "./marketing-home";
import { SERVICES as EN_SERVICES } from "./marketing-home-en";
import { getMarketingPage, getMarketingPageEN } from "@/lib/marketing/content";
import { getServicePage } from "@/lib/marketing/pages";

/**
 * The homepage service grid resolves each card's href from the markdown pages
 * first and falls back to the service registry, then drops any card that
 * resolves to neither. That makes a typo in a `SERVICES` slug silent: the card
 * simply vanishes in production while typecheck, lint, build and every other
 * test stay green. This pins that every configured card actually resolves.
 */
describe("homepage service grid", () => {
  it("every Thai service slug resolves to a markdown or registry page", () => {
    for (const s of TH_SERVICES) {
      const href = getMarketingPage(s.slug)?.href ?? (getServicePage("th", s.slug) ? `/${s.slug}` : null);
      expect(href, `th home card "${s.label}" (slug ${s.slug})`).not.toBeNull();
    }
  });

  it("every English service slug resolves to a markdown or registry page", () => {
    for (const s of EN_SERVICES) {
      const href = getMarketingPageEN(s.slug)?.href ?? (getServicePage("en", s.slug) ? `/en/${s.slug}` : null);
      expect(href, `en home card "${s.label}" (slug ${s.slug})`).not.toBeNull();
    }
  });

  it("renders the Mystery Shopper card in both languages", () => {
    expect(TH_SERVICES.map((s) => s.slug)).toContain("ลูกค้าปริศนา");
    expect(EN_SERVICES.map((s) => s.slug)).toContain("mystery-shopper");
  });
});
