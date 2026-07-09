import { describe, it, expect } from "vitest";
import { buildReverseSearchLinks } from "./reverse-search";

describe("buildReverseSearchLinks", () => {
  it("builds deep links with an encoded image URL", () => {
    const links = buildReverseSearchLinks("https://cdn.example.com/a b.jpg?x=1");
    const byEngine = Object.fromEntries(links.map((l) => [l.engine, l.url]));
    const enc = encodeURIComponent("https://cdn.example.com/a b.jpg?x=1");
    expect(byEngine.google_lens).toContain(enc);
    expect(byEngine.yandex).toContain(enc);
    expect(byEngine.bing).toContain(enc);
    expect(byEngine.tineye).toContain(enc);
    // PimEyes is upload-only → always the landing page.
    expect(byEngine.pimeyes).toBe("https://pimeyes.com/en");
  });

  it("falls back to landing pages when there is no image URL", () => {
    const links = buildReverseSearchLinks(null);
    expect(links).toHaveLength(5);
    for (const l of links) {
      expect(l.url).toMatch(/^https:\/\//);
      expect(l.url).not.toContain("undefined");
      expect(l.url).not.toContain("null");
    }
  });

  it("covers all five engines exactly once", () => {
    const engines = buildReverseSearchLinks("https://x.com/y.jpg").map((l) => l.engine).sort();
    expect(engines).toEqual(["bing", "google_lens", "pimeyes", "tineye", "yandex"]);
  });
});
