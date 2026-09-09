import { describe, expect, it } from "vitest";
import { formatKnowledgeContext, tokenizeQuery } from "./search";

describe("tokenizeQuery", () => {
  it("drops stop words and short tokens", () => {
    const t = tokenizeQuery("สร้างคอนเทนต์อาทิตย์หน้า 5 เรื่อง เน้นงานนอกใจ สำหรับ TikTok");
    expect(t).toContain("งานนอกใจ");
    expect(t).toContain("tiktok");
    expect(t).not.toContain("สร้าง");
    expect(t).not.toContain("5");
  });
  it("dedupes", () => {
    expect(tokenizeQuery("gps gps GPS")).toEqual(["gps"]);
  });
});

describe("formatKnowledgeContext", () => {
  it("numbers hits and returns a ref map", () => {
    const { context, refs } = formatKnowledgeContext([
      { kind: "knowledge", id: "a", title: "GPS", text: "บอกตำแหน่ง", tags: [], score: 1 },
      { kind: "case_insight", id: "b", title: "รถอยู่ คนไม่อยู่", text: "…", tags: [], score: 1 },
    ]);
    expect(context).toContain("[K1]");
    expect(context).toContain("[K2]");
    expect(refs.K2.id).toBe("b");
  });
});
