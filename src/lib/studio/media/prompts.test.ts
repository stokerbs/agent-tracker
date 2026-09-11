import { describe, expect, it } from "vitest";
import { buildImagePrompt, describeImageTarget, IMAGE_SAFETY_NEGATIVES, MAX_CUSTOM_PROMPT_CHARS, PRESENTER_SCENE, sceneText } from "./prompts";
import type { CreativePlan } from "@/lib/studio/types";

const plan: CreativePlan = {
  shots: [
    { start_sec: 0, end_sec: 3, voice: "hook", visual: "มือถือวางบนโต๊ะ ไฟสลัว", text_overlay: "3 วินาทีแรก" },
    { start_sec: 3, end_sec: 10, voice: "body", visual: "", text_overlay: null },
  ],
  broll: ["ถนนกลางคืน", "ไฟรถ", "นาฬิกา", "เกินสาม"],
  text_overlays: [],
  thumbnail_concept: "เงาคนยืนหน้าคอนโด ไฟสีอำพัน",
  music_mood: "tense",
};

describe("sceneText", () => {
  it("uses the thumbnail concept, falling back to the title", () => {
    expect(sceneText({ kind: "thumbnail" }, plan, "T")).toBe("เงาคนยืนหน้าคอนโด ไฟสีอำพัน");
    expect(sceneText({ kind: "thumbnail" }, null, "ชื่อคลิป")).toContain("ชื่อคลิป");
  });
  it("returns the shot visual with the overlay as a mood cue only", () => {
    const s = sceneText({ kind: "scene", index: 0 }, plan, "T")!;
    expect(s).toContain("มือถือวางบนโต๊ะ");
    expect(s).toContain("do not render the words");
  });
  it("returns null for a shot without a visual or out of range", () => {
    expect(sceneText({ kind: "scene", index: 1 }, plan, "T")).toBeNull();
    expect(sceneText({ kind: "scene", index: 9 }, plan, "T")).toBeNull();
  });
  it("uses the fixed silhouette scene for the presenter, regardless of the plan", () => {
    expect(sceneText({ kind: "presenter" }, plan, "T")).toBe(PRESENTER_SCENE);
    expect(sceneText({ kind: "presenter" }, null, "T")).toBe(PRESENTER_SCENE);
    expect(PRESENTER_SCENE).toMatch(/silhouette/i);
    expect(PRESENTER_SCENE).toMatch(/no facial features/i);
  });
  it("trims custom text to the cap", () => {
    expect(sceneText({ kind: "custom", text: "x".repeat(MAX_CUSTOM_PROMPT_CHARS + 50) }, null, "T")!.length).toBe(MAX_CUSTOM_PROMPT_CHARS);
    expect(sceneText({ kind: "custom", text: "   " }, null, "T")).toBeNull();
  });
});

describe("buildImagePrompt", () => {
  it("always appends the non-removable safety negatives and caps B-roll context at three", () => {
    const p = buildImagePrompt({ style: "", scene: "ฉาก", aspect: "9:16", broll: plan.broll, musicMood: "tense" });
    expect(p).toContain(IMAGE_SAFETY_NEGATIVES);
    expect(p).toContain("9:16");
    expect(p).toContain("ถนนกลางคืน; ไฟรถ; นาฬิกา");
    expect(p).not.toContain("เกินสาม");
    expect(p.startsWith("Cinematic documentary")).toBe(true); // default style when preset empty
  });
});

describe("describeImageTarget", () => {
  it("labels scenes with their time range", () => {
    expect(describeImageTarget({ kind: "scene", index: 0 }, plan)).toBe("ฉาก 1 (00:00–00:03)");
    expect(describeImageTarget({ kind: "thumbnail" }, plan)).toBe("ปก");
  });
  it("labels the storyteller presenter the same with or without a plan", () => {
    expect(describeImageTarget({ kind: "presenter" }, plan)).toBe("นักสืบนิรนาม (คนเล่าเรื่อง)");
    expect(describeImageTarget({ kind: "presenter" }, null)).toBe("นักสืบนิรนาม (คนเล่าเรื่อง)");
  });
});
