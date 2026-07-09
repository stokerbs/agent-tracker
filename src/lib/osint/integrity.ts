/**
 * Image integrity heuristics (Node-derivable subset).
 *
 * Phase 1 infers what we can from container + EXIF facts alone:
 *   • metadata stripped   — a JPEG with no EXIF at all (re-encoded / laundered)
 *   • edited in software   — EXIF Software names a known editor
 *   • likely screenshot    — screenshot software tag, or PNG with no camera EXIF
 *   • likely resized        — even, "web" dimensions with no camera provenance
 *
 * "AI generated" and pixel-forensic edit/crop/mirror detection require ML and
 * are deferred to Phase 2 (see inference.ts). We deliberately do NOT guess those
 * here — a confident-looking wrong answer is worse than an honest "unknown".
 */

import type { ImageMetadata, Integrity, IntegritySignal } from "./types";

const EDITOR_SOFTWARE = [
  /photoshop/i,
  /lightroom/i,
  /gimp/i,
  /affinity/i,
  /pixelmator/i,
  /snapseed/i,
  /paint\.net/i,
  /capture one/i,
];

const SCREENSHOT_HINTS = [/screenshot/i, /screen shot/i, /shottr/i, /cleanshot/i];

// Common device screen dimensions (portrait + landscape) → screenshot signal.
const SCREEN_DIMS = new Set([
  "1170x2532", "2532x1170", // iPhone 12/13/14
  "1179x2556", "2556x1179", // iPhone 14/15 Pro
  "1284x2778", "2778x1284", // iPhone Pro Max
  "1080x1920", "1920x1080", // FHD
  "1440x2560", "2560x1440", // QHD
  "1290x2796", "2796x1290", // iPhone 15 Pro Max
  "750x1334", "1334x750",   // iPhone SE
]);

export function assessIntegrity(meta: ImageMetadata): Integrity {
  const signals: IntegritySignal[] = [];

  const hasExif = meta.rawExif != null;
  const hasCamera = Boolean(meta.cameraMake || meta.cameraModel);
  const dims = meta.width && meta.height ? `${meta.width}x${meta.height}` : null;

  // Metadata stripped: JPEGs from cameras carry EXIF; none at all is a laundering
  // signal (social platforms and re-encoders strip it).
  const metadataStripped = meta.format === "jpeg" && !hasExif;
  if (metadataStripped) {
    signals.push({ key: "metadata_stripped", detail: "JPEG carries no EXIF block" });
  }

  // Edited in software.
  let likelyEditedSoftware: string | null = null;
  if (meta.software && EDITOR_SOFTWARE.some((re) => re.test(meta.software!))) {
    likelyEditedSoftware = meta.software;
    signals.push({ key: "edited_software", detail: `EXIF Software = "${meta.software}"` });
  }

  // Screenshot.
  let likelyScreenshot = false;
  if (meta.software && SCREENSHOT_HINTS.some((re) => re.test(meta.software!))) {
    likelyScreenshot = true;
    signals.push({ key: "screenshot_software", detail: `Software = "${meta.software}"` });
  } else if (dims && SCREEN_DIMS.has(dims) && !hasCamera) {
    likelyScreenshot = true;
    signals.push({ key: "screenshot_dimensions", detail: `${dims} matches a device screen and no camera EXIF` });
  } else if (meta.format === "png" && !hasCamera && !hasExif) {
    likelyScreenshot = true;
    signals.push({ key: "screenshot_png", detail: "PNG with no camera metadata" });
  }

  // Resized / web-optimized: even dimensions, no camera provenance, not already
  // flagged as a screenshot.
  let likelyResized = false;
  if (
    !hasCamera &&
    meta.width &&
    meta.height &&
    meta.width % 2 === 0 &&
    meta.height % 2 === 0 &&
    Math.max(meta.width, meta.height) <= 2048 &&
    !likelyScreenshot
  ) {
    likelyResized = true;
    signals.push({ key: "web_dimensions", detail: `${dims} looks web-optimized with no camera provenance` });
  }

  // Confidence scales with the number of corroborating signals (capped).
  const confidence = Math.min(1, signals.length === 0 ? 0.2 : 0.4 + signals.length * 0.2);

  return {
    metadataStripped,
    likelyResized,
    likelyScreenshot,
    likelyEditedSoftware,
    confidence,
    signals,
  };
}
