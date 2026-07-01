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

  it("throws without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(generateArticle("t")).rejects.toThrow();
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
        th_slug: "สืบชู้สาว 101",
        en_slug: "Infidelity 101!",
      }),
    );
    const a = await generateArticle("การสืบชู้สาว");
    expect(a.thTitle).toBe("สืบชู้สาว 101");
    expect(a.enSlug).toBe("infidelity-101");
    expect(a.thSlug).toBe("สืบชู้สาว-101");
    expect(a.coverCategory).toBeTruthy();
    expect(a.topic).toBe("การสืบชู้สาว");
  });

  it("throws when the model returns an incomplete article", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(toolResponse({ th_title: "x" }));
    await expect(generateArticle("t")).rejects.toThrow();
  });

  it("throws on an Anthropic error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(generateArticle("t")).rejects.toThrow();
  });
});
