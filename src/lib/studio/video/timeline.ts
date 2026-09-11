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
export const SUBTITLE_MAX_CHARS = 28;
/** Soft per-line target, in graphemes (Thai vowels and tone marks stack, so .length overstates width). */
export const SUBTITLE_LINE_TARGET = 24;
/** Hard per-line ceiling: about 720 px of Sarabun Bold 64, inside the 920 px safe area. */
export const SUBTITLE_LINE_MAX = 40;
export const SUBTITLE_MAX_LINES = 2;

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
const BREAK_BEFORE = new Set(["และ", "แต่", "หรือ", "ว่า", "ซึ่ง", "เพราะ", "ถ้า", "หาก", "โดย", "เมื่อ", "จึง", "แล้ว", "เพื่อ", "จน", "ส่วน", "ก็"]);

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
function splitPhrase(phrase: string, max: number): string[] {
  const width = (parts: string[]) => subtitleWidth(parts.join(""));
  const out: string[] = [];
  let cur: string[] = [];
  for (const segment of thaiWords(phrase)) {
    if (cur.length > 0 && width([...cur, segment]) > max && !gluesToPrevious(segment)) {
      let cut = cur.length;
      for (let i = cur.length - 1; i >= 1; i--) {
        if (BREAK_BEFORE.has(cur[i]) && width(cur.slice(0, i)) >= max * 0.4) {
          cut = i;
          break;
        }
      }
      out.push(cur.slice(0, cut).join(""));
      cur = cur.slice(cut);
    }
    cur.push(segment);
  }
  if (cur.length) out.push(cur.join(""));
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
export function subtitleLines(text: string): string[] {
  const clean = protectSpaces(text.replace(/\s+/g, " ").trim());
  if (!clean) return [];
  const pieces: { text: string; afterSpace: boolean }[] = [];
  clean
    .split(" ")
    .filter(Boolean)
    .forEach((phrase, pi) => {
      const parts = subtitleWidth(phrase) > SUBTITLE_LINE_MAX ? splitPhrase(phrase, SUBTITLE_LINE_MAX) : [phrase];
      parts.forEach((part, i) => pieces.push({ text: part, afterSpace: pi > 0 && i === 0 }));
    });
  const lines: { text: string; afterSpace: boolean }[] = [];
  for (const piece of pieces) {
    const last = lines[lines.length - 1];
    if (last && piece.afterSpace && subtitleWidth(`${last.text} ${piece.text}`) <= SUBTITLE_LINE_TARGET) last.text = `${last.text} ${piece.text}`;
    else lines.push({ ...piece });
  }
  // A lone short word on the last line reads like a stray fragment: pull it up when the line above has room.
  const tail = lines[lines.length - 1];
  const prev = lines[lines.length - 2];
  if (tail && prev && tail.afterSpace && subtitleWidth(tail.text) <= 6 && subtitleWidth(`${prev.text} ${tail.text}`) <= SUBTITLE_LINE_MAX) {
    prev.text = `${prev.text} ${tail.text}`;
    lines.pop();
  }
  return lines.map((l) => l.text.replace(/\u00A0/g, " "));
}

/** At the end of a line these leave the thought hanging, so the next line should not flash up as a separate cue. */
const DANGLING_END = new Set(["ทาง", "กับ", "ของ", "จาก", "ด้วย", "ตาม", "ถึง", "และ", "แต่", "หรือ", "โดย", "เพื่อ"]);
/** A cue this narrow (in graphemes) on its own flashes by too fast to read. */
const SHORT_CUE = 12;

function edgeWords(line: string): { first: string; last: string } {
  const words = thaiWords(line.trim()).filter((w) => w.trim());
  return { first: words[0] ?? "", last: words[words.length - 1] ?? "" };
}

/**
 * Group lines into cues of up to SUBTITLE_MAX_LINES. A tiny dynamic program
 * picks the grouping with the fewest reading problems: a lone short fragment,
 * a cue that ends on a dangling word ("…ได้ทาง" then "LINE @…" alone), or a
 * clause opener that starts the second line and then spills into the next
 * cue. Ties keep lines paired, which means fewer cue changes.
 */
export function chunkSubtitle(text: string): string[] {
  const lines = subtitleLines(text);
  const n = lines.length;
  const best = new Array<number>(n + 1).fill(0);
  const take = new Array<number>(n + 1).fill(1);
  for (let i = n - 1; i >= 0; i--) {
    let bestCost = Infinity;
    for (let size = Math.min(SUBTITLE_MAX_LINES, n - i); size >= 1; size--) {
      const cue = lines.slice(i, i + size);
      const hasNext = i + size < n;
      let cost = 1 + best[i + size];
      if (size === 1 && subtitleWidth(cue[0]) < SHORT_CUE) cost += 3;
      if (hasNext && DANGLING_END.has(edgeWords(cue[size - 1]).last)) cost += 4;
      if (hasNext && size > 1 && BREAK_BEFORE.has(edgeWords(cue[size - 1]).first)) cost += 2;
      if (cost < bestCost) {
        bestCost = cost;
        take[i] = size;
      }
    }
    best[i] = bestCost;
  }
  const cues: string[] = [];
  for (let i = 0; i < n; i += take[i]) cues.push(lines.slice(i, i + take[i]).join("\n"));
  return cues;
}

export function timeSubtitles(shot: TimedShot): SubtitleCue[] {
  const chunks = chunkSubtitle(shot.voice);
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
