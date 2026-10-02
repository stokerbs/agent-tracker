import { describe, expect, it } from "vitest";
import { CONTENT_CALENDAR, isCalendarTopic } from "./content-calendar";
import { KEYWORD_TOPICS } from "./article-gen";
import { ZH_PLAN_TOPICS } from "./zh/topics";
import { getServicePage } from "./pages";

describe("content calendar months 1–3", () => {
  it("has 12 topics, four per month, all requiring a human paragraph", () => {
    expect(CONTENT_CALENDAR.length).toBe(12);
    for (const m of [1, 2, 3] as const) expect(CONTENT_CALENDAR.filter((t) => t.month === m).length).toBe(4);
    for (const t of CONTENT_CALENDAR) {
      expect(t.humanParagraph).toBe(true);
      expect(t.angle.length).toBeGreaterThan(40);
      for (const k of ["th", "en", "zh"] as const) expect(t[k].trim().length).toBeGreaterThan(0);
    }
  });

  it("dedupe keys are unique and distinct from the other topic lists", () => {
    const keys = CONTENT_CALENDAR.map((t) => t.th);
    expect(new Set(keys).size).toBe(keys.length);
    const others = new Set([...KEYWORD_TOPICS.map((t) => t.th), ...ZH_PLAN_TOPICS.map((t) => t.th)]);
    for (const k of keys) expect(others.has(k), k).toBe(false);
    expect(isCalendarTopic(keys[0]!)).toBe(true);
    expect(isCalendarTopic(KEYWORD_TOPICS[0]!.th)).toBe(false);
  });

  it("every target page is a live TH/EN registry page", () => {
    for (const t of CONTENT_CALENDAR) {
      expect(getServicePage("th", t.targetPage.th), `${t.th} → th/${t.targetPage.th}`).toBeDefined();
      expect(getServicePage("en", t.targetPage.en), `${t.th} → en/${t.targetPage.en}`).toBeDefined();
    }
  });
});
