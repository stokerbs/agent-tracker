/**
 * Local OCR via tesseract.js (WASM) — runs in-process, no external service and
 * no third-party data exposure (unlike a cloud vision API). Reads Thai + English
 * and post-classifies each detected line into an investigative category
 * (email / phone / URL / plate / raw).
 *
 * Ops notes:
 *  • tesseract.js is loaded via dynamic import so it's server-only and not pulled
 *    into the client bundle; the worker + language data are heavy, so we cache a
 *    single worker across warm invocations (Fluid Compute reuses instances).
 *  • First cold start downloads the eng/tha traineddata (~tens of MB) from the
 *    tessdata CDN. Bundling/self-hosting that data is a worthwhile follow-up for
 *    latency, but functionally it works out of the box.
 */

import sharp from "sharp";
import type { Worker } from "tesseract.js";
import type { OcrResult } from "./types";

export type OcrCategory = "email" | "phone" | "url" | "plate" | "raw";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;
// Thai plates look like "1กก 1234" / "กข 1234"; keep it loose + best-effort.
const PLATE_RE = /^[A-Z0-9฀-๛]{1,3}[\s-]?\d{1,4}$/i;

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Classify a single OCR line into an investigative category. Pure + testable. */
export function categorizeText(text: string): OcrCategory {
  const t = text.trim();
  if (!t) return "raw";
  if (EMAIL_RE.test(t)) return "email";
  if (URL_RE.test(t)) return "url";

  const digits = digitsOnly(t);
  const compact = t.replace(/[\s()-]/g, "");
  if (digits.length >= 9 && digits.length <= 11 && /^(?:\+?66|0)/.test(compact)) {
    return "phone";
  }
  if (PLATE_RE.test(t)) return "plate";
  return "raw";
}

/** A tesseract line, narrowed to what we consume. */
export interface RawOcrLine {
  text: string;
  confidence: number; // 0..100
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Map raw tesseract lines → normalized OcrResult rows. Drops blank and
 * low-confidence lines, normalizes bbox to 0..1. Pure + testable.
 */
export function linesToResults(
  lines: RawOcrLine[],
  width: number,
  height: number,
  minConfidence = 40,
): OcrResult[] {
  const out: OcrResult[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text || line.confidence < minConfidence) continue;
    const bbox =
      width > 0 && height > 0
        ? {
            x: line.bbox.x0 / width,
            y: line.bbox.y0 / height,
            w: (line.bbox.x1 - line.bbox.x0) / width,
            h: (line.bbox.y1 - line.bbox.y0) / height,
          }
        : null;
    out.push({
      text,
      category: categorizeText(text),
      bbox,
      confidence: line.confidence / 100,
    });
  }
  return out;
}

/** Defensively pull lines out of tesseract's (version-varying) result shape. */
function extractLines(data: unknown): RawOcrLine[] {
  const d = data as {
    lines?: RawOcrLine[];
    blocks?: { paragraphs?: { lines?: RawOcrLine[] }[] }[];
  };
  if (Array.isArray(d.lines) && d.lines.length) return d.lines;
  const flat: RawOcrLine[] = [];
  for (const block of d.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) flat.push(line);
    }
  }
  return flat;
}

// Cached worker: created once, reused across warm invocations.
let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      // OEM 1 = LSTM engine; eng+tha covers our Thai/English targets.
      return createWorker(["eng", "tha"], 1);
    })();
  }
  return workerPromise;
}

/**
 * Run OCR on an image buffer and return categorized, normalized results.
 * Never throws for empty results — an image with no text yields [].
 */
export async function runOcr(buffer: Buffer): Promise<OcrResult[]> {
  const worker = await getWorker();
  const [{ data }, meta] = await Promise.all([
    worker.recognize(buffer, {}, { blocks: true }),
    sharp(buffer).metadata(),
  ]);
  const lines = extractLines(data);
  return linesToResults(lines, meta.width ?? 0, meta.height ?? 0);
}
