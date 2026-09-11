import type { CreativePlan, CreativeShot } from "@/lib/studio/types";

/**
 * Pure timeline maths for the template video: which image each shot uses,
 * how long each shot lasts (narration + pad), and subtitle chunking/timing.
 * No I/O — fully unit-tested.
 */

export const OUTPUT_W = 1080;
export const OUTPUT_H = 1920;
export const FPS = 30;
/** Silence after each shot's narration so cuts don't feel rushed. */
export const SHOT_PAD_SEC = 0.35;
/** Shots without narration (or when TTS is unavailable) still show for this long. */
export const SILENT_SHOT_SEC = 3;
export const HOOK_OVERLAY_SEC = 2.5;
export const MAX_SHOTS = 24;
export const MAX_TOTAL_SEC = 180;
/** Soft per-line target, in graphemes (Thai vowels and tone marks stack, so .length overstates width). */
export const SUBTITLE_LINE_TARGET = 24;
/** Hard per-line ceiling: about 720 px of Sarabun Bold 64, inside the 920 px safe area. */
export const SUBTITLE_LINE_MAX = 40;
/**
 * Viral captions (template v2) show one line at a time in Sarabun Bold 92 (about 780 px at the maximum).
 * Lines are short, but a phrase up to CAPTION_LINE_MAX stays whole: a smaller ceiling would make the breaker
 * split more phrases on ICU word boundaries, and ICU over-splits compounds such as หลัก|ฐาน and ลงพื้น|ที่.
 */
export const CAPTION_LINE_TARGET = 14;
export const CAPTION_LINE_MAX = 30;
/** Hook card lines (Sarabun Bold 88 on the yellow card). */
export const HOOK_LINE_TARGET = 14;
export const HOOK_LINE_MAX = 30;

export interface ShotSource {
  index: number;
  voice: string;
  visual: string;
  /** Asset id of the still to show. */
  imageAssetId: string;
}

export interface ImageCandidate {
  id: string;
  kind: string;
  meta: unknown;
}

/** Resolve the image for every shot: explicit scene image → cover (thumbnail) → any image, in that order. */
export function resolveShotImages(plan: CreativePlan, images: ImageCandidate[]): ShotSource[] | { error: string } {
  const shots = (plan.shots ?? []).slice(0, MAX_SHOTS);
  if (!shots.length) return { error: "creative plan ยังไม่มี shot list — สร้างแผนภาพก่อน" };
  if (!images.length) return { error: "ยังไม่มีรูปที่พร้อมใช้ — สร้างภาพปกหรือภาพฉากก่อน" };
  const byScene = new Map<number, string>();
  for (const img of images) {
    const t = (img.meta as { target?: { kind?: string; index?: number } } | null)?.target;
    if (t?.kind === "scene" && typeof t.index === "number" && !byScene.has(t.index)) byScene.set(t.index, img.id);
  }
  const cover = images.find((i) => i.kind === "thumbnail")?.id ?? images[0].id;
  return shots.map((s, i) => ({ index: i, voice: (s.voice ?? "").trim(), visual: (s.visual ?? "").trim(), imageAssetId: byScene.get(i) ?? cover }));
}

export interface TimedShot extends ShotSource {
  start: number;
  duration: number;
  /** Narration duration in seconds (0 when silent). */
  voiceSec: number;
  audioPath: string | null;
  imagePath: string;
}

/** Lay shots out back-to-back from their narration lengths. */
export function layoutShots(shots: (ShotSource & { voiceSec: number; audioPath: string | null; imagePath: string })[]): TimedShot[] | { error: string } {
  let t = 0;
  const out: TimedShot[] = [];
  for (const s of shots) {
    const duration = round3(s.voiceSec > 0 ? s.voiceSec + SHOT_PAD_SEC : SILENT_SHOT_SEC);
    out.push({ ...s, start: round3(t), duration });
    t += duration;
  }
  if (t > MAX_TOTAL_SEC) return { error: `วิดีโอยาว ${Math.round(t)} วินาที เกินเพดาน ${MAX_TOTAL_SEC} วินาที — ตัด shot หรือย่อสคริปต์` };
  return out;
}

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

