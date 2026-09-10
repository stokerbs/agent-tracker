import { describe, expect, it } from "vitest";
import { assTime, buildAss, escapeAss } from "./ass";
import { buildFfmpegArgs, escapeFilterPath } from "./ffmpeg";
import { chunkSubtitle, layoutShots, mp3DurationSec, resolveShotImages, SHOT_PAD_SEC, SILENT_SHOT_SEC, timeSubtitles, totalDuration, type TimedShot } from "./timeline";
import type { CreativePlan } from "@/lib/studio/types";

const plan: CreativePlan = {
  shots: [
    { start_sec: 0, end_sec: 3, voice: "ความรู้สึกไม่ใช่หลักฐาน แต่เป็นจุดเริ่มต้น", visual: "โต๊ะนักสืบ", text_overlay: null },
    { start_sec: 3, end_sec: 8, voice: "", visual: "ถนนกลางคืน", text_overlay: null },
    { start_sec: 8, end_sec: 12, voice: "สิ่งแรกที่เปลี่ยนคือตารางเวลา, ไม่ใช่คำพูด", visual: "นาฬิกา", text_overlay: null },
  ],
  broll: [],
  text_overlays: [],
};
const images = [
  { id: "cover", kind: "thumbnail", meta: { target: { kind: "thumbnail" } } },
  { id: "s2", kind: "image", meta: { target: { kind: "scene", index: 2 } } },
];

describe("resolveShotImages", () => {
  it("uses the scene image when present, else the cover", () => {
    const r = resolveShotImages(plan, images);
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.map((s) => s.imageAssetId)).toEqual(["cover", "cover", "s2"]);
      expect(r[1].voice).toBe("");
    }
  });
  it("explains missing shots / images", () => {
    expect(resolveShotImages({ shots: [], broll: [], text_overlays: [] }, images)).toMatchObject({ error: expect.stringContaining("shot list") });
    expect(resolveShotImages(plan, [])).toMatchObject({ error: expect.stringContaining("รูป") });
  });
});

describe("layoutShots / durations", () => {
  it("lays shots back-to-back: narration + pad, silent shots fixed length", () => {
    const laid = layoutShots([
      { index: 0, voice: "a", visual: "", imageAssetId: "c", voiceSec: 4, audioPath: "/a0.mp3", imagePath: "/c.png" },
      { index: 1, voice: "", visual: "", imageAssetId: "c", voiceSec: 0, audioPath: null, imagePath: "/c.png" },
      { index: 2, voice: "b", visual: "", imageAssetId: "c", voiceSec: 2.5, audioPath: "/a2.mp3", imagePath: "/c.png" },
    ]);
    expect("error" in laid).toBe(false);
    if (!("error" in laid)) {
      expect(laid.map((s) => [s.start, s.duration])).toEqual([[0, 4 + SHOT_PAD_SEC], [4 + SHOT_PAD_SEC, SILENT_SHOT_SEC], [4 + SHOT_PAD_SEC + SILENT_SHOT_SEC, 2.5 + SHOT_PAD_SEC]]);
      expect(totalDuration(laid)).toBeCloseTo(4 + SHOT_PAD_SEC + SILENT_SHOT_SEC + 2.5 + SHOT_PAD_SEC, 3);
    }
  });
  it("refuses videos beyond the cap", () => {
    const many = Array.from({ length: 24 }, (_, i) => ({ index: i, voice: "x", visual: "", imageAssetId: "c", voiceSec: 10, audioPath: "/a.mp3", imagePath: "/c.png" }));
    expect(layoutShots(many)).toMatchObject({ error: expect.stringContaining("เกินเพดาน") });
  });
  it("derives mp3 duration from the constant bitrate", () => {
    expect(mp3DurationSec(16000)).toBe(1);
    expect(mp3DurationSec(160000)).toBe(10);
  });
});

