import { describe, expect, it } from "vitest";
import { ARTICLE_CONSOLIDATION_GROUPS, canonicalArticleFor, canonicalArticles, type ArticleIdentity } from "./article-consolidation";

function article(id: string, slug: string): ArticleIdentity {
  return { id, th_slug: `ไทย-${slug}`, en_slug: slug, zh_slug: `zh-${slug}`, th_title: `ไทย ${slug}`, en_title: slug, zh_title: `中文 ${slug}`, th_body: `ไทย ${slug}`, en_body: `English ${slug}`, zh_body: `中文正文 ${slug}` };
}
const group = ARTICLE_CONSOLIDATION_GROUPS.find((g) => g.topic === "นักสืบกรุงเทพ")!;
const primary = article(group.primaryId, "bangkok-main");
const secondary = article(group.secondaryIds[0], "bangkok-secondary");

describe("reviewed article topic families", () => {
  it("contains eight families and nine secondary records without chains or overlap", () => {
    expect(ARTICLE_CONSOLIDATION_GROUPS).toHaveLength(8);
    const sources = ARTICLE_CONSOLIDATION_GROUPS.flatMap((g) => [...g.secondaryIds]);
    expect(sources).toHaveLength(9);
    expect(new Set(sources).size).toBe(9);
    for (const g of ARTICLE_CONSOLIDATION_GROUPS) expect(sources).not.toContain(g.primaryId);
  });

  it.each(["th", "en", "zh"] as const)("lists only the main guide in %s without changing either stored body", (lang) => {
    const published = [secondary, primary];
    const snapshot = JSON.stringify(published);
    expect(canonicalArticles(published, lang)).toEqual([primary]);
    expect(canonicalArticleFor(secondary, published, lang)).toBe(primary);
    expect(JSON.stringify(published)).toBe(snapshot);
  });

  it("restores the secondary when its main guide is no longer published", () => {
    expect(canonicalArticles([secondary], "en")).toEqual([secondary]);
    expect(canonicalArticleFor(secondary, [secondary], "en")).toBe(secondary);
  });

  it("keeps existing translations visible when a primary translation is unavailable", () => {
    const incomplete = { ...primary, zh_body: null };
    for (const lang of ["th", "en", "zh"] as const) {
      expect(canonicalArticles([secondary, incomplete], lang)).toContain(secondary);
    }
  });

  it("does not merge an unrelated article just because its title is similar", () => {
    const distinct = { ...article("unreviewed-id", "different-angle"), en_title: primary.en_title };
    expect(canonicalArticles([primary, secondary, distinct], "en")).toEqual([primary, distinct]);
  });
});
