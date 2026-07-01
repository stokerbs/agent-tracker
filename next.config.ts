import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import { MARKETING_HOST, CSP_MARKETING_EXTRA, buildCsp } from "./src/lib/csp";

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

