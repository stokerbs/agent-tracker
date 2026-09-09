import { describe, expect, it } from "vitest";
import { durationFit, estimateSpokenSeconds, formatDuration, stripScriptMarkup } from "./duration";

describe("estimateSpokenSeconds", () => {
  it("returns 0 for empty", () => {
    expect(estimateSpokenSeconds("")).toBe(0);
    expect(estimateSpokenSeconds(null)).toBe(0);
  });
  it("estimates a short Thai hook at a few seconds", () => {
    const s = estimateSpokenSeconds("GPS บอกตำแหน่งรถได้ แต่ไม่ได้บอกว่าใครอยู่ในรถ");
    expect(s).toBeGreaterThanOrEqual(3);
    expect(s).toBeLessThanOrEqual(9);
  });
  it("scales with length", () => {
    const short = estimateSpokenSeconds("นักสืบไม่ได้เดาแต่สังเกต");
    const long = estimateSpokenSeconds(
      "นักสืบไม่ได้เดาแต่สังเกต การเฝ้าติดตามที่ดีเริ่มจากการวางแผนล่วงหน้า รู้เส้นทาง รู้เวลา และรู้ว่าจะถอยเมื่อไหร่ หลักฐานที่มีน้ำหนักคือหลักฐานที่ยืนยันซ้ำได้ ไม่ใช่ภาพเดียวที่ตีความได้หลายทาง",
    );
    expect(long).toBeGreaterThan(short * 2);
  });
  it("ignores stage directions and timestamps", () => {
    const withMarkup = estimateSpokenSeconds("[HOOK] 00:00–00:03 GPS บอกตำแหน่งรถได้ (visual: night traffic)");
    const plain = estimateSpokenSeconds("GPS บอกตำแหน่งรถได้");
    expect(withMarkup).toBe(plain);
  });
});

describe("stripScriptMarkup", () => {
  it("removes bracket tags", () => {
    expect(stripScriptMarkup("[CTA] ทักมา").trim()).toBe("ทักมา");
  });
});

describe("formatDuration / durationFit", () => {
  it("formats seconds and minutes", () => {
    expect(formatDuration(45)).toBe("45 วิ");
    expect(formatDuration(90)).toBe("1 นาที 30 วิ");
    expect(formatDuration(120)).toBe("2 นาที");
  });
  it("classifies fit", () => {
    expect(durationFit(30, 30)).toBe("on_target");
    expect(durationFit(20, 30)).toBe("short");
    expect(durationFit(40, 30)).toBe("long");
    expect(durationFit(0, 30)).toBe("unknown");
  });
});
