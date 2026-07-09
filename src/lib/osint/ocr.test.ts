import { describe, it, expect } from "vitest";
import { categorizeText, linesToResults, type RawOcrLine } from "./ocr";

describe("categorizeText", () => {
  it.each([
    ["contact@detectivepulse.com", "email"],
    ["john.doe+case@example.co.th", "email"],
    ["https://pimeyes.com/en", "url"],
    ["www.example.com/photo", "url"],
    ["081-234-5678", "phone"],
    ["+66 81 234 5678", "phone"],
    ["0812345678", "phone"],
    ["1กก 1234", "plate"],
    ["กข 4567", "plate"],
    ["just some words here", "raw"],
    ["", "raw"],
  ])("classifies %s as %s", (text, expected) => {
    expect(categorizeText(text)).toBe(expected);
  });

  it("does not classify a 4-digit plate as a phone", () => {
    expect(categorizeText("AB 1234")).toBe("plate");
  });

  it("prefers email over anything else", () => {
    expect(categorizeText("mail me at a@b.com or call 0812345678")).toBe("email");
  });
});

describe("linesToResults", () => {
  const line = (over: Partial<RawOcrLine>): RawOcrLine => ({
    text: "hello",
    confidence: 90,
    bbox: { x0: 10, y0: 20, x1: 110, y1: 60 },
    ...over,
  });

  it("normalizes bbox to 0..1 and confidence to 0..1", () => {
    const [r] = linesToResults([line({})], 200, 100);
    expect(r.bbox).toEqual({ x: 0.05, y: 0.2, w: 0.5, h: 0.4 });
    expect(r.confidence).toBeCloseTo(0.9);
    expect(r.category).toBe("raw");
  });

  it("drops blank and low-confidence lines", () => {
    const results = linesToResults(
      [line({ text: "   " }), line({ text: "keep", confidence: 80 }), line({ text: "drop", confidence: 20 })],
      200,
      100,
    );
    expect(results.map((r) => r.text)).toEqual(["keep"]);
  });

  it("categorizes recognized lines", () => {
    const results = linesToResults([line({ text: "081-234-5678", confidence: 95 })], 200, 100);
    expect(results[0].category).toBe("phone");
  });

  it("returns null bbox when dimensions are unknown", () => {
    const [r] = linesToResults([line({})], 0, 0);
    expect(r.bbox).toBeNull();
  });
});
