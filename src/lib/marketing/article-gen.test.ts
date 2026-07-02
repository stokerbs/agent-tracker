import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeSlug, generateArticle } from "./article-gen";

describe("sanitizeSlug", () => {
  it("kebab-cases English slugs", () => {
    expect(sanitizeSlug("How To Hire  a PI!", "en")).toBe("how-to-hire-a-pi");
  });
  it("falls back for empty English", () => {
    expect(sanitizeSlug("!!!", "en")).toBe("article");
  });
  it("keeps Thai but strips spaces/unsafe chars", () => {
    expect(sanitizeSlug("สืบ ชู้สาว/ครับ?", "th")).toBe("สืบ-ชู้สาวครับ");
  });
});

describe("generateArticle", () => {
  const OLD = { ...process.env };
  beforeEach(() => { vi.restoreAllMocks(); process.env.ANTHROPIC_API_KEY = "k"; });
  afterEach(() => { process.env = { ...OLD }; vi.clearAllMocks(); });

  function toolResponse(input: Record<string, string>) {
    return new Response(JSON.stringify({ content: [{ type: "tool_use", name: "save_article", input }] }), { status: 200 });
  }

  const seed = { th: "นักสืบชู้สาว", en: "infidelity investigator", zh: "婚外情调查", angle: "จับผิดคู่รัก" };

  it("throws without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(generateArticle(seed)).rejects.toThrow();
  });

  it("returns a normalised bilingual article from the tool call", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      toolResponse({
        th_title: "สืบชู้สาว 101",
        th_description: "คำอธิบาย",
        th_body: "## หัวข้อ\nเนื้อหา",
        en_title: "Infidelity 101",
        en_description: "Desc",
        en_body: "## Heading\nbody",
        zh_title: "婚外情调查 101",
        zh_description: "描述",
        zh_body: "## 标题\n正文",
        th_slug: "สืบชู้สาว 101",
        en_slug: "Infidelity 101!",
        zh_slug: "婚外情调查 101",
      }),
    );
    const a = await generateArticle(seed);
    expect(a.thTitle).toBe("สืบชู้สาว 101");
    expect(a.enSlug).toBe("infidelity-101");
    expect(a.thSlug).toBe("สืบชู้สาว-101");
    expect(a.zhTitle).toBe("婚外情调查 101");
    expect(a.zhSlug).toBe("婚外情调查-101");
    expect(a.coverCategory).toBeTruthy();
    expect(a.topic).toBe("นักสืบชู้สาว");
  });

  it("throws when the model returns an incomplete article", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(toolResponse({ th_title: "x" }));
    await expect(generateArticle(seed)).rejects.toThrow();
  });

  it("throws on an Anthropic error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(generateArticle(seed)).rejects.toThrow();
  });
});
