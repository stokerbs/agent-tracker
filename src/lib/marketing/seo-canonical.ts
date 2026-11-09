import { CONSOLIDATION_REDIRECTS } from "./redirects";
import { isMarketingHost } from "./host";

const primaryPaths = new Map(CONSOLIDATION_REDIRECTS.map((r) => [r.from, r.to]));

/** Canonical consolidation is reversible; permanent redirects remain gated. */
export function primaryMarketingPath(pathname: string): string {
  let decoded = pathname.replace(/\/+$/, "") || "/";
  try { decoded = decodeURI(decoded); } catch { /* keep malformed paths unchanged */ }
  return primaryPaths.get(decoded) ?? decoded;
}

export function isSecondaryMarketingPath(pathname: string): boolean {
  let decoded = pathname.replace(/\/+$/, "") || "/";
  try { decoded = decodeURI(decoded); } catch { return false; }
  return primaryPaths.has(decoded);
}

/** Normalize internal references while retaining attribution and anchors. */
export function canonicalMarketingHref(href: string | undefined): string | undefined {
  if (!href || href.startsWith("//") || !/^(\/|https?:\/\/)/i.test(href)) return href;
  let url: URL;
  try { url = new URL(href, "https://detectivepulse.com"); } catch { return href; }
  if (!isMarketingHost(url.host) || !isSecondaryMarketingPath(url.pathname)) return href;
  const target = primaryMarketingPath(url.pathname) + url.search + url.hash;
  return href.startsWith("/") ? target : `https://detectivepulse.com${target}`;
}

/** Contact/service pages belong outside the article library. */
export function isArticleLibraryPage(path: string, serviceSlugs: ReadonlySet<string>, slug: string): boolean {
  return !serviceSlugs.has(slug) && path !== "/ติดต่อนักสืบ" && path !== "/en/contact" && !isSecondaryMarketingPath(path);
}
