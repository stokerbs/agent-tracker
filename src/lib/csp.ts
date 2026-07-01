/**
 * Content-Security-Policy builder, shared between next.config.ts (which
 * consumes it to set response headers) and its test — kept in a plain module
 * so it's importable without triggering next.config.ts's Sentry/next-intl
 * wrapping at import time.
 */

// Host matcher for the public marketing site — kept in sync with
// isMarketingHost() and the existing X-Robots-Tag host matcher.
export const MARKETING_HOST = "(www\\.)?detectivepulse\\.com";

// CSP directives shared by every host, as arrays so the marketing variant can
// extend specific directives without duplicating the whole policy.
export const CSP_BASE: Record<string, string[]> = {
  "default-src": ["'self'"],
  // next-intl, Next.js runtime, Radix UI — inline scripts required.
  // `capacitor:` allows the Capacitor native bridge when loaded in the app shell.
  "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "capacitor:", "https://maps.googleapis.com"],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  // `capacitor:` lets native camera previews (photo.webPath) render in <img>.
  "img-src": ["'self'", "blob:", "data:", "capacitor:", "https://*.supabase.co", "https://lh3.googleusercontent.com", "https://maps.gstatic.com", "https://maps.googleapis.com"],
  // Sentry ingest (error reporting) — adjust the region host to match your
  // DSN if it isn't on the US/global cluster (e.g. *.ingest.de.sentry.io).
  "connect-src": ["'self'", "capacitor:", "https://*.supabase.co", "wss://*.supabase.co", "https://api.anthropic.com", "https://maps.googleapis.com", "https://*.sentry.io", "https://*.ingest.sentry.io", "https://*.ingest.us.sentry.io"],
  "frame-src": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
};

// Marketing-only additions — Google Tag Manager (analytics/ads conversion
// tracking on detectivepulse.com only; see src/app/layout.tsx's isMarketingHost
// gate). Pre-allows the hosts GA4 / Google Ads / Meta Pixel tags need once
// configured *inside* the GTM container, so adding a tag in GTM's UI doesn't
// also require a CSP code change.
export const CSP_MARKETING_EXTRA: Record<string, string[]> = {
  "script-src": ["https://www.googletagmanager.com", "https://www.google-analytics.com", "https://googleads.g.doubleclick.net", "https://www.googleadservices.com", "https://connect.facebook.net"],
  "connect-src": ["https://www.googletagmanager.com", "https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://googleads.g.doubleclick.net", "https://google.com", "https://www.google.com", "https://connect.facebook.net", "https://www.facebook.com"],
  "img-src": ["https://www.google-analytics.com", "https://googleads.g.doubleclick.net", "https://www.facebook.com"],
  // Overrides (not extends) the base 'none' — needed for GTM's <noscript> iframe fallback.
  "frame-src": ["https://www.googletagmanager.com"],
};

export function buildCsp(extra?: Record<string, string[]>): string {
  const directives = { ...CSP_BASE };
  for (const [key, values] of Object.entries(extra ?? {})) {
    directives[key] = key === "frame-src" ? values : [...(directives[key] ?? []), ...values];
  }
  return [
    ...Object.entries(directives).map(([key, values]) => `${key} ${values.join(" ")}`),
    "upgrade-insecure-requests",
  ].join("; ");
}
