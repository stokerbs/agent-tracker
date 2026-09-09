import { describe, expect, it } from "vitest";
import { PILLAR_META, PILLARS } from "@/lib/studio/constants";
import type { Pillar } from "@/lib/studio/types";
import { computeMixFlags } from "./mix";

const labels = Object.fromEntries(PILLARS.map((p) => [p, PILLAR_META[p].label])) as Record<Pillar, string>;
const targets = PILLARS.map((key) => ({ key, target_pct: key === "case_story" ? 30 : 14 }));
const counts = (over: Partial<Record<Pillar, number>>) =>
  Object.fromEntries(PILLARS.map((p) => [p, over[p] ?? 0])) as Record<Pillar, number>;

describe("computeMixFlags", () => {
  it("returns nothing when there is no content", () => {
    expect(computeMixFlags(counts({}), targets, labels)).toEqual([]);
  });
  it("flags a pillar ≥ 15 points over target", () => {
    // 6 of 10 = 60% case_story vs 30% target
    const flags = computeMixFlags(counts({ case_story: 6, detective_knowledge: 1, detective_pov: 1, red_flags: 1, service: 1 }), targets, labels);
    expect(flags.some((f) => f.includes("เรื่องจากเคส") && f.includes("60%"))).toBe(true);
  });
  it("flags empty pillars only once total ≥ 4", () => {
    expect(computeMixFlags(counts({ case_story: 3 }), targets, labels).some((f) => f.includes("ยังไม่มี"))).toBe(false);
    expect(computeMixFlags(counts({ case_story: 4 }), targets, labels).some((f) => f.includes("ยังไม่มี"))).toBe(true);
  });
  it("stays quiet for a balanced week", () => {
    const flags = computeMixFlags(counts({ case_story: 2, detective_knowledge: 1, detective_pov: 1, red_flags: 1, behind_investigation: 1, service: 1 }), targets, labels);
    expect(flags).toEqual([]);
  });
});
