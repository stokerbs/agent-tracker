import { describe, expect, it } from "vitest";
import { ACCENT_ASS, assTime, buildAss, CAPTION_Y, emphasize, escapeAss, nameCardWindow } from "./ass";
import { buildFfmpegArgs, escapeFilterPath, PRESENTER_ZOOM, runFfmpeg, STORY_FADE_SEC, TRANSITIONS, XFADE_SEC } from "./ffmpeg";
import { CAPTION_LINE_MAX, captionChunks, HOOK_LINE_MAX, layoutShots, mp3DurationSec, parseVideoFormat, resolveShotImages, SHOT_PAD_SEC, SILENT_SHOT_SEC, SUBTITLE_LINE_MAX, SUBTITLE_LINE_TARGET, subtitleLines, subtitleWidth, timeSubtitles, totalDuration, type TimedShot } from "./timeline";
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

describe("resolveShotImages (storyteller)", () => {
  const presenterImg = { id: "presenter", kind: "image", meta: { target: { kind: "presenter" } } };
  const planOf = (n: number): CreativePlan => ({
    shots: Array.from({ length: n }, (_, i) => ({ start_sec: i, end_sec: i + 1, voice: `ฉาก ${i}`, visual: "", text_overlay: null })),
    broll: [],
    text_overlays: [],
  });
  const story = { format: "storyteller" as const };
  it("the presenter opens, closes and carries the even shots; odd shots cut away", () => {
    const r5 = resolveShotImages(planOf(5), [...images, presenterImg], story);
    if ("error" in r5) throw new Error(r5.error);
    expect(r5.map((s) => s.role)).toEqual(["presenter", "broll", "presenter", "broll", "presenter"]);
    // the last shot is always the presenter, even on an odd index
    const r4 = resolveShotImages(planOf(4), [...images, presenterImg], story);
    if ("error" in r4) throw new Error(r4.error);
    expect(r4.map((s) => s.role)).toEqual(["presenter", "broll", "presenter", "presenter"]);
    expect(r4.filter((s) => s.role === "presenter").every((s) => s.imageAssetId === "presenter")).toBe(true);
  });
  it("a cut-away uses that scene's image, else the cover, else stays on the presenter", () => {
    const s3 = { id: "s3", kind: "image", meta: { target: { kind: "scene", index: 3 } } };
    const r = resolveShotImages(planOf(5), [presenterImg, images[0], images[1], s3], story);
    if ("error" in r) throw new Error(r.error);
    // shot 2 has a scene image, but even shots belong to the presenter
    expect(r.map((s) => s.imageAssetId)).toEqual(["presenter", "cover", "presenter", "s3", "presenter"]);
    const alone = resolveShotImages(planOf(3), [presenterImg], story);
    if ("error" in alone) throw new Error(alone.error);
    expect(alone.map((s) => [s.imageAssetId, s.role])).toEqual([["presenter", "presenter"], ["presenter", "presenter"], ["presenter", "presenter"]]);
  });
  it("refuses a storyteller render without a presenter image", () => {
    expect(resolveShotImages(planOf(3), images, story)).toMatchObject({ error: expect.stringContaining("นักสืบนิรนาม") });
  });
  it("the template never uses a presenter image, even first in the list or as the only thumbnail", () => {
    const first = resolveShotImages(plan, [presenterImg, images[1]]);
    if ("error" in first) throw new Error(first.error);
    expect(first.map((s) => s.imageAssetId)).toEqual(["s2", "s2", "s2"]);
    expect(first.every((s) => s.role === undefined)).toBe(true);
    const thumbPresenter = { id: "p-thumb", kind: "thumbnail", meta: { target: { kind: "presenter" } } };
    const fallback = resolveShotImages(plan, [thumbPresenter, { id: "plain", kind: "image", meta: null }], { format: "template" });
    if ("error" in fallback) throw new Error(fallback.error);
    expect(fallback.map((s) => s.imageAssetId)).toEqual(["plain", "plain", "plain"]);
  });
  it("the template explains the missing images when only presenter images exist", () => {
    expect(resolveShotImages(plan, [presenterImg, { ...presenterImg, id: "p2", kind: "thumbnail" }])).toMatchObject({ error: expect.stringContaining("รูป") });
  });
});

