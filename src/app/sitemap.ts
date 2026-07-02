import type { MetadataRoute } from "next";
import { getMarketingPages, getMarketingPagesEN } from "@/lib/marketing/content";
import { getPublishedArticles } from "@/lib/marketing/articles-db";

const BASE = "https://detectivepulse.com";

// Public marketing pages: the static landing/legal pages + every page migrated
// from WordPress (preserved at its original slug) + published AI articles.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/support`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/articles`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/careers`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
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
    { url: `${BASE}/en/articles`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/en/careers`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...getMarketingPagesEN().map((p) => ({
      url: `${BASE}${p.path.replace(/\/+$/, "")}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
  // Published AI articles (both language versions), newest → higher priority.
  const aiArticles = await getPublishedArticles();
  const aiEntries: MetadataRoute.Sitemap = aiArticles.flatMap((a) => [
    {
      url: `${BASE}/articles/${encodeURI(a.th_slug)}`,
      lastModified: a.published_at ? new Date(a.published_at) : now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${BASE}/en/articles/${encodeURI(a.en_slug)}`,
      lastModified: a.published_at ? new Date(a.published_at) : now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
  ]);

  return [...staticPages, ...marketing, ...english, ...aiEntries];
}
