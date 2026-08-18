import { describe, expect, it, vi } from "vitest";

// Synthetic pool so the picker's behaviour is tested, not the real keyword list.
vi.mock("@/lib/marketing/article-gen", () => ({
  KEYWORD_TOPICS: [
    { th: "a1", en: "a1-en", zh: "a1-zh", category: "location", angle: "x" },
    { th: "a2", en: "a2-en", zh: "a2-zh", category: "location", angle: "x" },
    { th: "b1", en: "b1-en", zh: "b1-zh", category: "legal", angle: "x" },
  ],
}));

import { ARTICLE_FORMATS, buildTopicKey, parseTopicKey, pickTopic } from "./topic-picker";

const FORMAT_KEYS = ARTICLE_FORMATS.map((f) => f.key);

describe("topic keys", () => {
  it("round-trips a keyword + format pair", () => {
    const key = buildTopicKey("นักสืบภูเก็ต", "faq");
    expect(parseTopicKey(key)).toEqual({ base: "นักสืบภูเก็ต", format: "faq" });
  });

  it("treats a bare keyword as format-less (legacy rows)", () => {
    expect(parseTopicKey("นักสืบชู้สาว")).toEqual({ base: "นักสืบชู้สาว", format: null });
  });
});

describe("pickTopic — first pass", () => {
  it("takes the highest-priority unused keyword and stores a bare key", () => {
    const p = pickTopic([]);
    expect(p.seed.th).toBe("a1");
    expect(p.topicKey).toBe("a1");
    expect(p.isRevisit).toBe(false);
    expect(FORMAT_KEYS).toContain(p.format.key);
  });

  it("skips ahead when the previous article used the same category", () => {
    const p = pickTopic(["a1"], ["a1"]);
    expect(p.seed.th).toBe("b1"); // a2 is another 'location' — skipped
  });

  it("falls back to priority order when every remaining keyword shares that category", () => {
    const p = pickTopic(["a1", "b1"], ["a1"]);
    expect(p.seed.th).toBe("a2");
  });

  it("does not reuse a recently used format", () => {
    const p = pickTopic(["a1"], [buildTopicKey("a1", ARTICLE_FORMATS[0]!.key)]);
    expect(p.format.key).not.toBe(ARTICLE_FORMATS[0]!.key);
  });

  it("never returns a keyword that already has an article", () => {
    const p = pickTopic(["a1", "a2"]);
    expect(p.seed.th).toBe("b1");
  });
});

describe("pickTopic — revisits once the pool is covered", () => {
  it("comes back with a format the keyword has not had", () => {
    const p = pickTopic(["a1", "a2", "b1"]);
    expect(p.isRevisit).toBe(true);
    expect(p.topicKey).toBe(buildTopicKey(p.seed.th, p.format.key));
    expect(FORMAT_KEYS).toContain(p.format.key);
  });

  it("keeps producing unique keyword+format pairs over many rounds", () => {
    const used = new Set(["a1", "a2", "b1"]);
    const recent: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      const p = pickTopic(used, recent);
      expect(used.has(p.topicKey)).toBe(false);
      used.add(p.topicKey);
      recent.unshift(p.topicKey);
    }
    expect(used.size).toBe(23);
    // and it spread across formats rather than hammering one
    const formats = new Set([...used].map((k) => parseTopicKey(k).format).filter(Boolean));
    expect(formats.size).toBeGreaterThan(3);
  });

  it("still returns a unique key when every keyword × format pair exists", () => {
    const used = new Set<string>(["a1", "a2", "b1"]);
    for (const t of ["a1", "a2", "b1"]) for (const f of FORMAT_KEYS) used.add(buildTopicKey(t, f));
    const p = pickTopic(used);
    expect(used.has(p.topicKey)).toBe(false);
    expect(p.isRevisit).toBe(true);
  });
});
