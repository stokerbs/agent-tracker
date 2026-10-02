import type { MetadataRoute } from "next";
import { getMarketingPages, getMarketingPagesEN } from "@/lib/marketing/content";
import { getPublishedArticles } from "@/lib/marketing/articles-db";
import { ZH_PAGES } from "@/lib/marketing/zh/registry";
import { ZH_CASE_STUDIES } from "@/lib/marketing/zh/case-studies";
import { registryOnlySlugs } from "@/lib/marketing/pages";

const BASE = "https://detectivepulse.com";

// Public marketing pages: the static landing/legal pages + every page migrated
// from WordPress (preserved at its original slug) + published AI articles.
//
// lastModified: only emitted where we know it (AI articles → published_at).
// Static and content pages previously reported `new Date()` on every request,
// which Google treats as noise and then ignores for the whole sitemap
// (docs/seo-growth-audit §A.4). Omitting it is more honest than a fake date.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/articles`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/careers`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
  const thMd = getMarketingPages();
  const marketing: MetadataRoute.Sitemap = [
    ...thMd.map((p) => ({
      // Non-trailing-slash to match the served URL (Next 308s the trailing form).
      url: `${BASE}${p.path.replace(/\/+$/, "") || "/"}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // Registry-only Thai pages (pricing, Bangkok, about …) — service pages rank highest.
    ...registryOnlySlugs("th", new Set(thMd.map((p) => p.slug))).map((slug) => ({
      url: `${BASE}/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
  // Chinese site: home + every registry page (services 0.8, info/locations
  // 0.7) + the article hub. Noindexed pages (case-studies while empty) stay out.
  const chinese: MetadataRoute.Sitemap = [
    { url: `${BASE}/zh`, changeFrequency: "weekly", priority: 0.9 },
    ...ZH_PAGES.filter((p) => !(p.noindex && (p.slug !== "case-studies" || ZH_CASE_STUDIES.length === 0))).map((p) => ({
      url: `${BASE}/zh/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: p.kind === "service" ? 0.8 : 0.7,
    })),
    { url: `${BASE}/zh/articles`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/zh/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
  const english: MetadataRoute.Sitemap = [
    { url: `${BASE}/en`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/en/articles`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/en/careers`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/en/privacy`, changeFrequency: "yearly", priority: 0.3 },
    ...getMarketingPagesEN().map((p) => ({
      url: `${BASE}${p.path.replace(/\/+$/, "")}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...registryOnlySlugs("en", new Set(getMarketingPagesEN().map((p) => p.slug))).map((slug) => ({
      url: `${BASE}/en/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
  // Published AI articles (both language versions), newest → higher priority.
  const aiArticles = await getPublishedArticles();
  const aiEntries: MetadataRoute.Sitemap = aiArticles.flatMap((a) => {
    const lastModified = a.published_at ? new Date(a.published_at) : now;
    const entries: MetadataRoute.Sitemap = [
      { url: `${BASE}/articles/${encodeURI(a.th_slug)}`, lastModified, changeFrequency: "monthly", priority: 0.6 },
      { url: `${BASE}/en/articles/${encodeURI(a.en_slug)}`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    ];
    if (a.zh_slug) {
      entries.push({ url: `${BASE}/zh/articles/${encodeURI(a.zh_slug)}`, lastModified, changeFrequency: "monthly", priority: 0.6 });
    }
    return entries;
  });

  return [...staticPages, ...marketing, ...chinese, ...english, ...aiEntries];
}
