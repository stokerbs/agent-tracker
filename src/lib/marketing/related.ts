import type { MarketingPage } from "@/lib/marketing/content";
import { classifyArticle } from "@/lib/marketing/article-category";
import { consolidationRedirectsEnabled, isConsolidatedSource } from "@/lib/marketing/redirects";

/**
 * Related pages for the bottom of a content page: same topic category first
 * (via the cover classifier), then the remaining pages in their natural order,
 * never the page itself. Replaces the old `.slice(0, 3)` which linked the same
 * three pages from everywhere (docs/seo-growth-audit §3 H2).
 */
export function getRelatedPages(all: MarketingPage[], current: MarketingPage, n = 3): MarketingPage[] {
  const key = classifyArticle(`${current.slug} ${current.title}`).key;
  // With the consolidation 301s live, never recommend a page that redirects.
  const redirected = consolidationRedirectsEnabled();
  const others = all.filter((p) => p.slug !== current.slug && !(redirected && isConsolidatedSource(p.href)));
  const same = others.filter((p) => classifyArticle(`${p.slug} ${p.title}`).key === key);
  const rest = others.filter((p) => !same.includes(p));
  return [...same, ...rest].slice(0, n);
}
