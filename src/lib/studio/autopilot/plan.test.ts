import { describe, expect, it } from "vitest";
import { bangkokDay, buildBrief, choosePillar, shouldRun } from "./plan";
import { DEFAULT_AUTOPILOT } from "@/lib/studio/settings";
import type { AutopilotSettings, PillarConfig } from "@/lib/studio/types";

const cfg = (over: Partial<AutopilotSettings> = {}): AutopilotSettings => ({ ...DEFAULT_AUTOPILOT, enabled: true, ...over });

describe("bangkokDay", () => {
  it("uses Bangkok time, not UTC", () => {
    // 2026-09-10T18:00Z is already Friday 01:00 in Bangkok.
    expect(bangkokDay(new Date("2026-09-10T18:00:00Z"))).toBe(5);
    expect(bangkokDay(new Date("2026-09-10T10:00:00Z"))).toBe(4);
  });
});

describe("shouldRun", () => {
  const thursday = new Date("2026-09-10T10:00:00Z"); // Thu in Bangkok
  it("runs only when enabled, on a configured day, with platforms and quota left", () => {
    expect(shouldRun(cfg({ days: [4] }), { now: thursday, runsThisWeek: 0 })).toEqual({ run: true });
    expect(shouldRun(cfg({ enabled: false }), { now: thursday, runsThisWeek: 0 })).toEqual({ run: false, reason: "disabled" });
    expect(shouldRun(cfg({ days: [1] }), { now: thursday, runsThisWeek: 0 })).toEqual({ run: false, reason: "off_day" });
    expect(shouldRun(cfg({ days: [4], platforms: [] }), { now: thursday, runsThisWeek: 0 })).toEqual({ run: false, reason: "no_platforms" });
    expect(shouldRun(cfg({ days: [4], max_runs_per_week: 2 }), { now: thursday, runsThisWeek: 2 })).toEqual({ run: false, reason: "weekly_cap" });
  });
});

describe("choosePillar", () => {
  const pillars: PillarConfig[] = [
    { key: "detective_knowledge", target_pct: 25 },
    { key: "case_story", target_pct: 50 },
    { key: "service", target_pct: 25 },
  ];
  it("honours a fixed pillar", () => {
    expect(choosePillar(cfg({ pillar_mode: "fixed", pillar: "service" }), pillars, {})).toBe("service");
    // fixed with no pillar falls back to rotation
    expect(choosePillar(cfg({ pillar_mode: "fixed", pillar: null }), pillars, {})).toBe("case_story");
  });
  it("picks the largest shortfall against the target share", () => {
    expect(choosePillar(cfg(), pillars, {})).toBe("case_story"); // no history → biggest target share
    expect(choosePillar(cfg(), pillars, { detective_knowledge: 10 })).toBe("case_story");
    expect(choosePillar(cfg(), pillars, { case_story: 10 })).toBe("detective_knowledge");
    // case_story is at 50% of 4 posts = its target, service has none → service
    expect(choosePillar(cfg(), pillars, { case_story: 2, detective_knowledge: 2 })).toBe("service");
  });
});

describe("buildBrief", () => {
  it("puts the most-asked customer questions in the brief, capped at eight", () => {
    const qs = Array.from({ length: 12 }, (_, i) => ({ question: `คำถามข้อ ${i}`, frequency: i }));
    const brief = buildBrief("service", qs);
    expect(brief).toContain("service");
    expect(brief).toContain("คำถามข้อ 11 (ถูกถาม 11 ครั้ง)");
    expect(brief).not.toContain("คำถามข้อ 0");
    expect(brief.match(/^\d+\. /gm)).toHaveLength(8);
  });
  it("works with no questions at all", () => {
    const brief = buildBrief("case_story", []);
    expect(brief).toContain("case_story");
    expect(brief).not.toContain("คำถามที่ลูกค้าถามบ่อย");
  });
});
