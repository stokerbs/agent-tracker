// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getMarketingPages, getMarketingPagesEN } from "@/lib/marketing/content";
import { registryOnlySlugs, SERVICE_PAGES } from "@/lib/marketing/pages";

/**
 * The TH/EN [slug] routes set `dynamicParams = false`, so a registry page that
 * is missing from generateStaticParams would silently 404. The routes build
 * their params as markdown slugs ∪ registryOnlySlugs — this pins that contract.
 */
describe("marketing [slug] static params", () => {
  it("every TH and EN registry page is either a markdown slug or a registry-only slug", () => {
    const thMd = new Set(getMarketingPages().map((p) => p.slug));
    const enMd = new Set(getMarketingPagesEN().map((p) => p.slug));
    const thParams = new Set([...thMd, ...registryOnlySlugs("th", thMd)]);
    const enParams = new Set([...enMd, ...registryOnlySlugs("en", enMd)]);
    for (const p of SERVICE_PAGES.th) expect(thParams.has(p.slug), `th/${p.slug}`).toBe(true);
    for (const p of SERVICE_PAGES.en) expect(enParams.has(p.slug), `en/${p.slug}`).toBe(true);
    // The three new pages per language really are registry-only.
    expect(registryOnlySlugs("th", thMd)).toEqual(expect.arrayContaining(["ราคานักสืบ", "นักสืบกรุงเทพ", "เกี่ยวกับเรา"]));
    expect(registryOnlySlugs("en", enMd)).toEqual(expect.arrayContaining(["pricing", "private-investigator-bangkok", "about"]));
  });
});
