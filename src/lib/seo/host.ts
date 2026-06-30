/**
 * True ONLY for the public marketing host (detectivepulse.com, with or without
 * a leading www. or a port). Every other host — the app domain (.app), Vercel
 * previews, localhost — is treated as non-marketing and gets an
 * `X-Robots-Tag: noindex` in middleware so search engines index only the
 * marketing site.
 *
 * Exact host match (after stripping port + a leading www.), NOT startsWith, so a
 * spoofed `detectivepulse.com.evil.com` cannot masquerade as the marketing host
 * and escape the noindex.
 */
export function isMarketingHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0].replace(/^www\./, "").toLowerCase();
  return h === "detectivepulse.com";
}
