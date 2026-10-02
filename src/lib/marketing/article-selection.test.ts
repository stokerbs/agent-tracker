import { describe, it, expect } from "vitest";
import { pickSeed } from "./article-selection";
import { KEYWORD_TOPICS } from "./article-gen";
import { ZH_PLAN_ORDERED } from "@/lib/marketing/zh/topics";
import { CONTENT_CALENDAR } from "./content-calendar";

describe("pickSeed", () => {
  it("gives the Chinese plan two of every three runs, in schedule order", () => {
    const used = new Set<string>();
    const picks: string[] = [];
    for (let i = 0; i < 6; i++) {
      const s = pickSeed(used, used.size);
      picks.push(ZH_PLAN_ORDERED.some((t) => t.th === s.th) ? "zh" : "th");
      used.add(s.th);
    }
    expect(picks).toEqual(["zh", "zh", "th", "zh", "zh", "th"]);
    expect(pickSeed(new Set(), 0).th).toBe(ZH_PLAN_ORDERED[0]!.th);
    // Thai slot: the months 1–3 calendar runs before the evergreen list.
    expect(pickSeed(new Set(), 2).th).toBe(CONTENT_CALENDAR[0]!.th);
    const calDone = new Set(CONTENT_CALENDAR.map((t) => t.th));
    expect(pickSeed(calDone, 2).th).toBe(KEYWORD_TOPICS[0]!.th);
  });

  it("falls back to the other list when one is exhausted", () => {
    const zhDone = new Set(ZH_PLAN_ORDERED.map((t) => t.th));
    expect(pickSeed(zhDone, 0).th).toBe(CONTENT_CALENDAR[0]!.th);
    const thDone = new Set([...CONTENT_CALENDAR, ...KEYWORD_TOPICS].map((t) => t.th));
    expect(pickSeed(thDone, 2).th).toBe(ZH_PLAN_ORDERED[0]!.th);
  });

  it("picks a random topic once everything is covered", () => {
    const all = new Set([...ZH_PLAN_ORDERED, ...CONTENT_CALENDAR, ...KEYWORD_TOPICS].map((t) => t.th));
    expect(pickSeed(all, all.size, () => 0).th).toBe(ZH_PLAN_ORDERED[0]!.th);
    expect(pickSeed(all, all.size, () => 0.999).th).toBe(KEYWORD_TOPICS.at(-1)!.th);
  });
});
