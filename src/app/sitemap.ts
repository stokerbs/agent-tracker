import type { MetadataRoute } from "next";
import { getMarketingPages, getMarketingPagesEN } from "@/lib/marketing/content";

const BASE = "https://detectivepulse.com";

// Public marketing pages: the static landing/legal pages + every page migrated
// from WordPress (preserved at its original slug).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/support`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
  const marketing: MetadataRoute.Sitemap = getMarketingPages().map((p) => ({
    // Non-trailing-slash to match the served URL (Next 308s the trailing form).
    url: `${BASE}${p.path.replace(/\/+$/, "") || "/"}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  const english: MetadataRoute.Sitemap = [
    { url: `${BASE}/en`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...getMarketingPagesEN().map((p) => ({
      url: `${BASE}${p.path.replace(/\/+$/, "")}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
  return [...staticPages, ...marketing, ...english];
}
