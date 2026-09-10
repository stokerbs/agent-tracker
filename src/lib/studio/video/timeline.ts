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

/**
 * Split narration into subtitle chunks at Thai clause boundaries (space, comma,
 * Thai danda-like breaks) up to ~28 chars, and time them proportionally to
 * their length across the narration window.
 */
export function chunkSubtitle(text: string, max = SUBTITLE_MAX_CHARS): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(/(?<=[ ,;:!?…])|(?=[ ,;:!?…])/).filter((w) => w.trim().length);
  const chunks: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = (cur + w).replace(/\s+/g, " ");
    if (candidate.trim().length > max && cur.trim()) {
      chunks.push(cur.trim());
      cur = w;
    } else cur = candidate;
  }
  if (cur.trim()) chunks.push(cur.trim());
  // Thai has no spaces inside clauses — hard-split anything still too long on grapheme clusters.
  const seg = new Intl.Segmenter("th", { granularity: "grapheme" });
  return chunks.flatMap((c) => {
    if (c.length <= max * 1.4) return [c];
    const graphemes = Array.from(seg.segment(c), (s) => s.segment);
    const parts: string[] = [];
    for (let i = 0; i < graphemes.length; i += max) parts.push(graphemes.slice(i, i + max).join(""));
    return parts;
  });
}

export function timeSubtitles(shot: TimedShot): SubtitleCue[] {
  const chunks = chunkSubtitle(shot.voice);
  if (!chunks.length || shot.voiceSec <= 0) return [];
  const total = chunks.reduce((n, c) => n + c.length, 0);
  let t = shot.start;
  return chunks.map((c, i) => {
    const dur = (c.length / total) * shot.voiceSec;
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
