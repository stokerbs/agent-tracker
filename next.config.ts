import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Resolve the Supabase storage hostname from the project URL at build time so
// Next.js image optimisation allows avatars and evidence thumbnails. Set
// NEXT_PUBLIC_SUPABASE_URL before running `next build` (Vercel does this
// automatically from project environment variables).
const supabaseHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "placeholder.supabase.co";
  }
})();

// Host matcher for the public marketing site — same regex used for the
// X-Robots-Tag header below, kept in sync with isMarketingHost().
const MARKETING_HOST = "(www\\.)?detectivepulse\\.com";

// CSP directives shared by every host, as arrays so the marketing variant can
// extend specific directives without duplicating the whole policy.
const CSP_BASE: Record<string, string[]> = {
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
const CSP_MARKETING_EXTRA: Record<string, string[]> = {
  "script-src": ["https://www.googletagmanager.com", "https://www.google-analytics.com", "https://googleads.g.doubleclick.net", "https://www.googleadservices.com", "https://connect.facebook.net"],
  "connect-src": ["https://www.googletagmanager.com", "https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://googleads.g.doubleclick.net", "https://google.com", "https://www.google.com", "https://connect.facebook.net", "https://www.facebook.com"],
  "img-src": ["https://www.google-analytics.com", "https://googleads.g.doubleclick.net", "https://www.facebook.com"],
  // Overrides (not extends) the base 'none' — needed for GTM's <noscript> iframe fallback.
  "frame-src": ["https://www.googletagmanager.com"],
};

function buildCsp(extra?: Record<string, string[]>): string {
  const directives = { ...CSP_BASE };
  for (const [key, values] of Object.entries(extra ?? {})) {
    directives[key] = key === "frame-src" ? values : [...(directives[key] ?? []), ...values];
  }
  return [
    ...Object.entries(directives).map(([key, values]) => `${key} ${values.join(" ")}`),
    "upgrade-insecure-requests",
  ].join("; ");
}

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/(.*)", headers: baseSecurityHeaders },
      // Two CSP variants by host — marketing gets the GTM/GA4/Ads/Pixel
      // allowances (see CSP_MARKETING_EXTRA above); the app/dashboard/portal
      // host keeps the tighter default. Never both on the same response.
      {
        source: "/(.*)",
        missing: [{ type: "host", value: MARKETING_HOST }],
        headers: [{ key: "Content-Security-Policy", value: buildCsp() }],
      },
      {
        source: "/(.*)",
        has: [{ type: "host", value: MARKETING_HOST }],
        headers: [{ key: "Content-Security-Policy", value: buildCsp(CSP_MARKETING_EXTRA) }],
      },
      // Index ONLY the marketing host (detectivepulse.com). Every other host —
      // the private app on .app, vercel previews, localhost — gets noindex so
      // the "unlisted" tool stays out of search. (Reliable config-level header;
      // the middleware equivalent didn't propagate on Vercel.)
      {
        source: "/(.*)",
        missing: [{ type: "host", value: MARKETING_HOST }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  // 301 the old WordPress cruft paths (no longer migrated) to the homepage.
  async redirects() {
    return [
      { source: "/sample-page", destination: "/", permanent: true },
      { source: "/home", destination: "/", permanent: true },
      { source: "/author/:path*", destination: "/", permanent: true },
      { source: "/category/:path*", destination: "/", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  webpack(config) {
    // Suppress "Critical dependency" warning from the bundled CJS output of
    // @supabase/supabase-js — upstream packaging artefact, no runtime impact.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /node_modules\/@supabase\/supabase-js/,
        message: /Critical dependency/,
      },
    ];
    return config;
  },
};

// Wrap with Sentry. Safe when unconfigured: without SENTRY_AUTH_TOKEN the
// source-map upload step is skipped (it only warns), and runtime stays inert
// until NEXT_PUBLIC_SENTRY_DSN is set.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});