describe("subtitles", () => {
  it("chunks Thai narration at clause markers within the limit and hard-splits long runs", () => {
    const chunks = chunkSubtitle("สิ่งแรกที่เปลี่ยนคือตารางเวลา, ไม่ใช่คำพูด ที่คุณได้ยินทุกวัน");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(28 * 1.4);
    expect(chunks.join(" ").replace(/\s/g, "")).toBe("สิ่งแรกที่เปลี่ยนคือตารางเวลา,ไม่ใช่คำพูดที่คุณได้ยินทุกวัน");
    const run = chunkSubtitle("ก".repeat(70));
    expect(run.length).toBe(3);
    expect(run.every((c) => c.length <= 28)).toBe(true);
  });
  it("times cues proportionally inside the narration window", () => {
    const shot: TimedShot = { index: 0, voice: "สั้น สั้น สั้น, ยาวกว่าเดิมมากหน่อยนะครับผม", visual: "", imageAssetId: "c", voiceSec: 6, audioPath: "/a.mp3", imagePath: "/c.png", start: 10, duration: 6.35 };
    const cues = timeSubtitles(shot);
    expect(cues[0].start).toBe(10);
    expect(cues[cues.length - 1].end).toBeCloseTo(16, 2);
    for (let i = 1; i < cues.length; i++) expect(cues[i].start).toBeGreaterThanOrEqual(cues[i - 1].end - 0.001);
    expect(timeSubtitles({ ...shot, voiceSec: 0, voice: "" })).toEqual([]);
  });
});

describe("ASS builder", () => {
  it("formats times and escapes braces/backslashes", () => {
    expect(assTime(0)).toBe("0:00:00.00");
    expect(assTime(65.5)).toBe("0:01:05.50");
    expect(escapeAss("a{b}\\c\nd")).toBe("ab＼c\\Nd");
    expect(escapeAss("x\ry\u0000z")).toBe("x\\Nyz"); // bare CR and NUL cannot end the Dialogue line
  });
  it("emits a hook overlay for the first 2.5 s and one dialogue line per cue", () => {
    const shots: TimedShot[] = [
      { index: 0, voice: "ประโยคแรกที่ยาวพอจะแยกเป็นสองบรรทัด, ประโยคสองซึ่งยาวเช่นกัน", visual: "", imageAssetId: "c", voiceSec: 4, audioPath: "/a.mp3", imagePath: "/c.png", start: 0, duration: 4.35 },
      { index: 1, voice: "", visual: "", imageAssetId: "c", voiceSec: 0, audioPath: null, imagePath: "/c.png", start: 4.35, duration: 3 },
    ];
    const ass = buildAss({ shots, hook: "ความรู้สึกไม่ใช่หลักฐาน" });
    expect(ass).toContain("Style: Sub,Sarabun");
    expect(ass).toContain("Dialogue: 1,0:00:00.00,0:00:02.50,Hook,,0,0,0,,ความรู้สึกไม่ใช่หลักฐาน");
    expect(ass.match(/Dialogue: 0,/g)?.length).toBe(2);
    expect(buildAss({ shots, hook: null })).not.toContain("Hook,,");
  });
});

describe("ffmpeg args", () => {
  it("builds one looping image input per shot, narration inputs only where present, concat + subtitles, x264/aac", () => {
    const shots: TimedShot[] = [
      { index: 0, voice: "a", visual: "", imageAssetId: "c", voiceSec: 4, audioPath: "/t/vo-0.mp3", imagePath: "/t/img-c.png", start: 0, duration: 4.35 },
      { index: 1, voice: "", visual: "", imageAssetId: "c", voiceSec: 0, audioPath: null, imagePath: "/t/img-c.png", start: 4.35, duration: 3 },
    ];
    const { args, summary } = buildFfmpegArgs({ shots, assPath: "/t/subs.ass", fontsDir: "/f/fonts", outPath: "/t/out.mp4" });
    expect(args.filter((a) => a === "-loop")).toHaveLength(2);
    expect(args.filter((a) => a === "-i")).toHaveLength(3); // 2 images + 1 narration
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("zoompan=");
    expect(fc).toContain("[2:a]aresample=44100,apad=whole_dur=4.350");
    expect(fc).toContain("anullsrc=r=44100:cl=stereo,atrim=duration=3.000");
    expect(fc).toContain("concat=n=2:v=1:a=1[vcat][acat]");
    expect(fc).toContain("subtitles='/t/subs.ass':fontsdir='/f/fonts'");
    expect(args).toEqual(expect.arrayContaining(["libx264", "aac", "/t/out.mp4", "-nostdin"]));
    expect(args.indexOf("-y")).toBeLessThan(args.indexOf("-i"));
    expect(summary).toContain("2 shots, 1 narration");
  });
  it("escapes filter-sensitive characters in paths", () => {
    expect(escapeFilterPath("C:/x'y")).toBe("C\\:/x\\'y");
  });
});
