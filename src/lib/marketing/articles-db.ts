import "server-only";

import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import type { GeneratedArticle } from "@/lib/marketing/article-gen";
import { articleHasLanguage, canonicalArticleFor, canonicalArticles, preferredArticleId, type ArticleLanguage } from "./article-consolidation";

export interface DbArticle {
  id: string;
  topic: string;
  th_slug: string;
  en_slug: string;
  th_title: string;
  th_description: string;
  th_body: string;
  en_title: string;
  en_description: string;
  en_body: string;
  zh_slug: string | null;
  zh_title: string | null;
  zh_description: string | null;
  zh_body: string | null;
  cover_category: string | null;
  /** Service key (migration 0125); null for older rows — see articleServiceKey(). */
  service: string | null;
  status: string;
  approve_token: string;
  created_at: string;
  published_at: string | null;
}

export type ArticleCanonical = Pick<DbArticle, "id" | "th_slug" | "en_slug" | "zh_slug" | "th_title" | "en_title" | "zh_title">;
export type PublishedArticle = Omit<DbArticle, "approve_token"> & { canonicalArticle?: ArticleCanonical };

// Public reads never retrieve approval capabilities. Request caching shares
// the snapshot between metadata, article content, related cards and the hub.
const PUBLISHED_COLUMNS = "id,topic,th_slug,en_slug,zh_slug,th_title,en_title,zh_title,th_description,en_description,zh_description,th_body,en_body,zh_body,cover_category,service,status,created_at,published_at";
const readPublishedArticles = cache(async (): Promise<PublishedArticle[]> => {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("marketing_articles")
    .select(PUBLISHED_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) console.error("[articles-db] published query failed", { message: error.message });
  return (data as PublishedArticle[]) ?? [];
});

/** One main guide per reviewed topic family, newest first. */
export async function getPublishedArticles(): Promise<PublishedArticle[]> {
  return canonicalArticles(await readPublishedArticles(), "th");
}

/** Published articles that have a Chinese version (for the /zh article index). */
export async function getPublishedArticlesZh(): Promise<PublishedArticle[]> {
  return canonicalArticles(await readPublishedArticles(), "zh");
}

export type DbArticleCard = Pick<DbArticle, "id" | "zh_slug" | "zh_title" | "en_slug" | "cover_category" | "service" | "published_at">;

// Service pages need small card records, not every article's three bodies.
const readPublishedChineseCards = cache(async (): Promise<DbArticleCard[]> => {
  const { data, error } = await createServiceClient().from("marketing_articles")
    .select("id,zh_slug,zh_title,en_slug,cover_category,service,published_at")
    .eq("status", "published").not("zh_slug", "is", null)
    .order("published_at", { ascending: false });
  if (error) console.error("[articles-db] Chinese card query failed", { message: error.message });
  return ((data ?? []) as DbArticleCard[]).filter((a) => Boolean(a.zh_slug && a.zh_title));
});

/** Published Chinese articles for one service key (newest first). "general"
 *  returns any Chinese article so the pillar page is never empty. Returns only
 *  card columns (never approve_token) and degrades to [] on any failure — it
 *  feeds a public, statically rendered page. */