let graphemeSegmenter: Intl.Segmenter | null = null;
let wordSegmenter: Intl.Segmenter | null = null;
function graphemes(text: string): string[] {
  graphemeSegmenter ??= new Intl.Segmenter("th", { granularity: "grapheme" });
  return Array.from(graphemeSegmenter.segment(text), (x) => x.segment);
}
function thaiWords(text: string): string[] {
  wordSegmenter ??= new Intl.Segmenter("th", { granularity: "word" });
  return Array.from(wordSegmenter.segment(text), (x) => x.segment);
}

/** Visual width of a subtitle line in graphemes. */
export function subtitleWidth(text: string): number {
  return graphemes(text).length;
}

const NBSP = "\u00A0";
/** Thai clause openers: breaking a line just before one never changes the meaning. */
const BREAK_BEFORE = new Set(["และ", "แต่", "หรือ", "ว่า", "ซึ่ง", "เพราะ", "ถ้า", "หาก", "โดย", "เมื่อ", "จึง", "แล้ว", "เพื่อ", "จน", "ส่วน", "ก็", "ไม่", "คือ"]);

/** Spaces that must never become a line break: before ๆ, before closing punctuation, after opening brackets, before a handle. */
function protectSpaces(text: string): string {
  return text
    .replace(/ +(?=ๆ)/g, NBSP)
    .replace(/ +(?=[,.!?;:)\]}”’…"])/g, NBSP)
    .replace(/(?<=[(\[{“‘]) +/g, NBSP)
    .replace(/ +(?=@)/g, NBSP);
}

function gluesToPrevious(segment: string): boolean {
  return segment === "ๆ" || segment.startsWith(NBSP) || /^[,.!?;:)\]}”’…"]/.test(segment);
}

/**
 * Split a space-free phrase wider than `max`. Thai writes words without spaces,
 * so cut only at word boundaries from the ICU segmenter, preferring the spot
 * just before a clause opener. A single token wider than a line (a long URL)
 * is the only thing ever cut between graphemes, and never inside one.
 */
/** Where a part that overflowed at segment `i` should end: just before a nearby clause opener, else at `i`. */
function clauseCut(segs: string[], widths: number[], start: number, i: number, width: number, limit: number, max: number): number {
  let prefix = width;
  for (let k = i - 1; k > start; k--) {
    prefix -= widths[k];
    if (BREAK_BEFORE.has(segs[k]) && prefix >= limit * 0.4) return k;
  }
  let ahead = width;
  for (let k = i; k + 1 < segs.length; k++) {
    ahead += widths[k];
    if (ahead > max) break;
    if (BREAK_BEFORE.has(segs[k + 1])) return k + 1;
  }
  return i;
}

function splitPhrase(phrase: string, max: number): string[] {
  // Word boundaries are grapheme boundaries, so segment widths add up: running sums keep this linear.
  const segs = thaiWords(phrase);
  const widths = segs.map((x) => subtitleWidth(x));
  const total = widths.reduce((n, w) => n + w, 0);
  // Aim for parts of equal width instead of filling each line to the brim, so a long phrase never ends on a
  // one-word stub ("…อย่าง" then "เดียว" alone). A little slack lets the cut land on a word boundary; max stays the ceiling.
  const limit = Math.min(max, Math.ceil(total / Math.max(1, Math.ceil(total / max))) + 3);
  const out: string[] = [];
  let start = 0;
  let width = 0;
  for (let i = 0; i < segs.length; i++) {
    // Glue (ๆ, closing punctuation) stays with the word before it, but a run of glue may not grow a part past 2 × max.
    if (i > start && width + widths[i] > limit && (!gluesToPrevious(segs[i]) || width + widths[i] > max * 2)) {
      const cut = clauseCut(segs, widths, start, i, width, limit, max);
      out.push(segs.slice(start, cut).join(""));
      if (cut > i) {
        // The cut looked ahead to a clause opener: segments i..cut-1 already went into this part.
        start = cut;
        width = 0;
        i = cut - 1;
        continue;
      }
      width = 0;
      for (let k = cut; k < i; k++) width += widths[k];
      start = cut;
    }
    width += widths[i];
  }
  if (start < segs.length) out.push(segs.slice(start).join(""));
  return out.flatMap((part) => {
    if (subtitleWidth(part) <= max) return [part];
    const g = graphemes(part);
    const parts: string[] = [];
    for (let i = 0; i < g.length; i += max) parts.push(g.slice(i, i + max).join(""));
    return parts;
  });
}

/**
 * Break narration into subtitle lines. Spaces are Thai phrase boundaries, so
 * lines break there first and every original space survives, either as a space
 * or as the line break itself. A phrase is only split internally when it is
 * wider than SUBTITLE_LINE_MAX, and such pieces never re-join with a fake space.
 */
export function subtitleLines(text: string, opts: { target?: number; max?: number } = {}): string[] {
  const target = opts.target ?? SUBTITLE_LINE_TARGET;
  const max = opts.max ?? SUBTITLE_LINE_MAX;
  const clean = protectSpaces(text.replace(/\s+/g, " ").trim());
  if (!clean) return [];
  const pieces: { text: string; afterSpace: boolean }[] = [];
  clean
    .split(" ")
    .filter(Boolean)
    .forEach((phrase, pi) => {
      const parts = subtitleWidth(phrase) > max ? splitPhrase(phrase, max) : [phrase];
      parts.forEach((part, i) => pieces.push({ text: part, afterSpace: pi > 0 && i === 0 }));
    });
  const lines: { text: string; afterSpace: boolean }[] = [];
  for (const piece of pieces) {
    const last = lines[lines.length - 1];
    if (last && piece.afterSpace && subtitleWidth(`${last.text} ${piece.text}`) <= target) last.text = `${last.text} ${piece.text}`;
    else lines.push({ ...piece });
  }
  // A lone short word on the last line reads like a stray fragment: pull it up when the line above has room.
  const tail = lines[lines.length - 1];
  const prev = lines[lines.length - 2];
  if (tail && prev && tail.afterSpace && subtitleWidth(tail.text) <= 6 && subtitleWidth(`${prev.text} ${tail.text}`) <= max) {
    prev.text = `${prev.text} ${tail.text}`;
    lines.pop();
  }
  return lines.map((l) => l.text.replace(/\u00A0/g, " "));
}

/** Caption lines for the viral template: one line on screen at a time. */
export function captionChunks(text: string): string[] {
  return subtitleLines(text, { target: CAPTION_LINE_TARGET, max: CAPTION_LINE_MAX });
}

export function timeSubtitles(shot: TimedShot): SubtitleCue[] {
  const chunks = captionChunks(shot.voice);
  if (!chunks.length || shot.voiceSec <= 0) return [];
  // Time by visible width, not string length: stacked Thai marks take no reading time.
  const weight = (c: string) => Math.max(1, subtitleWidth(c.replace(/\s+/g, "")));
  const total = chunks.reduce((n, c) => n + weight(c), 0);
  let t = shot.start;
  return chunks.map((c, i) => {
    const dur = (weight(c) / total) * shot.voiceSec;
    const start = t;
    const end = i === chunks.length - 1 ? shot.start + shot.voiceSec : t + dur;
    t = end;
    return { start: round3(start), end: round3(Math.max(end, start + 0.4)), text: c };
  });
}

/** mp3_44100_128 is constant 128 kbps, so bytes → seconds is exact enough for cut points. */
export function mp3DurationSec(bytes: number): number {
  return round3((bytes * 8) / 128_000);
}

export function totalDuration(shots: TimedShot[]): number {
  const last = shots[shots.length - 1];
  return last ? round3(last.start + last.duration) : 0;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
