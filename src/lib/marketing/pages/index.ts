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
/**
 * Registry page path for a service key per language — used by the article
 * generator so TH/EN articles link to the service page they support. Keys
 * from the Chinese pipeline (relationship, general, on_site) are aliased.
 */
const SERVICE_KEY_ALIASES: Record<string, string> = { relationship: "infidelity", general: "hire", on_site: "due_diligence" };
export function servicePathForKey(lang: PageLang, serviceKey: string | null | undefined): string | undefined {
  if (!serviceKey) return undefined;
  const key = SERVICE_KEY_ALIASES[serviceKey] ?? serviceKey;
  const page = SERVICE_PAGES[lang].find((p) => p.service === key);
  return page ? (lang === "th" ? `/${page.slug}` : `/en/${page.slug}`) : undefined;
}

export function servicePagePath(page: MarketingServicePage): string {
  return page.lang === "en" ? `/en/${page.slug}` : `/${page.slug}`;
}
