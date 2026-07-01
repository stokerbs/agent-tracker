/**
 * Lightweight analytics helpers for the public marketing site
 * (detectivepulse.com). GA4-backed but provider-agnostic at the call site: if
 * no `NEXT_PUBLIC_GA_ID` is configured the tag never loads and `track()` is a
 * safe no-op (same "inert until configured" pattern as Sentry in this repo).
 *
 * Nothing here runs on the private app host — the analytics tag is only mounted
 * inside the marketing SiteChrome.
 */

/** GA4 measurement ID (e.g. "G-XXXXXXX"); empty/undefined disables analytics. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim() || "";

export type ContactChannel =
  | "line"
  | "whatsapp"
  | "facebook"
  | "wechat"
  | "phone"
  | "email";

/**
 * Classify an outbound contact link into a conversion channel, or `null` when
 * the href isn't one of the firm's contact channels (so we don't log noise for
 * internal navigation). Pure + host-agnostic so it's unit-testable.
 */
export function channelFromHref(href: string | null | undefined): ContactChannel | null {
  if (!href) return null;
  const h = href.trim().toLowerCase();
  if (h.startsWith("tel:")) return "phone";
  if (h.startsWith("mailto:")) return "email";
  if (h.includes("lin.ee") || h.includes("line.me")) return "line";
  if (h.includes("whatsapp.com") || h.includes("wa.me")) return "whatsapp";
  if (h.includes("facebook.com") || h.includes("fb.me") || h.includes("fb.com")) return "facebook";
  if (h.includes("weixin") || h.includes("wechat")) return "wechat";
  return null;
}

type GtagParams = Record<string, string | number | boolean | undefined>;

/**
 * Fire a GA4 event. No-ops safely when the tag isn't loaded (unconfigured,
 * server-side, or blocked) so callers never need to guard.
 */
export function track(event: string, params: GtagParams = {}): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== "function") return;
  try {
    gtag("event", event, params);
  } catch {
    // Analytics must never break the page.
  }
}
