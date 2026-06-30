import type { MetadataRoute } from "next";

const BASE = "https://detectivepulse.com";

// Public marketing pages only. Extend as the migrated WordPress content lands
// (about, services, contact, blog posts, …).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/support`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
