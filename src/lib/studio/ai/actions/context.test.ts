import { describe, expect, it } from "vitest";
import { clampScore, resolveSourceRefs } from "./context";

const refs = {
  K1: { kind: "knowledge" as const, id: "k-1", title: "GPS", text: "", tags: [], score: 1 },
  K2: { kind: "case_insight" as const, id: "i-2", title: "รถอยู่ คนไม่อยู่", text: "", tags: [], score: 1 },
};

describe("resolveSourceRefs", () => {
  it("maps K ids to concrete refs and dedupes", () => {
    const out = resolveSourceRefs(["K1", "k2", "K1"], refs);
    expect(out).toEqual([
      { kind: "knowledge", id: "k-1", label: "GPS" },
      { kind: "case_insight", id: "i-2", label: "รถอยู่ คนไม่อยู่" },
    ]);
  });
  it("keeps ai_general as a warning ref and drops unknown ids", () => {
    const out = resolveSourceRefs(["ai_general", "K9", ""], refs);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("ai_general");
    expect(out[0].id).toBeNull();
  });
});

describe("clampScore", () => {
  it("clamps into 1..5 and defaults to 3", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(7)).toBe(5);
    expect(clampScore(3.6)).toBe(4);
    expect(clampScore("x")).toBe(3);
  });
});
