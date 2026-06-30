import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Marketing pages migrated from the old WordPress (detectivepulse.com) site,
 * stored as markdown files with a JSON-valued frontmatter block. Slugs/paths are
 * preserved EXACTLY from WordPress so the URLs (and their SEO) don't change.
 */
export interface MarketingPage {
  id: string;
  /** URL-decoded single path segment, e.g. "นักสืบชู้สาว" (no slashes). */
  slug: string;
  /** Exact original path incl. trailing slash, e.g. "/%e0%b8%99.../". */
  path: string;
  title: string;
  seoTitle: string;
  description: string;
  /** Markdown body. */
  body: string;
}

const CONTENT_DIR = join(process.cwd(), "src/content/marketing");

/** Parse the JSON-valued frontmatter block (`key: <json>` lines between ---). */
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const valRaw = line.slice(i + 1).trim();
    try {
      data[key] = JSON.parse(valRaw);
    } catch {
      data[key] = valRaw.replace(/^"|"$/g, "");
    }
  }
  return { data, body: m[2].trim() };
}

let cache: MarketingPage[] | null = null;

/** All migrated marketing pages (cached). Single-segment slugs only. */
export function getMarketingPages(): MarketingPage[] {
  if (cache) return cache;
  let files: string[] = [];
  try {
    files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return (cache = []);
  }
  const pages: MarketingPage[] = [];
  for (const f of files) {
    const { data, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, f), "utf-8"));
    const slug = String(data.slug ?? "").replace(/^\/|\/$/g, ""); // "/x/" → "x"
    if (!slug) continue;
    pages.push({
      id: String(data.id ?? f.replace(/\.md$/, "")),
      slug,
      path: String(data.path ?? `/${slug}/`),
      title: String(data.title ?? slug),
      seoTitle: String(data.seoTitle || data.title || slug),
      description: String(data.description ?? ""),
      body,
    });
  }
  return (cache = pages);
}

export function getMarketingPage(slug: string): MarketingPage | undefined {
  const decoded = decodeURIComponent(slug);
  return getMarketingPages().find((p) => p.slug === decoded || p.slug === slug);
}

// ── English pages (src/content/marketing/en/*.md) ────────────────────────────
const EN_DIR = join(CONTENT_DIR, "en");
let cacheEN: MarketingPage[] | null = null;

export function getMarketingPagesEN(): MarketingPage[] {
  if (cacheEN) return cacheEN;
  let files: string[] = [];
  try {
    files = readdirSync(EN_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return (cacheEN = []);
  }
  const pages: MarketingPage[] = [];
  for (const f of files) {
    const { data, body } = parseFrontmatter(readFileSync(join(EN_DIR, f), "utf-8"));
    const slug = String(data.slug ?? "").replace(/^\/|\/$/g, "");
    if (!slug) continue;
    pages.push({
      id: String(data.id ?? f.replace(/\.md$/, "")),
      slug,
      path: String(data.path ?? `/en/${slug}/`),
      title: String(data.title ?? slug),
      seoTitle: String(data.seoTitle || data.title || slug),
      description: String(data.description ?? ""),
      body,
    });
  }
  return (cacheEN = pages);
}

export function getMarketingPageEN(slug: string): MarketingPage | undefined {
  const decoded = decodeURIComponent(slug);
  return getMarketingPagesEN().find((p) => p.slug === decoded || p.slug === slug);
}
