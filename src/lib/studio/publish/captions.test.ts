import { describe, expect, it } from "vitest";
import { assetMediaKind, buildCaption, buildYoutubeTitle, platformRequirement, truncateAtBoundary } from "./captions";

const master = { title: "GPS บอกอะไรได้บ้าง", caption: "แคปชันหลัก #สืบสวน", cta: "ปรึกษาทาง LINE @detectivepluse", hook: "สิ่งแรกที่นักสืบดูไม่ใช่รถ แต่คือเวลา" };

describe("buildCaption", () => {
  it("prefers the matching platform variant caption", () => {
    const text = buildCaption("instagram", { master, variants: [{ platform: "instagram_reel", caption: "แคปชัน IG เฉพาะ", hook: null }, { platform: "tiktok", caption: "TT", hook: null }] });
    expect(text).toBe("แคปชัน IG เฉพาะ");
  });
  it("falls back to master caption + CTA and ignores variants without caption", () => {
    const text = buildCaption("facebook", { master, variants: [{ platform: "facebook", caption: "   ", hook: null }] });
    expect(text).toBe("แคปชันหลัก #สืบสวน\n\nปรึกษาทาง LINE @detectivepluse");
  });
  it("truncates to the platform limit on a boundary with an ellipsis", () => {
    const long = Array.from({ length: 600 }, (_, i) => `คำ${i}`).join(" ");
    const text = buildCaption("tiktok", { master: { ...master, caption: long, cta: null }, variants: [] });
    expect(text.length).toBeLessThanOrEqual(2200);
    expect(text.endsWith("…")).toBe(true);
    expect(text).toMatch(/ คำ\d+…$/); // whole token kept before the ellipsis — cut on the space, not mid-word
  });
});

describe("buildYoutubeTitle / truncateAtBoundary", () => {
  it("uses the hook without hashtags, else the title, ≤ 100 chars", () => {
    expect(buildYoutubeTitle({ master: { ...master, hook: "#เทรนด์ ดูเวลาก่อนดูรถ #สืบ" }, variants: [] })).toBe("ดูเวลาก่อนดูรถ");
    expect(buildYoutubeTitle({ master: { ...master, hook: "สั้น" }, variants: [] })).toBe(master.title);
    expect(buildYoutubeTitle({ master: { ...master, hook: "ก".repeat(300) }, variants: [] }).length).toBeLessThanOrEqual(100);
  });
  it("returns short text untouched", () => {
    expect(truncateAtBoundary("  สั้น  ", 10)).toBe("สั้น");
  });
});

describe("platform media requirements", () => {
  it("classifies assets", () => {
    expect(assetMediaKind({ kind: "thumbnail", mime: "image/png" })).toBe("image");
    expect(assetMediaKind({ kind: "video", mime: "video/mp4" })).toBe("video");
    expect(assetMediaKind({ kind: "audio", mime: "audio/mpeg" })).toBe("none");
  });
  it("enforces per-platform rules", () => {
    expect(platformRequirement("facebook", [])).toBeNull();
    expect(platformRequirement("instagram", [])).toMatch(/Instagram/);
    expect(platformRequirement("instagram", ["image"])).toBeNull();
    expect(platformRequirement("tiktok", ["image", "image"])).toBeNull();
    expect(platformRequirement("tiktok", [])).toMatch(/TikTok/);
    expect(platformRequirement("youtube", ["image"])).toMatch(/YouTube/);
    expect(platformRequirement("youtube", ["video"])).toBeNull();
    expect(platformRequirement("facebook", ["video", "image"])).toMatch(/อย่างใดอย่างหนึ่ง/);
    expect(platformRequirement("facebook", Array(11).fill("image"))).toMatch(/10/);
  });
});
