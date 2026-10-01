import { describe, it, expect } from "vitest";
import { ZH_PLAN_TOPICS, ZH_PLAN_ORDERED } from "./topics";
import { KEYWORD_TOPICS } from "@/lib/marketing/article-gen";
import { ZH_SERVICE_PAGE } from "./nav";
import { findBannedPhrases } from "./compliance";

describe("30-topic Chinese content plan", () => {
  it("has exactly 30 topics with unique ids, Chinese and Thai keywords", () => {
    expect(ZH_PLAN_TOPICS).toHaveLength(30);
    expect(new Set(ZH_PLAN_TOPICS.map((t) => t.id)).size).toBe(30);
    expect(new Set(ZH_PLAN_TOPICS.map((t) => t.zh)).size).toBe(30);
    expect(new Set(ZH_PLAN_TOPICS.map((t) => t.th)).size).toBe(30);
  });

  it("dedupe keys never collide with the Thai keyword list", () => {
    const th = new Set(KEYWORD_TOPICS.map((t) => t.th));
    for (const t of ZH_PLAN_TOPICS) expect(th.has(t.th), t.th).toBe(false);
  });

  it("every topic maps to a real /zh service page and a scheduled week", () => {
    for (const t of ZH_PLAN_TOPICS) {
      expect(ZH_SERVICE_PAGE[t.service], `${t.id} ${t.service}`).toBeDefined();
      expect(t.week).toBeGreaterThanOrEqual(3);
      expect(t.week).toBeLessThanOrEqual(12);
      expect(t.angle.length).toBeGreaterThan(40);
      expect(findBannedPhrases(`${t.zh} ${t.angle}`)).toEqual([]);
    }
  });

  it("orders by week then id", () => {
    for (let i = 1; i < ZH_PLAN_ORDERED.length; i++) {
      const a = ZH_PLAN_ORDERED[i - 1]!, b = ZH_PLAN_ORDERED[i]!;
      expect(a.week < b.week || (a.week === b.week && a.id < b.id)).toBe(true);
    }
  });
});
