import { describe, expect, it } from "vitest";
import { aspectClassFor, assetFamily, formatBytes, formatMmSs, formatSeconds, kindLabel, truncate } from "./media-format";

describe("media-format helpers", () => {
  it("formats bytes in B / KB / MB with en-GB numerals", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(250_880)).toBe("245 KB");
    expect(formatBytes(1_258_291)).toBe("1.2 MB");
    expect(formatBytes(12_582_912)).toBe("12.0 MB");
  });

  it("formats durations as mm:ss", () => {
    expect(formatMmSs(null)).toBe("—");
    expect(formatMmSs(0)).toBe("00:00");
    expect(formatMmSs(61_400)).toBe("01:01");
    expect(formatMmSs(3_599_600)).toBe("60:00");
    expect(formatSeconds(75)).toBe("01:15");
  });

  it("truncates on code points and appends an ellipsis", () => {
    expect(truncate("", 5)).toBe("");
    expect(truncate("  สั้น ", 10)).toBe("สั้น");
    expect(truncate("ภาพมุมกว้างถนนตอนกลางคืน", 8)).toBe("ภาพมุมกว้า…");
    expect(truncate("abc def", 3)).toBe("abc…");
  });

  it("derives the aspect class from meta, then dimensions, then 16:9", () => {
    expect(aspectClassFor({ aspect: "9:16" }, null, null)).toBe("aspect-[9/16]");
    expect(aspectClassFor({ aspect: "1:1" }, 1920, 1080)).toBe("aspect-square");
    expect(aspectClassFor({ aspect: "bogus" }, 1080, 1920)).toBe("aspect-[9/16]");
    expect(aspectClassFor(null, 1080, 1350)).toBe("aspect-[4/5]");
    expect(aspectClassFor(null, 1000, 1000)).toBe("aspect-square");
    expect(aspectClassFor(null, null, null)).toBe("aspect-video");
    expect(aspectClassFor("not-an-object", 0, 0)).toBe("aspect-video");
  });

  it("groups asset kinds into image / audio / other", () => {
    expect(assetFamily("thumbnail")).toBe("image");
    expect(assetFamily("broll")).toBe("image");
    expect(assetFamily("audio")).toBe("audio");
    expect(assetFamily("video")).toBe("other");
    expect(kindLabel("thumbnail")).toBe("ภาพปก");
    expect(kindLabel("unknown_kind")).toBe("unknown_kind");
  });
});
