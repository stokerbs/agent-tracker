import { describe, expect, it } from "vitest";
import { assTime, buildAss, escapeAss } from "./ass";
import { buildFfmpegArgs, escapeFilterPath, runFfmpeg } from "./ffmpeg";
import { chunkSubtitle, HOOK_LINE_MAX, layoutShots, mp3DurationSec, resolveShotImages, SHOT_PAD_SEC, SILENT_SHOT_SEC, SUBTITLE_LINE_MAX, SUBTITLE_LINE_TARGET, SUBTITLE_MAX_LINES, subtitleLines, subtitleWidth, timeSubtitles, totalDuration, type TimedShot } from "./timeline";
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
  // Narration from clips the studio actually produced, where the old chunker dropped spaces and cut words.
  const REAL = [
    "ความรู้สึกไม่ใช่หลักฐาน แต่เป็นจุดเริ่มต้นที่ควรเก็บข้อมูลอย่างมีระบบ",
    "ข้อแรก ตารางเวลาที่เปลี่ยนไป โดยไม่มีเหตุผลใหม่รองรับ",
    "ข้อสาม เรื่องเล่าที่รายละเอียดไม่เท่ากันในแต่ละครั้ง นักสืบจะจดทุกเวอร์ชันแล้วเทียบกัน",
    "เราไม่เคยรับปากลูกค้าว่าจะเจอหลักฐานแน่นอน และนั่นเป็นเรื่องที่เราตั้งใจ",
    'คนที่ทักมาส่วนใหญ่ อยากได้คำตอบเดียว คือ "ใช่หรือไม่ใช่"',
    "แต่บางเคส เป้าหมายไม่มีอะไรให้เจอจริง ๆ เราเฝ้าดู เราตรวจสอบ แล้วผลออกมาว่าปกติ",
    "ใครที่การันตีว่าจะเจอ เท่ากับกำลังบอกว่าเขารู้คำตอบก่อนลงพื้นที่ ซึ่งไม่มีใครรู้ สิ่งที่เราขายคือกระบวนการตรวจสอบ และรายงานตามข้อเท็จจริงที่เห็น ไม่ใช่คำรับประกันผลลัพธ์",
    "ถ้าอยากรู้ว่าเคสของคุณควรเริ่มตรงไหน ปรึกษาเบื้องต้นได้ทาง LINE @detectivepluse",
  ];
  it.each(REAL)("keeps every word and space of real narration: %s", (voice) => {
    const cues = chunkSubtitle(voice);
    // nothing lost or reordered, and every original space is still a space or a line break
    expect(cues.map((c) => c.replace(/\n/g, " ")).join(" ")).toBe(voice);
    for (const cue of cues) {
      const lines = cue.split("\n");
      expect(lines.length).toBeLessThanOrEqual(SUBTITLE_MAX_LINES);
      for (const line of lines) {
        expect(subtitleWidth(line)).toBeLessThanOrEqual(SUBTITLE_LINE_MAX);
        expect(line).not.toMatch(/^[ๆ,.!?;:)"]/);
      }
    }
    for (const whole of ["หลักฐาน", "แต่ละ", "พื้นที่", "จริง ๆ", "LINE @detectivepluse", '"ใช่หรือไม่ใช่"']) {
      if (voice.includes(whole)) expect(cues.some((c) => c.split("\n").some((l) => l.includes(whole)))).toBe(true);
    }
  });
  it("puts a short lead-in and its phrase in one two-line cue", () => {
    expect(chunkSubtitle(REAL[2])).toEqual(["ข้อสาม\nเรื่องเล่าที่รายละเอียดไม่เท่ากันในแต่ละครั้ง", "นักสืบจะจดทุกเวอร์ชันแล้วเทียบกัน"]);
  });
  it("splits a phrase wider than a line just before a clause opener, adding no spaces", () => {
    const phrase = "เราตรวจสอบข้อมูลทุกอย่างอย่างละเอียดและรายงานผลตามข้อเท็จจริงที่พบจริงเท่านั้นเสมอ";
    expect(subtitleWidth(phrase)).toBeGreaterThan(SUBTITLE_LINE_MAX);
    const lines = chunkSubtitle(phrase).flatMap((c) => c.split("\n"));
    expect(lines.join("")).toBe(phrase);
    expect(lines.some((l) => l.startsWith("และ"))).toBe(true);
    for (const l of lines) expect(subtitleWidth(l)).toBeLessThanOrEqual(SUBTITLE_LINE_MAX);
  });
  it("cuts only between graphemes when a single token is wider than a line, and ignores blank input", () => {
    const token = "ก".repeat(90);
    const lines = chunkSubtitle(token).flatMap((c) => c.split("\n"));
    expect(lines.join("")).toBe(token);
    for (const l of lines) expect(subtitleWidth(l)).toBeLessThanOrEqual(SUBTITLE_LINE_MAX);
    expect(chunkSubtitle("   ")).toEqual([]);
  });
  it("keeps ๆ with its word even when the line before it is already full", () => {
    const lead = "ตรวจสอบข้อมูลอย่างละเอียดจริง";
    // precondition: joining " ๆ" onto this line would overflow the target, so only space protection can keep ๆ attached
    expect(subtitleWidth(`${lead} ๆ`)).toBeGreaterThan(SUBTITLE_LINE_TARGET);
    const text = `${lead} ๆ ก่อนสรุปผลทุกครั้ง`;
    const lines = chunkSubtitle(text).flatMap((c) => c.split("\n"));
    for (const l of lines) expect(l).not.toMatch(/^ๆ/);
    expect(lines.some((l) => l.endsWith("จริง ๆ"))).toBe(true);
    expect(lines.join(" ")).toBe(text);
    expect(lines.join("")).not.toContain("\u00A0");
  });
  it("keeps a call to action with its channel instead of flashing the handle alone", () => {
    expect(chunkSubtitle(REAL[7])).toEqual(["ถ้าอยากรู้ว่าเคสของคุณควรเริ่มตรงไหน", "ปรึกษาเบื้องต้นได้ทาง\nLINE @detectivepluse"]);
  });
  it("starts a cue at a clause opener instead of stranding it at the bottom of the previous cue", () => {
    expect(chunkSubtitle("การไม่เจออะไร ก็เป็นคำตอบ และสำหรับหลายคน มันคือคำตอบที่ทำให้หยุดคิดวนได้จริง")).toEqual([
      "การไม่เจออะไร ก็เป็นคำตอบ",
      "และสำหรับหลายคน\nมันคือคำตอบที่ทำให้หยุดคิดวนได้จริง",
    ]);
  });
  it("never leaves a short lead-in alone on screen", () => {
    expect(chunkSubtitle("ข้อสอง โทรศัพท์ที่ต้องอยู่ใกล้มือมากกว่าเดิม และหันหน้าจอลงเสมอ")[0]).toBe("ข้อสอง\nโทรศัพท์ที่ต้องอยู่ใกล้มือมากกว่าเดิม");
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
    expect(ass).toContain("WrapStyle: 2");
    // one box per cue (BorderStyle 4), not per glyph: per-glyph boxes notch under stacked Thai tone marks
    expect(ass).toMatch(/^Style: Sub,(?:[^,]*,){14}4,/m);
    expect(ass).toMatch(/^Style: Hook,(?:[^,]*,){14}4,/m);
    expect(ass.match(/Dialogue: 0,/g)?.length).toBe(timeSubtitles(shots[0]).length + timeSubtitles(shots[1]).length);
    expect(buildAss({ shots, hook: null })).not.toContain("Hook,,");
  });
  it("wraps a long hook itself, since libass auto-wrap is off", () => {
    const shots: TimedShot[] = [{ index: 0, voice: "ข้อความ", visual: "", imageAssetId: "c", voiceSec: 3, audioPath: null, imagePath: "/c.png", start: 0, duration: 3.35 }];
    const hook = "สิ่งที่นักสืบไม่เคยบอกลูกค้าตรง ๆ คือหลักฐานที่ดีที่สุดมักมาจากเรื่องเล็ก ๆ ที่ทุกคนมองข้าม";
    const line = buildAss({ shots, hook }).split("\n").find((l) => l.includes(",Hook,,"))!;
    const parts = line.split(",Hook,,0,0,0,,")[1].split("\\N");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(subtitleWidth(p)).toBeLessThanOrEqual(HOOK_LINE_MAX);
    expect(parts.join("").replace(/\s+/g, "")).toBe(hook.replace(/\s+/g, ""));
    // one phrase wider than a hook line but narrower than a subtitle line: only the hook limit splits it
    const phrase = "ความรู้สึกไม่ใช่หลักฐานแต่เป็นจุดเริ่มต้นที่ควรจดไว้";
    expect(subtitleWidth(phrase)).toBeGreaterThan(HOOK_LINE_MAX);
    expect(subtitleWidth(phrase)).toBeLessThanOrEqual(SUBTITLE_LINE_MAX);
    const hookLine = buildAss({ shots, hook: phrase }).split("\n").find((l) => l.includes(",Hook,,"))!;
    const hookParts = hookLine.split(",Hook,,0,0,0,,")[1].split("\\N");
    expect(hookParts.length).toBeGreaterThan(1);
    for (const p of hookParts) expect(subtitleWidth(p)).toBeLessThanOrEqual(HOOK_LINE_MAX);
  });
  it("joins phrases up to the target it is given", () => {
    expect(subtitleLines("ข้อหนึ่ง ข้อสอง ข้อสาม")).toHaveLength(1);
    expect(subtitleLines("ข้อหนึ่ง ข้อสอง ข้อสาม", { target: 6 }).length).toBeGreaterThan(1);
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
    expect(fc).toContain("ass='/t/subs.ass':fontsdir='/f/fonts':shaping=complex[vout]"); // tone marks need HarfBuzz
    expect(args).toEqual(expect.arrayContaining(["libx264", "aac", "/t/out.mp4", "-nostdin"]));
    expect(args.indexOf("-y")).toBeLessThan(args.indexOf("-i"));
    expect(summary).toContain("2 shots, 1 narration");
  });
  it("escapes filter-sensitive characters in paths", () => {
    expect(escapeFilterPath("C:/x'y")).toBe("C\\:/x\\'y");
  });
});

