import type { MetadataRoute } from "next";

// Served (identically) on both domains. The marketing host (detectivepulse.com)
// is the only one meant to be indexed — the app host is additionally protected
// by an `X-Robots-Tag: noindex` response header set in middleware. Here we keep
// crawlers off the private app paths and point at the marketing sitemap.
const APP_PATHS = [
  "/dashboard", "/portal", "/api", "/login", "/register", "/auth",
  "/gps-monitor", "/gps-devices", "/gps903-credentials", "/gps903-discovery",
  "/cases", "/agents", "/timeline", "/evidence", "/expenses", "/invoices",
  "/payroll", "/users", "/settings", "/emergency", "/map", "/analytics",
  "/audit", "/field", "/clients", "/reports",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: APP_PATHS },
    sitemap: "https://detectivepulse.com/sitemap.xml",
    host: "https://detectivepulse.com",
  };
}