describe("parseVideoFormat", () => {
  it("accepts only the exact string storyteller", () => {
    expect(parseVideoFormat("storyteller")).toBe("storyteller");
    for (const v of ["template", "Storyteller", " storyteller", "", "alternate", undefined, null, 1, true, ["storyteller"], { format: "storyteller" }]) {
      expect(parseVideoFormat(v)).toBe("template");
    }
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

describe("captions (viral template: one line at a time)", () => {
  // Narration from clips the studio actually produced, where the first chunker dropped spaces and cut words.
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
  it.each(REAL)("keeps every word and space of real narration, one short line per cue: %s", (voice) => {
    const cues = captionChunks(voice);
    // in order and contiguous: an original space may only disappear where one cue ends and the next begins
    let pos = 0;
    for (const cue of cues) {
      if (voice[pos] === " ") pos += 1;
      expect(voice.slice(pos, pos + cue.length)).toBe(cue);
      pos += cue.length;
      expect(cue).not.toContain("\n");
      expect(subtitleWidth(cue)).toBeLessThanOrEqual(CAPTION_LINE_MAX);
      expect(cue).not.toMatch(/^[ๆ,.!?;:)"]/);
    }
    expect(pos).toBe(voice.length);
    for (const whole of ["หลักฐาน", "แต่ละ", "พื้นที่", "จริง ๆ", "LINE @detectivepluse", '"ใช่หรือไม่ใช่"']) {
      if (voice.includes(whole)) expect(cues.some((c) => c.includes(whole))).toBe(true);
    }
  });
  it("splits a long phrase into balanced parts, never leaving a one-word stub", () => {
    // The hook and captions of a real clip: filling each line to the brim left "…อย่าง" / "เดียว" and "…เรื่อง" / "คน".
    const hook = "คนส่วนใหญ่รู้จักนักสืบจากเคสนอกใจอย่างเดียว ทั้งที่งานอีกครึ่งหนึ่งเป็นเรื่องเงินกับเรื่องคน";
    for (const lines of [subtitleLines(hook, { target: 14, max: HOOK_LINE_MAX }), captionChunks(hook)]) {
      expect(lines.join("").replace(/\s+/g, "")).toBe(hook.replace(/\s+/g, ""));
      for (const l of lines) expect(subtitleWidth(l)).toBeGreaterThanOrEqual(8);
      expect(lines).not.toContain("เดียว");
      expect(lines).not.toContain("คน");
    }
    // a negation starts the next part instead of dangling at the end of this one
    expect(captionChunks("เรื่องเล่าที่รายละเอียดไม่เท่ากันในแต่ละครั้ง")).toEqual(["เรื่องเล่าที่รายละเอียด", "ไม่เท่ากันในแต่ละครั้ง"]);
  });
  it("keeps the 30-grapheme caption ceiling and finds clause openers ahead of the balanced cut", () => {
    // With a lower ceiling this narration became "คือกระบวนการตรวจ" / "สอบ".
    expect(captionChunks(REAL[6])).toEqual(["ใครที่การันตีว่าจะเจอ", "เท่ากับกำลังบอกว่าเขารู้คำตอบก่อนลงพื้นที่", "ซึ่งไม่มีใครรู้", "สิ่งที่เราขายคือกระบวนการตรวจสอบ", "และรายงานตามข้อเท็จจริงที่เห็น", "ไม่ใช่คำรับประกันผลลัพธ์"]);
    // The same words without spaces go through splitPhrase, whose look-ahead lands the cuts on และ and ไม่.
    expect(captionChunks("สิ่งที่เราขายคือกระบวนการตรวจสอบและรายงานตามข้อเท็จจริงที่เห็นไม่ใช่คำรับประกันผลลัพธ์")).toEqual(["สิ่งที่เราขายคือกระบวนการตรวจสอบ", "และรายงานตามข้อเท็จจริงที่เห็น", "ไม่ใช่คำรับประกันผลลัพธ์"]);
  });
  it("splits a phrase wider than a line just before a clause opener, adding no spaces", () => {
    const phrase = "เราตรวจสอบข้อมูลทุกอย่างอย่างละเอียดและรายงานผลตามข้อเท็จจริงที่พบจริงเท่านั้นเสมอ";
    expect(subtitleWidth(phrase)).toBeGreaterThan(SUBTITLE_LINE_MAX);
    const lines = subtitleLines(phrase);
    expect(lines.join("")).toBe(phrase);
    expect(lines.some((l) => l.startsWith("และ"))).toBe(true);
    for (const l of lines) expect(subtitleWidth(l)).toBeLessThanOrEqual(SUBTITLE_LINE_MAX);
  });
  it("cuts only between graphemes when a single token is wider than a line, and ignores blank input", () => {
    const token = "ก".repeat(90);
    const lines = subtitleLines(token);
    expect(lines.join("")).toBe(token);
    for (const l of lines) expect(subtitleWidth(l)).toBeLessThanOrEqual(SUBTITLE_LINE_MAX);
    expect(captionChunks("   ")).toEqual([]);
  });
  it("keeps ๆ with its word even when the line before it is already full", () => {
    const lead = "ตรวจสอบข้อมูลอย่างละเอียดจริง";
    // precondition: joining " ๆ" onto this line would overflow the target, so only space protection can keep ๆ attached
    expect(subtitleWidth(`${lead} ๆ`)).toBeGreaterThan(SUBTITLE_LINE_TARGET);
    const text = `${lead} ๆ ก่อนสรุปผลทุกครั้ง`;
    const lines = subtitleLines(text);
    for (const l of lines) expect(l).not.toMatch(/^ๆ/);
    expect(lines.some((l) => l.endsWith("จริง ๆ"))).toBe(true);
    expect(lines.join(" ")).toBe(text);
    expect(lines.join("")).not.toContain("\u00A0");
  });
  it("times one cue per caption line inside the narration window", () => {
    const shot: TimedShot = { index: 0, voice: "สั้น สั้น สั้น, ยาวกว่าเดิมมากหน่อยนะครับผม", visual: "", imageAssetId: "c", voiceSec: 6, audioPath: "/a.mp3", imagePath: "/c.png", start: 10, duration: 6.35 };
    const cues = timeSubtitles(shot);
    expect(cues.map((c) => c.text)).toEqual(captionChunks(shot.voice));
    expect(cues[0].start).toBe(10);
    expect(cues[cues.length - 1].end).toBeCloseTo(16, 2);
    for (let i = 1; i < cues.length; i++) expect(cues[i].start).toBeGreaterThanOrEqual(cues[i - 1].end - 0.001);
    expect(timeSubtitles({ ...shot, voiceSec: 0, voice: "" })).toEqual([]);
  });
});

describe("ASS builder (viral template)", () => {
  const on = `{\\c${ACCENT_ASS}}`;
  const off = "{\\c&HFFFFFF&}";
  it("formats times and escapes braces/backslashes", () => {
    expect(assTime(0)).toBe("0:00:00.00");
    expect(assTime(3725.456)).toBe("1:02:05.46");
    expect(escapeAss("a{b}\\c\nd")).toBe("ab＼c\\Nd");
    expect(escapeAss("x\ry\u0000z")).toBe("x\\Nyz"); // bare CR and NUL cannot end the Dialogue line
  });
  it("emits a brand tag, a slamming hook card and one popping caption line per cue", () => {
    const shots: TimedShot[] = [
      { index: 0, voice: "ความรู้สึกไม่ใช่หลักฐาน แต่เป็นจุดเริ่มต้นที่ควรเก็บข้อมูลอย่างมีระบบ", visual: "", imageAssetId: "c", voiceSec: 4, audioPath: "/a.mp3", imagePath: "/c.png", start: 0, duration: 4.35 },
      { index: 1, voice: "", visual: "", imageAssetId: "c", voiceSec: 0, audioPath: null, imagePath: "/c.png", start: 4.35, duration: 3 },
    ];
    const ass = buildAss({ shots, hook: "ความรู้สึกไม่ใช่หลักฐาน" });
    expect(ass).toContain("WrapStyle: 2");
    const fields = (style: string) => ass.match(new RegExp(`^Style: ${style},(.*)$`, "m"))![1].split(",");
    for (const style of ["Cap", "Hook", "Tag"]) expect(fields(style)[0]).toBe("Sarabun");
    // letter spacing makes libass drop Thai tone marks: every style that renders Thai keeps Spacing 0
    expect(fields("Cap")[12]).toBe("0");
    expect(fields("Hook")[12]).toBe("0");
    // the hook card is one box per event with a transparent outline (no blob above stacked marks)
    expect(fields("Hook")[14]).toBe("4");
    expect(fields("Hook")[4]).toBe("&HFF000000");
    expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:07.35,Tag,,0,0,0,,{\\an8\\pos(540,34)}DETECTIVE PULSE");
    const hookLine = ass.split("\n").find((l) => l.includes(",Hook,,"))!;
    expect(hookLine).toMatch(/^Dialogue: 2,0:00:00\.00,0:00:02\.50,Hook,/);
    expect(hookLine).toContain("\\t(0,170,\\fscx100\\fscy100\\frz-2)}ความรู้สึกไม่ใช่หลักฐาน");
    const caps = ass.split("\n").filter((l) => l.includes(",Cap,,"));
    expect(caps).toHaveLength(timeSubtitles(shots[0]).length + timeSubtitles(shots[1]).length);
    expect(caps.length).toBeGreaterThan(1);
    for (const c of caps) {
      expect(c).toContain(`\\pos(540,${CAPTION_Y})`);
      expect(c.split(",Cap,,0,0,0,,")[1]).not.toContain("\\N"); // one line at a time
    }
    expect(caps[0]).toContain(`${on}ไม่ใช่${off}${on}หลักฐาน${off}`);
    expect(buildAss({ shots, hook: null })).not.toContain(",Hook,,");
  });
  it("highlights key words and numbers without splitting a Thai syllable or re-matching its own tags", () => {
    expect(emphasize("3 สิ่งที่นักสืบดู")).toBe(`${on}3${off} สิ่งที่${on}นักสืบ${off}ดู`);
    expect(emphasize("นี่คือความจริง")).toBe(`นี่คือ${on}ความจริง${off}`); // ความ|จริง joined: the longest key word wins over จริง
    expect(emphasize("ไม่ใช่หลักฐาน")).toBe(`${on}ไม่ใช่${off}${on}หลักฐาน${off}`); // หลัก|ฐาน joined back
    expect(emphasize("ค่าบริการ 1,500 บาท")).toBe(`ค่าบริการ ${on}1,500${off} บาท`);
    // a key word inside another word is never coloured, so no colour change can split a syllable
    for (const word of ["โทรกลับมา", "สลับ", "ตลับ", "จริงจัง", "แลับ", "จริง่"]) expect(emphasize(word)).toBe(word);
    // text that tries to smuggle an override tag is escaped first, so no user tag survives
    expect(emphasize(escapeAss("{\\c&H0000FF&}ปลอม"))).not.toContain("{\\c&H0000FF&}");
  });
  it("wraps a long hook itself, since libass auto-wrap is off", () => {
    const shots: TimedShot[] = [{ index: 0, voice: "ข้อความ", visual: "", imageAssetId: "c", voiceSec: 3, audioPath: null, imagePath: "/c.png", start: 0, duration: 3.35 }];
    const hookParts = (hook: string) => buildAss({ shots, hook }).split("\n").find((l) => l.includes(",Hook,,"))!.split(",Hook,,0,0,0,,")[1].replace(/^\{[^}]*\}/, "").split("\\N");
    const hook = "สิ่งที่นักสืบไม่เคยบอกลูกค้าตรง ๆ คือหลักฐานที่ดีที่สุดมักมาจากเรื่องเล็ก ๆ ที่ทุกคนมองข้าม";
    const parts = hookParts(hook);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(subtitleWidth(p)).toBeLessThanOrEqual(HOOK_LINE_MAX);
    expect(parts.join("").replace(/\s+/g, "")).toBe(hook.replace(/\s+/g, ""));
    // one phrase wider than a hook line but narrower than a subtitle line: only the hook limit splits it
    const phrase = "ความรู้สึกไม่ใช่หลักฐานแต่เป็นจุดเริ่มต้นที่ควรจดไว้";
    expect(subtitleWidth(phrase)).toBeGreaterThan(HOOK_LINE_MAX);
    expect(subtitleWidth(phrase)).toBeLessThanOrEqual(SUBTITLE_LINE_MAX);
    const split = hookParts(phrase);
    expect(split.length).toBeGreaterThan(1);
    for (const p of split) expect(subtitleWidth(p)).toBeLessThanOrEqual(HOOK_LINE_MAX);
  });
  it("joins phrases up to the target it is given", () => {
    expect(subtitleLines("ข้อหนึ่ง ข้อสอง ข้อสาม")).toHaveLength(1);
    expect(subtitleLines("ข้อหนึ่ง ข้อสอง ข้อสาม", { target: 6 }).length).toBeGreaterThan(1);
  });
});

describe("ffmpeg args (viral template)", () => {
  const shot = (i: number, start: number, duration: number, audioPath: string | null, imagePath: string): TimedShot => ({ index: i, voice: audioPath ? "x" : "", visual: "", imageAssetId: "c", voiceSec: audioPath ? duration - 0.35 : 0, audioPath, imagePath, start, duration });
  it("pads shots, aligns rotating transitions with the narration, grades, adds the progress bar and captions", () => {
    const shots = [shot(0, 0, 4.35, "/t/vo-0.mp3", "/t/img-a.png"), shot(1, 4.35, 3, null, "/t/img-b.png"), shot(2, 7.35, 2.5, "/t/vo-2.mp3", "/t/img-a.png")];
    const { args, summary } = buildFfmpegArgs({ shots, assPath: "/t/subs.ass", fontsDir: "/f/fonts", outPath: "/t/out.mp4" });
    expect(args.filter((a) => a === "-loop")).toHaveLength(3);
    expect(args.filter((a) => a === "-i")).toHaveLength(5); // 3 images + 2 narration tracks
    // every shot but the last runs one transition longer, so the overlap never shifts the audio
    expect(args.flatMap((a, i) => (a === "-t" ? [args[i + 1]] : []))).toEqual([(4.35 + XFADE_SEC).toFixed(3), (3 + XFADE_SEC).toFixed(3), "2.500"]);
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("zoompan=");
    // each padded input is also trimmed to its padded length, or the picture would run short of the narration
    for (const len of ["4.600", "3.250", "2.500"]) expect(fc).toContain(`trim=duration=${len},`);
    // xfade in ffmpeg 7 (Linux/Vercel) needs a constant frame rate on every input
    for (let i = 0; i < 3; i++) expect(fc).toContain(`setsar=1,fps=30[v${i}]`);
    // lighter zoompan canvas + x264 preset keep long renders inside the 240 s ffmpeg timeout on one vCPU
    expect(fc).toContain("scale=1620:2880:force_original_aspect_ratio=increase,crop=1620:2880,zoompan=");
    expect(args[args.indexOf("-preset") + 1]).toBe("superfast");
    expect(fc).toContain(`[v0][v1]xfade=transition=${TRANSITIONS[0]}:duration=${XFADE_SEC}:offset=4.350[x1]`);
    expect(fc).toContain(`[x1][v2]xfade=transition=${TRANSITIONS[1]}:duration=${XFADE_SEC}:offset=7.350[x2]`);
    expect(fc).toContain("[x2]eq=saturation=1.18:contrast=1.06");
    expect(fc).toContain("color=c=0xFFD400:s=1080x14:r=30:d=9.850[bar]");
    expect(fc).toContain("[graded][bar]overlay=x='-w+w*t/9.850':y=0:eval=frame[barred]");
    expect(fc).toContain("[3:a]aresample=44100,apad=whole_dur=4.350");
    expect(fc).toContain("anullsrc=r=44100:cl=stereo,atrim=duration=3.000");
    expect(fc).toContain("[4:a]aresample=44100,apad=whole_dur=2.500");
    expect(fc).toContain("[a0][a1][a2]concat=n=3:v=0:a=1[acat]");
    expect(fc).toContain("[barred]ass='/t/subs.ass':fontsdir='/f/fonts':shaping=complex[vout]"); // tone marks need HarfBuzz
    expect(args).toEqual(expect.arrayContaining(["libx264", "aac", "/t/out.mp4", "-nostdin"]));
    expect(args.indexOf("-y")).toBeLessThan(args.indexOf("-i"));
    expect(summary).toContain("3 shots, 2 narration tracks, 2 transitions");
  });
  it("renders a single shot without any transition", () => {
    const { args } = buildFfmpegArgs({ shots: [shot(0, 0, 2.35, "/t/vo.mp3", "/t/i.png")], assPath: "/t/s.ass", fontsDir: "/f", outPath: "/t/o.mp4" });
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).not.toContain("xfade");
    expect(fc).toContain("[v0]eq=saturation=1.18");
    expect(args[args.indexOf("-t") + 1]).toBe("2.350");
  });
  it("escapes filter-sensitive characters in paths", () => {
    expect(escapeFilterPath("C:/x'y")).toBe("C\\:/x\\'y");
  });
});

const roleShot = (i: number, start: number, duration: number, audioPath: string | null, role?: "presenter" | "broll"): TimedShot => ({
  index: i,
  voice: audioPath ? "x" : "",
  visual: "",
  imageAssetId: role ?? "c",
  role,
  voiceSec: audioPath ? duration - 0.35 : 0,
  audioPath,
  imagePath: `/t/img-${role ?? "c"}.png`,
  start,
  duration,
});
const filterGraph = (args: string[]) => args[args.indexOf("-filter_complex") + 1];
const inputChain = (fc: string, i: number) => fc.split(";").find((f) => f.startsWith(`[${i}:v]`))!;
const PUNCH_IN = "z='if(lte(on,15),1+0.12*(1-pow(1-on/15,3)),min(1.12+0.0007*(on-15),1.3))'";

describe("ffmpeg args (storyteller)", () => {
  const shots = [roleShot(0, 0, 4.35, "/t/vo-0.mp3", "presenter"), roleShot(1, 4.35, 3, null, "broll"), roleShot(2, 7.35, 2.5, "/t/vo-2.mp3", "presenter")];
  const build = (s: TimedShot[]) => buildFfmpegArgs({ shots: s, assPath: "/t/subs.ass", fontsDir: "/f/fonts", outPath: "/t/out.mp4", format: "storyteller" });
  it("fades between shots with the same padding and offsets as the template", () => {
    const { args, summary } = build(shots);
    expect(STORY_FADE_SEC).toBe(0.35);
    expect(args.flatMap((a, i) => (a === "-t" ? [args[i + 1]] : []))).toEqual([(4.35 + STORY_FADE_SEC).toFixed(3), (3 + STORY_FADE_SEC).toFixed(3), "2.500"]);
    const fc = filterGraph(args);
    expect(fc).toContain("[v0][v1]xfade=transition=fade:duration=0.35:offset=4.350[x1]");
    expect(fc).toContain("[x1][v2]xfade=transition=fade:duration=0.35:offset=7.350[x2]");
    for (const t of TRANSITIONS) expect(fc).not.toContain(`transition=${t}`);
    expect(fc).toContain("[x2]eq=saturation=1.05:contrast=1.08,drawbox=x=0:y=0:w=1080:h=14:color=black@0.35:t=fill[graded]");
    expect(fc).toContain("color=c=0xFFD400:s=1080x14:r=30:d=9.850[bar]");
    expect(fc).toContain("[graded][bar]overlay=x='-w+w*t/9.850':y=0:eval=frame[barred]");
    expect(summary).toContain("storyteller");
    expect(summary).toContain("3 shots, 2 narration tracks, 2 transitions, 2 presenter shots");
  });
  it("pushes in slowly on the presenter and keeps the drifting punch-in on b-roll", () => {
    const fc = filterGraph(build(shots).args);
    for (const i of [0, 2]) {
      expect(inputChain(fc, i)).toContain(`zoompan=z='${PRESENTER_ZOOM}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`);
      expect(inputChain(fc, i)).not.toContain(PUNCH_IN);
    }
    expect(PRESENTER_ZOOM).toBe("min(1+0.0004*on,1.08)");
    expect(inputChain(fc, 0)).toContain(`d=${Math.round((4.35 + STORY_FADE_SEC) * 30)}:`);
    expect(inputChain(fc, 1)).toContain(`${PUNCH_IN}:x='min(iw/2-(iw/zoom/2)+on*0.6,iw-iw/zoom)'`);
  });
  it("splits the narration into a waveform shown only over the presenter shots, then captions it", () => {
    const { args } = build(shots);
    const fc = filterGraph(args);
    expect(fc).toContain("[a0][a1][a2]concat=n=3:v=0:a=1,asplit=2[aout][aw]");
    expect(fc).toContain("[aw]showwaves=s=900x150:mode=cline:rate=30:colors=0xFFD400:scale=sqrt,format=rgba,colorchannelmixer=aa=0.85[wave]");
    expect(fc).toContain("[barred][wave]overlay=x=90:y=1340:enable='between(t,0.00,4.35)+between(t,7.35,9.85)'[waved]");
    expect(fc).toContain("[waved]ass='/t/subs.ass':fontsdir='/f/fonts':shaping=complex[vout]");
    expect(fc).not.toContain("[barred]ass=");
    expect(fc).not.toContain("[acat]");
    expect(args.flatMap((a, i) => (a === "-map" ? [args[i + 1]] : []))).toEqual(["[vout]", "[aout]"]);
  });
  it("leaves the waveform branch out when no shot is a presenter", () => {
    const { args, summary } = build([roleShot(0, 0, 4.35, "/t/vo-0.mp3", "broll"), roleShot(1, 4.35, 3, null)]);
    const fc = filterGraph(args);
    for (const part of ["showwaves", "asplit", "[waved]", "[aout]", PRESENTER_ZOOM]) expect(fc).not.toContain(part);
    expect(fc).toContain("[a0][a1]concat=n=2:v=0:a=1[acat]");
    expect(fc).toContain("[barred]ass='/t/subs.ass'");
    expect(fc).toContain("xfade=transition=fade:duration=0.35:offset=4.350[x1]");
    expect(args.flatMap((a, i) => (a === "-map" ? [args[i + 1]] : []))).toEqual(["[vout]", "[acat]"]);
    expect(summary).toContain("0 presenter shots");
  });
  it("keeps the template graph unchanged, even for shots that carry presenter roles", () => {
    const base = { shots, assPath: "/t/subs.ass", fontsDir: "/f/fonts", outPath: "/t/out.mp4" };
    const implicit = buildFfmpegArgs(base);
    expect(buildFfmpegArgs({ ...base, format: "template" }).args).toEqual(implicit.args);
    const fc = filterGraph(implicit.args);
    for (const part of ["showwaves", "asplit", "[waved]", "[aout]", "transition=fade", PRESENTER_ZOOM]) expect(fc).not.toContain(part);
    expect(inputChain(fc, 0)).toContain(PUNCH_IN);
    expect(fc).toContain(`[v0][v1]xfade=transition=${TRANSITIONS[0]}:duration=${XFADE_SEC}:offset=4.350[x1]`);
    expect(fc).toContain("[x2]eq=saturation=1.18:contrast=1.06");
    expect(fc).toContain("[a0][a1][a2]concat=n=3:v=0:a=1[acat];[barred]ass=");
    expect(implicit.summary).toContain("template");
  });
});

describe("ASS builder (storyteller)", () => {
  const hook = "ความรู้สึกไม่ใช่หลักฐาน";
  const shots = [roleShot(0, 0, 8, "/t/vo-0.mp3", "presenter"), roleShot(1, 8, 3, null, "broll"), roleShot(2, 11, 5, "/t/vo-2.mp3", "presenter")].map((s) => ({ ...s, voice: s.audioPath ? "ข้อแรก ตารางเวลาที่เปลี่ยนไป โดยไม่มีเหตุผลใหม่รองรับ" : "" }));
  const nameEvents = (ass: string) => ass.split("\n").filter((l) => l.includes(",Name,,"));
  it("adds the Name style and a slide-in name card with its accent bar after the hook", () => {
    const ass = buildAss({ shots, hook, format: "storyteller" });
    const style = ass.match(/^Style: Name,(.*)$/m)![1].split(",");
    expect(style[0]).toBe("Sarabun");
    expect(style[1]).toBe("64");
    expect(style[4]).toBe("&HFF000000"); // transparent outline
    expect(style[5]).toBe("&H59000000");
    expect(style[12]).toBe("0"); // letter spacing drops Thai tone marks
    expect(style[14]).toBe("4");
    expect(style[15]).toBe("22");
    expect(style[17]).toBe("4");
    const [card, bar, ...rest] = nameEvents(ass);
    expect(rest).toEqual([]);
    expect(card).toBe("Dialogue: 2,0:00:02.60,0:00:06.10,Name,,0,0,0,,{\\an4\\move(-420,1040,110,1040,0,260)\\fad(0,200)}นักสืบนิรนาม\\N{\\fs34\\c&H00D4FF&}DETECTIVE PULSE");
    expect(bar).toBe("Dialogue: 2,0:00:02.60,0:00:06.10,Name,,0,0,0,,{\\an4\\move(-460,1040,70,1040,0,260)\\fad(0,200)\\bord0\\shad0\\1c&H00D4FF&\\1a&H00&\\p1}m 0 -70 l 12 -70 l 12 70 l 0 70{\\p0}");
    // everything else (hook card, captions, brand tag, other styles) is the template's
    const withoutName = ass
      .split("\n")
      .filter((l) => !l.startsWith("Style: Name,") && !l.includes(",Name,,"))
      .join("\n");
    expect(withoutName).toBe(buildAss({ shots, hook }));
  });
  it("times the card on the first presenter shot, capped at its end, and skips it when under 1.5 s fits", () => {
    expect(nameCardWindow([roleShot(0, 0, 4, null, "broll"), roleShot(1, 4, 6, null, "presenter")])).toEqual({ start: 4, end: 7.5 });
    expect(nameCardWindow([roleShot(0, 0, 5, null, "presenter")])).toEqual({ start: 2.6, end: 5 });
    expect(nameCardWindow([roleShot(0, 0, 4.1, null, "presenter")])).toEqual({ start: 2.6, end: 4.1 }); // exactly 1.5 s fits
    expect(nameCardWindow([roleShot(0, 0, 4, null, "presenter"), roleShot(1, 4, 10, null, "presenter")])).toBeNull(); // only the first presenter shot counts
    expect(nameCardWindow([roleShot(0, 0, 10, null, "broll"), roleShot(1, 10, 3, null)])).toBeNull();
    const short = buildAss({ shots: [roleShot(0, 0, 4, null, "presenter")], hook, format: "storyteller" });
    expect(short).toContain("Style: Name,");
    expect(nameEvents(short)).toEqual([]);
    const late = buildAss({ shots: [roleShot(0, 0, 4, null, "broll"), roleShot(1, 4, 2, null, "presenter")], hook, format: "storyteller" });
    expect(nameEvents(late)[0]).toMatch(/^Dialogue: 2,0:00:04\.00,0:00:06\.00,Name,/);
  });
  it("emits no Name style or events for the template", () => {
    const ass = buildAss({ shots, hook });
    expect(ass).not.toContain("Name,Sarabun");
    expect(nameEvents(ass)).toEqual([]);
    expect(buildAss({ shots, hook, format: "template" })).toBe(ass);
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
