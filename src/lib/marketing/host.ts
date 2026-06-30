/**
 * True only for the public marketing host (detectivepulse.com, with/without
 * www or a port). Used to render the marketing site on .com vs the app on .app
 * (and previews/localhost). Exact host match (not startsWith) so a spoofed
 * `detectivepulse.com.evil.com` can't masquerade as the marketing host.
 */
export function isMarketingHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0].replace(/^www\./, "").toLowerCase();
  return h === "detectivepulse.com";
}
