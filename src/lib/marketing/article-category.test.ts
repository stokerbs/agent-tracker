import { describe, expect, it } from "vitest";
import { classifyArticle, getArticleCover, COVER_IMAGES } from "./article-category";

describe("article category classifier", () => {
  it("maps known Thai slugs to expected categories", () => {
    expect(classifyArticle("นักสืบชู้สาว").key).toBe("infidelity");
    expect(classifyArticle("สืบทรัพย์สิน").key).toBe("asset");
    expect(classifyArticle("เช็คประวัติบุคคล").key).toBe("background");
    expect(classifyArticle("สืบตามหาคน").key).toBe("find-person");
    expect(classifyArticle("นักสืบไอที").key).toBe("cyber");
    expect(classifyArticle("วิธีการคิดราคาจ้างนักสืบ").key).toBe("pricing");
    expect(classifyArticle("ติดต่อนักสืบ").key).toBe("contact");
    expect(classifyArticle("จ้างนักสืบ").key).toBe("hire");
  });

  it("maps English slugs to expected categories", () => {
    expect(classifyArticle("cheating-spouse-investigator").key).toBe("infidelity");
    expect(classifyArticle("background-check").key).toBe("background");
    expect(classifyArticle("find-missing-person").key).toBe("find-person");
    expect(classifyArticle("hire-a-private-detective").key).toBe("hire");
    expect(classifyArticle("contact").key).toBe("contact");
  });

  it("returns a stock cover path for every category", () => {
    for (const key of Object.keys(COVER_IMAGES)) {
      const cover = COVER_IMAGES[key as keyof typeof COVER_IMAGES];
      expect(cover.src).toMatch(/^\/marketing\/articles\/.+\.jpg$/);
      expect(cover.altTh.length).toBeGreaterThan(0);
      expect(cover.altEn.length).toBeGreaterThan(0);
    }
  });

  it("allows per-page cover override", () => {
    const cover = getArticleCover("จ้างนักสืบ", "จ้างนักสืบ", "th", {
      coverImage: "/custom.jpg",
      coverAlt: "Custom alt",
    });
    expect(cover.src).toBe("/custom.jpg");
    expect(cover.alt).toBe("Custom alt");
  });
});