describe("runFfmpeg error mapping", () => {
  it("maps a non-zero exit, a timeout and a missing binary to clear errors", async () => {
    await expect(runFfmpeg(["-c", "echo boom >&2; exit 3"], { bin: "/bin/sh" })).rejects.toThrow(/ffmpeg exited 3: boom/);
    await expect(runFfmpeg(["5"], { bin: "/bin/sleep", timeoutMs: 50 })).rejects.toThrow(/timed out after 50 ms/);
    await expect(runFfmpeg([], { bin: "/definitely/not/here" })).rejects.toThrow(/failed to start/);
    await expect(runFfmpeg(["-c", "exit 0"], { bin: "/bin/sh" })).resolves.toMatchObject({ durationMs: expect.any(Number) });
  });
});

describe("subtitle breaker edge cases", () => {
  it("keeps the space when a short last word is pulled up onto the line above", () => {
    expect(subtitleLines("ตรวจสอบข้อมูลทุกอย่างอย่างละเอียด ครับ")).toEqual(["ตรวจสอบข้อมูลทุกอย่างอย่างละเอียด ครับ"]);
  });
  it("hard-splits a single token wider than a line between graphemes (WrapStyle 2 would let it overflow)", () => {
    expect(subtitleLines("a".repeat(90))).toEqual(["a".repeat(40), "a".repeat(40), "a".repeat(10)]);
    const url = `https://example.com/${"x".repeat(70)}`;
    const lines = subtitleLines(url);
    expect(lines.join("")).toBe(url);
    for (const l of lines) expect(subtitleWidth(l)).toBeLessThanOrEqual(SUBTITLE_LINE_MAX);
  });
  it("stays fast on a long run of glue characters", () => {
    const text = `หลักฐาน${",".repeat(20_000)}`;
    const t0 = performance.now();
    const lines = subtitleLines(text);
    expect(performance.now() - t0).toBeLessThan(2_000);
    expect(lines.join("")).toBe(text);
    for (const l of lines) expect(subtitleWidth(l)).toBeLessThanOrEqual(SUBTITLE_LINE_MAX);
  });
  it("times cues by visible width, not string length", () => {
    const voice = "ที่นี่ไม่ใช่เรื่องที่น่ากลัวเลยสักนิดเดียวนะครับ ถ้าอยากรู้ว่าเคสของคุณควรเริ่มตรงไหน ปรึกษาเบื้องต้นได้ทาง LINE detectivepluse";
    const shot: TimedShot = { index: 0, voice, visual: "", imageAssetId: "c", voiceSec: 12, audioPath: null, imagePath: "", start: 0, duration: 12.35 };
    const cues = timeSubtitles(shot);
    expect(cues.length).toBeGreaterThan(1);
    const visible = (s: string) => subtitleWidth(s.replace(/\s+/g, ""));
    const chars = (s: string) => s.replace(/\s+/g, "").length;
    const total = cues.reduce((n, c) => n + visible(c.text), 0);
    const totalChars = cues.reduce((n, c) => n + chars(c.text), 0);
    const first = cues[0];
    expect(first.end - first.start).toBeCloseTo((visible(first.text) / total) * 12, 2);
    // the fixture is mark-heavy enough that timing by .length would give a visibly different cut
    expect(Math.abs((chars(first.text) / totalChars) * 12 - (first.end - first.start))).toBeGreaterThan(0.05);
  });
});
