// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/marketing/articles-db", () => ({
  getPublishedArticles: vi.fn(async () => [
    { th_slug: "บทความ-ก", en_slug: "article-a", zh_slug: "文章-甲", published_at: "2026-09-01T00:00:00Z" },
    { th_slug: "บทความ-ข", en_slug: "article-b", zh_slug: null, published_at: null },
  ]),
}));

import sitemap from "./sitemap";

describe("sitemap.xml", () => {
  it("emits lastModified only where it is real (articles), never a fake 'now' on static or content pages", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(60);
    for (const e of entries) {
      // Omitted key, not `undefined` — Next would otherwise print <lastmod>undefined</lastmod>.
      expect(Object.hasOwn(e, "lastModified") && e.lastModified === undefined, e.url).toBe(false);
      if (e.url.includes("/articles/")) {
        expect(e.lastModified, e.url).toBeInstanceOf(Date);
      } else {
        expect(Object.hasOwn(e, "lastModified"), e.url).toBe(false);
      }
    }
  });

  it("covers both article languages (and Chinese when present) with the published date", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`https://detectivepulse.com/articles/${encodeURI("บทความ-ก")}`);
    expect(urls).toContain("https://detectivepulse.com/en/articles/article-a");
    expect(urls).toContain(`https://detectivepulse.com/zh/articles/${encodeURI("文章-甲")}`);
    expect(urls.some((u) => u.endsWith("/zh/articles/null"))).toBe(false);
    const dated = entries.find((e) => e.url.endsWith("/en/articles/article-a"))!;
    expect((dated.lastModified as Date).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("excludes the app-only pages and anything with a trailing slash; keeps every TH/EN content page and the 3 privacy notices", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/support"))).toBe(false);
    // /privacy on detectivepulse.com is the marketing (PDPA) notice, in TH/EN/ZH.
    for (const p of ["/privacy", "/en/privacy", "/zh/privacy"]) expect(urls).toContain(`https://detectivepulse.com${p}`);
    for (const u of urls) if (u !== "https://detectivepulse.com/") expect(u.endsWith("/"), u).toBe(false);
    expect(urls).toContain("https://detectivepulse.com/");
    expect(urls).toContain("https://detectivepulse.com/en");
    expect(urls).toContain("https://detectivepulse.com/zh");
    expect(urls).toContain("https://detectivepulse.com/en/background-check");
    expect(urls.filter((u) => /^https:\/\/detectivepulse\.com\/en\/[^/]+$/.test(u)).length).toBeGreaterThanOrEqual(27);
  });

  it("lists the registry-only service pages (no markdown twin), percent-encoded", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of ["/ราคานักสืบ", "/นักสืบกรุงเทพ", "/เกี่ยวกับเรา"]) expect(urls).toContain(`https://detectivepulse.com${encodeURI(p)}`);
    // No raw (unencoded) Thai anywhere in the sitemap.
    for (const u of urls) expect(/[\u0E00-\u0E7F]/.test(u), u).toBe(false);
    for (const p of ["/en/pricing", "/en/private-investigator-bangkok", "/en/about"]) expect(urls).toContain(`https://detectivepulse.com${p}`);
  });

  it("drops consolidation-redirect sources only when MARKETING_CONSOLIDATION_REDIRECTS=1", async () => {
    // Markdown paths are lowercase-percent-encoded (WordPress export); compare decoded.
    const decoded = async () => (await sitemap()).map((e) => decodeURI(e.url));
    const src = "https://detectivepulse.com/นักสืบคดีชู้สาว-รับสืบค";
    const enSrc = "https://detectivepulse.com/en/private-detective-pricing";
    expect(await decoded()).toContain(src);
    expect(await decoded()).toContain(enSrc);
    vi.stubEnv("MARKETING_CONSOLIDATION_REDIRECTS", "1");
    try {
      const urls = await decoded();
      expect(urls).not.toContain(src);
      expect(urls).not.toContain(enSrc);
      expect(urls).toContain("https://detectivepulse.com/en/pricing");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
