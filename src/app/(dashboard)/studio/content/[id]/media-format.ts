import type { ImageAspect } from "@/lib/studio/types";

/**
 * Pure display helpers for the media section (asset grid + generation
 * controls). Kept free of React so they can be unit-tested directly.
 */

/** "245 KB" / "1.2 MB" (en-GB numerals). */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes.toLocaleString("en-GB")} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb).toLocaleString("en-GB")} KB`;
  const mb = kb / 1024;
  return `${mb.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

/** "mm:ss" from milliseconds (rounded to the nearest second). */
export function formatMmSs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  return formatSeconds(Math.round(ms / 1000));
}

/** "mm:ss" from whole seconds — same shape the creative plan uses for shot ranges. */
export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Truncate for option labels. Cuts on grapheme clusters so Thai vowels/tone
 * marks stay attached to their consonant (code-point fallback when
 * Intl.Segmenter is unavailable).
 */
export function truncate(text: string | null | undefined, max: number): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const units = graphemes(t);
  return units.length <= max ? t : `${units.slice(0, max).join("").trimEnd()}…`;
}

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/** Tailwind aspect class for an image card; literal strings so the JIT can see them. */
const ASPECT_CLASS: Record<ImageAspect, string> = {
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "4:5": "aspect-[4/5]",
};

export const ASPECT_LABEL: Record<ImageAspect, string> = {
  "9:16": "9:16 · แนวตั้ง (TikTok / Reels)",
  "1:1": "1:1 · สี่เหลี่ยม",
  "16:9": "16:9 · แนวนอน (YouTube)",
  "4:5": "4:5 · โพสต์ IG/Facebook",
};

function isImageAspect(v: unknown): v is ImageAspect {
  return v === "9:16" || v === "1:1" || v === "16:9" || v === "4:5";
}

/** Reads `meta.aspect` from the jsonb column; falls back to width/height, then 16:9. */
export function aspectClassFor(meta: unknown, width: number | null, height: number | null): string {
  if (meta && typeof meta === "object" && "aspect" in meta) {
    const a = (meta as { aspect?: unknown }).aspect;
    if (isImageAspect(a)) return ASPECT_CLASS[a];
  }
  if (width && height && width > 0 && height > 0) {
    const r = width / height;
    if (r < 0.7) return ASPECT_CLASS["9:16"];
    if (r < 0.9) return ASPECT_CLASS["4:5"];
    if (r < 1.2) return ASPECT_CLASS["1:1"];
  }
  return ASPECT_CLASS["16:9"];
}

export type AssetFamily = "image" | "audio" | "other";

/** Groups the free-form `kind` column into what the card needs to render. */
export function assetFamily(kind: string): AssetFamily {
  if (kind === "thumbnail" || kind === "image" || kind === "broll") return "image";
  if (kind === "audio") return "audio";
  return "other";
}

export const KIND_LABEL: Record<string, string> = {
  thumbnail: "ภาพปก",
  image: "ภาพ",
  broll: "B-roll",
  audio: "เสียงพากย์",
  video: "วิดีโอ",
  subtitle: "ซับไตเติล",
  other: "อื่น ๆ",
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}
