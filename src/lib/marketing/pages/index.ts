import type { MarketingServicePage, PageLang } from "./types";
import { TH_SERVICE_PAGES } from "./th";
import { EN_SERVICE_PAGES } from "./en";

export type { MarketingServicePage, PageLang, PageSection, ProcessStep } from "./types";

export const SERVICE_PAGES: Record<PageLang, MarketingServicePage[]> = {
  th: TH_SERVICE_PAGES,
  en: EN_SERVICE_PAGES,
};

export function getServicePage(lang: PageLang, slug: string): MarketingServicePage | undefined {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    /* keep raw */
  }
  return SERVICE_PAGES[lang].find((p) => p.slug === decoded || p.slug === slug);
}

/** Slugs that exist only in the registry (no markdown file) — needed by static params + sitemap. */
export function registryOnlySlugs(lang: PageLang, markdownSlugs: Set<string>): string[] {
  return SERVICE_PAGES[lang].filter((p) => !markdownSlugs.has(p.slug)).map((p) => p.slug);
}

/** Served path for a registry page. */
export function servicePagePath(page: MarketingServicePage): string {
  return page.lang === "en" ? `/en/${page.slug}` : `/${page.slug}`;
}
