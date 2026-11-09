import { beforeEach, describe, expect, it, vi } from "vitest";
import { ARTICLE_CONSOLIDATION_GROUPS } from "./article-consolidation";

const h = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), not: vi.fn(), order: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from: h.from }) }));

import { getPublishedArticleBySlug, getPublishedArticles, getPublishedArticlesZh, getPublishedArticlesZhByService, type PublishedArticle } from "./articles-db";

function makeArticle(id: string, slug: string): PublishedArticle {
  return { id, topic: "topic", th_slug: `ไทย-${slug}`, en_slug: slug, zh_slug: `zh-${slug}`, th_title: slug, en_title: slug, zh_title: slug, th_description: "description", en_description: "description", zh_description: "description", th_body: `ไทย ${slug}`, en_body: `English ${slug}`, zh_body: `中文 ${slug}`, cover_category: "business", service: "background", status: "published", created_at: "2026-07-01T00:00:00Z", published_at: "2026-07-02T00:00:00Z" };
}
const family = ARTICLE_CONSOLIDATION_GROUPS[0];
const primary = makeArticle(family.primaryId, "main-guide");
const secondary = makeArticle(family.secondaryIds[0], "secondary-guide");

beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: h.select, eq: h.eq, not: h.not, order: h.order };
  h.from.mockReturnValue(query); h.select.mockReturnValue(query); h.eq.mockReturnValue(query); h.not.mockReturnValue(query);
  h.order.mockResolvedValue({ data: [secondary, primary], error: null });
});

describe("public article consolidation reads", () => {
  it("shows one guide per family and queries only published public columns", async () => {
    expect(await getPublishedArticles()).toEqual([primary]);
    expect(h.eq).toHaveBeenCalledWith("status", "published");
    const columns = h.select.mock.calls[0][0] as string;
    expect(columns).not.toContain("approve_token"); expect(columns).not.toBe("*");
  });

  it("keeps the original secondary body readable with a main-guide canonical identity", async () => {
    const article = await getPublishedArticleBySlug("secondary-guide", "en");
    expect(article?.id).toBe(secondary.id);
    expect(article?.en_body).toBe(secondary.en_body);
    expect(article?.published_at).toBe(secondary.published_at);
    expect(article?.canonicalArticle).toMatchObject({ id: primary.id, en_slug: "main-guide" });
  });

  it("finds percent-encoded Thai slugs and does not canonicalize a main guide to itself", async () => {
    const article = await getPublishedArticleBySlug(encodeURIComponent(primary.th_slug), "th");
    expect(article?.id).toBe(primary.id);
    expect(article?.canonicalArticle).toBeUndefined();
  });

  it("retains a secondary when its primary is absent and returns null for unknown slugs", async () => {
    h.order.mockResolvedValue({ data: [secondary], error: null });
    expect(await getPublishedArticles()).toEqual([secondary]);
    expect((await getPublishedArticleBySlug(secondary.en_slug, "en"))?.canonicalArticle).toBeUndefined();
    expect(await getPublishedArticleBySlug("missing", "en")).toBeNull();
  });

  it("uses canonical guides for Chinese hubs and service cards without exposing article bodies", async () => {
    expect(await getPublishedArticlesZh()).toEqual([primary]);
    const cards = await getPublishedArticlesZhByService("background", 3);
    expect(cards).toHaveLength(1); expect(cards[0].id).toBe(primary.id);
    expect(cards[0]).not.toHaveProperty("th_body"); expect(cards[0]).not.toHaveProperty("en_body");
    expect(h.select.mock.calls.at(-1)?.[0]).not.toContain("_body");
    expect(await getPublishedArticlesZhByService("another-service", 3)).toEqual([]);
  });

  it("does not silently drop the remaining Chinese version if the primary lacks that translation", async () => {
    h.order.mockResolvedValue({ data: [secondary, { ...primary, zh_body: null }], error: null });
    expect((await getPublishedArticlesZh()).map((a) => a.id)).toEqual([secondary.id]);
  });
});
