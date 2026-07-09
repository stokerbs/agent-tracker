/**
 * Redirect chain resolver.
 *
 * OSINT inputs like PimEyes landing URLs bounce through several hops before
 * reaching the actual image (e.g. PimEyes → MixRank → S3 → profilepic.jpg). We
 * follow:
 *   • HTTP 3xx redirects            (handled inside the SSRF guard, per hop)
 *   • <meta http-equiv="refresh">   (HTML landing pages)
 *   • simple JS location redirects  (window.location = "…" / .replace/.href)
 *   • og:image / first <img>        (as a last resort to find the image)
 *
 * Every hop is re-validated by the SSRF guard. The whole traversal is bounded by
 * a hop budget so a redirect loop can't hang or exhaust resources.
 */

import { safeFetch, SsrfError } from "./fetch-guard";
import type { RedirectHop } from "./types";

const MAX_CHAIN_HOPS = 12;
const HTML_SNIFF_BYTES = 512 * 1024; // only scan the head of an HTML doc

export interface ResolvedChain {
  hops: RedirectHop[];
  finalUrl: string;
  /** Response headers of the terminal hop (for cloud/CDN attribution). */
  finalHeaders: Headers;
  /** Present when the final hop was itself an image (avoids a second download). */
  imageBuffer: Buffer | null;
  imageMime: string | null;
}

/** Extract a meta-refresh target URL from HTML, if present. */
export function parseMetaRefresh(html: string, baseUrl: string): string | null {
  const m = html.match(
    /<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"';]+)/i,
  );
  if (!m) return null;
  return absolutize(m[1].trim(), baseUrl);
}

/** Extract a naive JS redirect target (window.location = "…"). */
export function parseJsRedirect(html: string, baseUrl: string): string | null {
  const patterns = [
    /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
    /(?:window\.)?location\.replace\(\s*["']([^"']+)["']\s*\)/i,
    /(?:window\.)?location\.assign\(\s*["']([^"']+)["']\s*\)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return absolutize(m[1].trim(), baseUrl);
  }
  return null;
}

/** Extract an og:image or first <img src> as a last-resort image target. */
export function parseImageTarget(html: string, baseUrl: string): string | null {
  const og = html.match(
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  );
  if (og) return absolutize(og[1].trim(), baseUrl);
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img) return absolutize(img[1].trim(), baseUrl);
  return null;
}

function absolutize(ref: string, base: string): string | null {
  try {
    return new URL(ref, base).href;
  } catch {
    return null;
  }
}

function isImageContentType(ct: string | null): boolean {
  return !!ct && /^image\//i.test(ct.split(";")[0].trim());
}

function isHtmlContentType(ct: string | null): boolean {
  return !!ct && /text\/html|application\/xhtml/i.test(ct);
}

/**
 * Resolve a starting URL through its full redirect chain to a final image or
 * terminal page. Throws SsrfError if a hop targets a blocked address.
 */
export async function resolveChain(startUrl: string): Promise<ResolvedChain> {
  const hops: RedirectHop[] = [];
  let current = startUrl;
  let hopIndex = 0;

  for (let step = 0; step < MAX_CHAIN_HOPS; step++) {
    const res = await safeFetch(current, { maxBytes: HTML_SNIFF_BYTES });

    // Record every HTTP-level hop the guard actually followed.
    for (const h of res.hops) {
      const kind = h.url === res.finalUrl ? "origin" : "http";
      hops.push({
        hopIndex: hopIndex++,
        kind,
        url: h.url,
        statusCode: h.status,
        resolvedHost: h.host,
        resolvedIp: h.ip,
      });
    }

    const ct = res.headers.get("content-type");

    // Terminal image — done.
    if (isImageContentType(ct)) {
      return {
        hops,
        finalUrl: res.finalUrl,
        finalHeaders: res.headers,
        imageBuffer: res.body,
        imageMime: ct!.split(";")[0].trim(),
      };
    }

    // HTML landing page — look for the next hop.
    if (isHtmlContentType(ct)) {
      const html = res.body.toString("utf8");
      const next =
        parseMetaRefresh(html, res.finalUrl) ??
        parseJsRedirect(html, res.finalUrl) ??
        parseImageTarget(html, res.finalUrl);

      if (next && next !== current) {
        const kind = parseMetaRefresh(html, res.finalUrl)
          ? "meta"
          : parseJsRedirect(html, res.finalUrl)
            ? "js"
            : "origin";
        hops.push({
          hopIndex: hopIndex++,
          kind,
          url: next,
          statusCode: null,
          resolvedHost: safeHost(next),
          resolvedIp: null,
        });
        current = next;
        continue;
      }
    }

    // Non-image, no further redirect — terminate at this URL.
    return { hops, finalUrl: res.finalUrl, finalHeaders: res.headers, imageBuffer: null, imageMime: null };
  }

  throw new SsrfError(`Redirect chain exceeded ${MAX_CHAIN_HOPS} hops`);
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
