import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeSlug, generateArticle } from "./article-gen";
import { ARTICLE_FORMATS } from "./topic-picker";

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

  const seed = {
    th: "นักสืบชู้สาว",
    en: "infidelity investigator",
    zh: "婚外情调查",
    category: "infidelity" as const,
    angle: "จับผิดคู่รัก",
  };

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

  it("passes the format brief and the recent titles into the prompt", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      toolResponse({
        th_title: "t", th_description: "d", th_body: "b",
        en_title: "t", en_description: "d", en_body: "b",
        zh_title: "t", zh_description: "d", zh_body: "b",
        th_slug: "s", en_slug: "s", zh_slug: "s",
      }),
    );
    const format = ARTICLE_FORMATS[2]!;
    await generateArticle(seed, { format, recentTitles: ["บทความเก่า A", "บทความเก่า B"] });
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]!.body));
    const prompt = body.messages[0].content as string;
    expect(prompt).toContain(format.en);
    expect(prompt).toContain(format.brief);
    expect(prompt).toContain("บทความเก่า A");
    expect(prompt).toContain("บทความเก่า B");
  });

  it("omits the format/recent-titles blocks when none are given", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      toolResponse({
        th_title: "t", th_description: "d", th_body: "b",
        en_title: "t", en_description: "d", en_body: "b",
        zh_title: "t", zh_description: "d", zh_body: "b",
        th_slug: "s", en_slug: "s", zh_slug: "s",
      }),
    );
    await generateArticle(seed);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]!.body));
    const prompt = body.messages[0].content as string;
    expect(prompt).not.toContain("ARTICLE FORMAT:");
    expect(prompt).not.toContain("RECENT ARTICLE TITLES");
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
