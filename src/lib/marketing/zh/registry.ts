import { ZH_SERVICE_PAGES } from "./pages";
import { ZH_LOCATION_PAGES } from "./locations";
import type { ZhPage } from "./types";
import { ZH_NAV } from "./nav";

export { ZH_NAV, ZH_SLUG_LINKS } from "./nav";

export type { ZhPage, ZhSection, ZhSegment } from "./types";

/** Every /zh/<slug> page in sitemap order (services → info → locations). */
export const ZH_PAGES: ZhPage[] = [...ZH_SERVICE_PAGES, ...ZH_LOCATION_PAGES];

const BY_SLUG = new Map(ZH_PAGES.map((p) => [p.slug, p]));

export function getZhPage(slug: string): ZhPage | undefined {
  return BY_SLUG.get(slug);
}

export const ZH_SERVICE_SLUGS = ZH_SERVICE_PAGES.filter((p) => p.kind === "service").map((p) => p.slug);
export const ZH_LOCATION_SLUGS = ZH_LOCATION_PAGES.map((p) => p.slug);

/** Short label for a related-page card. */
export function zhPageLabel(slug: string): string {
  const nav = [...ZH_NAV.services, ...ZH_NAV.primary, ...ZH_NAV.locations].find((n) => n.slug === slug);
  return nav?.label ?? getZhPage(slug)?.h1 ?? slug;
}