export async function getPublishedArticlesZhByService(service: string, limit = 3): Promise<DbArticleCard[]> {
  try {
    const cards = await readPublishedChineseCards();
    const available = new Set(cards.map((a) => a.id));
    return cards
      .filter((a) => preferredArticleId(a.id) === a.id || !available.has(preferredArticleId(a.id)))
      .filter((a) => service === "general" || a.service === service)
      .slice(0, Math.max(0, limit))
      .map(({ id, zh_slug, zh_title, en_slug, cover_category, service: key, published_at }) => ({
        id, zh_slug, zh_title, en_slug, cover_category, service: key, published_at,
      }));
  } catch (e) {
    console.error("[articles-db] by-service query threw", { service, message: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

/** A single published article by its TH or EN slug (public reads). The route
 *  param for non-ASCII (Thai) slugs arrives percent-encoded, so decode first. */
export const getPublishedArticleBySlug = cache(async (slug: string, lang: ArticleLanguage): Promise<PublishedArticle | null> => {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    /* malformed encoding — fall back to the raw value */
  }
  const published = await readPublishedArticles();
  const col = lang === "en" ? "en_slug" : lang === "zh" ? "zh_slug" : "th_slug";
  const article = published.find((a) => a[col] === decoded);
  if (!article || !articleHasLanguage(article, lang)) return null;
  const primary = canonicalArticleFor(article, published, lang);
  if (primary.id === article.id) return article;
  const { id, th_slug, en_slug, zh_slug, th_title, en_title, zh_title } = primary;
  return { ...article, canonicalArticle: { id, th_slug, en_slug, zh_slug, th_title, en_title, zh_title } };
});

/** Topics + slugs already used, so the generator avoids repeats/collisions. */
export async function getUsedTopicsAndSlugs(): Promise<{ topics: Set<string>; slugs: Set<string> }> {
  const svc = createServiceClient();
  const { data } = await svc.from("marketing_articles").select("topic, th_slug, en_slug, zh_slug");
  const topics = new Set<string>();
  const slugs = new Set<string>();
  for (const r of (data as Array<{ topic: string; th_slug: string; en_slug: string; zh_slug: string | null }>) ?? []) {
    topics.add(r.topic);
    slugs.add(r.th_slug);
    slugs.add(r.en_slug);
    if (r.zh_slug) slugs.add(r.zh_slug);
  }
  return { topics, slugs };
}

/** Insert a generated article as a draft with its one-time approve token. */
export async function insertDraft(a: GeneratedArticle, token: string): Promise<{ id: string } | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("marketing_articles")
    .insert({
      topic: a.topic,
      th_slug: a.thSlug,
      en_slug: a.enSlug,
      th_title: a.thTitle,
      th_description: a.thDescription,
      th_body: a.thBody,
      en_title: a.enTitle,
      en_description: a.enDescription,
      en_body: a.enBody,
      zh_slug: a.zhSlug,
      zh_title: a.zhTitle,
      zh_description: a.zhDescription,
      zh_body: a.zhBody,
      cover_category: a.coverCategory,
      service: a.service,
      status: "draft",
      approve_token: token,
      model: a.model,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

/**
 * Tombstone for a topic whose Chinese draft failed compliance twice. Stored as a
 * `rejected` row (never published, visible to admins in /marketing-articles) so
 * getUsedTopicsAndSlugs() marks the topic as used and the next run moves on
 * instead of re-burning two model calls on it every Tue/Fri.
 */
export async function insertComplianceTombstone(topic: string, violations: string[], model: string): Promise<void> {
  const svc = createServiceClient();
  const stamp = Date.now().toString(36);
  const note = `ร่างภาษาจีนถูกปฏิเสธโดยตัวกรองความถูกต้องตามกฎหมาย (${violations.join(", ")}) — หัวข้อนี้จะถูกข้ามไป`;
  const { error } = await svc.from("marketing_articles").insert({
    topic,
    th_slug: `rejected-${stamp}`,
    en_slug: `rejected-${stamp}`,
    th_title: `[ปฏิเสธอัตโนมัติ] ${topic}`,
    th_description: note,
    th_body: note,
    en_title: `[auto-rejected] ${topic}`,
    en_description: `Chinese draft failed the compliance filter (${violations.join(", ")}); topic skipped.`,
    en_body: `Chinese draft failed the compliance filter (${violations.join(", ")}); topic skipped.`,
    status: "rejected",
    approve_token: `rejected-${stamp}-${Math.random().toString(36).slice(2, 10)}`,
    model,
  });
  if (error) throw error;
}

/** Look up a draft by its approve token (any status — used by the review page). */
export async function getArticleByToken(token: string): Promise<DbArticle | null> {
  const svc = createServiceClient();
  const { data } = await svc.from("marketing_articles").select("*").eq("approve_token", token).maybeSingle();
  return (data as DbArticle | null) ?? null;
}

/** Replace the TH/EN bodies of a pending draft (human paragraph spliced in on
 *  the review page). Service role; only while the row is still a draft. */
export async function setDraftBodies(token: string, bodies: { th_body: string; en_body: string }): Promise<boolean> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("marketing_articles")
    .update(bodies)
    .eq("approve_token", token)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Publish or reject a draft. Publishing stamps published_at. Idempotent-ish:
 *  only acts on a row that is still a draft. Returns the new status or null. */
export async function decideArticle(token: string, decision: "published" | "rejected"): Promise<string | null> {
  const svc = createServiceClient();
  const patch: Record<string, unknown> = { status: decision };
  if (decision === "published") patch.published_at = new Date().toISOString();
  const { data, error } = await svc
    .from("marketing_articles")
    .update(patch)
    .eq("approve_token", token)
    .eq("status", "draft") // only a pending draft can be decided
    .select("status")
    .maybeSingle();
  if (error) throw error;
  return (data as { status: string } | null)?.status ?? null;
}
