import { describe, expect, it } from "vitest";
import { creativePlanUserPrompt } from "./repurpose";

/**
 * The plan prompt is what makes one image per shot worth paying for: if two shots
 * share a visual idea, the extra images just repeat the same frame (docs §16).
 */
describe("creativePlanUserPrompt", () => {
  const prompt = creativePlanUserPrompt({ title: "ชื่อคลิป", pillar: "case_story", platform: "tiktok", script: "บรรทัดแรก", targetSeconds: 45 });

  it("asks for a distinct visual per shot", () => {
    expect(prompt).toContain("Every shot gets its OWN visual");
    expect(prompt).toContain("No two shots may share the same visual idea.");
  });

  it("passes the brief through", () => {
    expect(prompt).toContain("ชื่อคลิป");
    expect(prompt).toContain("บรรทัดแรก");
  });
});
