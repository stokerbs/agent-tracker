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
    expect(links).toHaveLength(8);
    for (const l of links) {
      expect(l.url).toMatch(/^https:\/\//);
      expect(l.url).not.toContain("undefined");
      expect(l.url).not.toContain("null");
    }
  });

  it("covers all engines exactly once", () => {
    const engines = buildReverseSearchLinks("https://x.com/y.jpg").map((l) => l.engine).sort();
    expect(engines).toEqual([
      "baidu",
      "bing",
      "facecheck",
      "google_lens",
      "lenso",
      "pimeyes",
      "tineye",
      "yandex",
    ]);
  });

  it("marks the face-recognition engines and always uses their landing pages", () => {
    const links = buildReverseSearchLinks("https://x.com/y.jpg");
    const faceEngines = links.filter((l) => l.face).map((l) => l.engine).sort();
    expect(faceEngines).toEqual(["facecheck", "lenso", "pimeyes"]);
    // Upload-only engines never embed the image URL.
    for (const l of links.filter((x) => x.face)) {
      expect(l.url).not.toContain("x.com");
    }
  });
});
