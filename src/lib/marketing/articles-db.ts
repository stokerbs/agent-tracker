import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { GeneratedArticle } from "@/lib/marketing/article-gen";

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
  cover_category: string | null;
  status: string;
  approve_token: string;
  created_at: string;
  published_at: string | null;
}

/** All published AI articles, newest first (public reads). */
export async function getPublishedArticles(): Promise<DbArticle[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("marketing_articles")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return (data as DbArticle[]) ?? [];
}

/** A single published article by its TH or EN slug (public reads). */
export async function getPublishedArticleBySlug(slug: string, lang: "th" | "en"): Promise<DbArticle | null> {
  const svc = createServiceClient();
  const col = lang === "en" ? "en_slug" : "th_slug";
  const { data } = await svc
    .from("marketing_articles")
    .select("*")
    .eq("status", "published")
    .eq(col, slug)
    .maybeSingle();
  return (data as DbArticle | null) ?? null;
}

/** Topics + slugs already used, so the generator avoids repeats/collisions. */
export async function getUsedTopicsAndSlugs(): Promise<{ topics: Set<string>; slugs: Set<string> }> {
  const svc = createServiceClient();
  const { data } = await svc.from("marketing_articles").select("topic, th_slug, en_slug");
  const topics = new Set<string>();
  const slugs = new Set<string>();
  for (const r of (data as Array<{ topic: string; th_slug: string; en_slug: string }>) ?? []) {
    topics.add(r.topic);
    slugs.add(r.th_slug);
    slugs.add(r.en_slug);
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
      cover_category: a.coverCategory,
      status: "draft",
      approve_token: token,
      model: a.model,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

/** Look up a draft by its approve token (any status — used by the review page). */
export async function getArticleByToken(token: string): Promise<DbArticle | null> {
  const svc = createServiceClient();
  const { data } = await svc.from("marketing_articles").select("*").eq("approve_token", token).maybeSingle();
  return (data as DbArticle | null) ?? null;
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
