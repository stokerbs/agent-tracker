/**
 * OSINT Image Intelligence — shared types and input validation.
 *
 * Phase 1 (Node-only forensics). The pipeline runs a fixed set of stages; each
 * stage reports a `StageState` so the UI can render loading / success / failure
 * / retry per panel. ML stages (face/ocr/objects) exist as declared stage names
 * but are `skipped` in Phase 1 (see src/lib/osint/inference.ts).
 */

import { z } from "zod";

// ── Input ────────────────────────────────────────────────────────────────────

/** Max bytes we will accept/decode for a single image (defense-in-depth). */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
export type AcceptedMime = (typeof ACCEPTED_MIME)[number];

/**
 * The analyze request. Exactly one input source must be provided. `case_id` is
 * optional — an analysis can be run unattached and linked later.
 *
 * Note `image_base64` and `image_url` are validated here for shape only; the
 * ingest layer re-validates bytes (magic-byte sniff, size, decodability) and the
 * fetch layer enforces SSRF safety — never trust these values past this point.
 */
export const analyzeRequestSchema = z
  .object({
    // Raw base64 (with or without a data: URL prefix).
    image_base64: z.string().min(1).max(40_000_000).optional(),
    // A direct image URL to download.
    image_url: z.string().url().max(4096).optional(),
    // A redirect/landing URL (e.g. PimEyes) to resolve to a final image.
    redirect_url: z.string().url().max(4096).optional(),
    // Optional case to associate the analysis with.
    case_id: z.string().uuid().optional(),
    // Original file name (upload path) — advisory only, never trusted for MIME.
    file_name: z.string().max(512).optional(),
  })
  .refine(
    (v) => Boolean(v.image_base64 || v.image_url || v.redirect_url),
    { message: "One of image_base64, image_url or redirect_url is required." },
  );

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

// ── Pipeline stages ──────────────────────────────────────────────────────────

export const STAGE_NAMES = [
  "ingest",
  "hashes",
  "metadata",
  "redirect",
  "attribution",
  "integrity",
  "report",
  // Phase-2 (skipped in Phase 1):
  "faces",
  "ocr",
  "objects",
] as const;
export type StageName = (typeof STAGE_NAMES)[number];

export type StageState = "pending" | "processing" | "complete" | "failed" | "skipped";
export type StageStatus = Partial<Record<StageName, StageState>>;

// ── Forensic result shapes ───────────────────────────────────────────────────

export interface ImageHashes {
  md5: string;
  sha1: string;
  sha256: string;
  phash: string;
  dhash: string;
  ahash: string;
}

export interface ImageMetadata {
  width: number | null;
  height: number | null;
  mime: string | null;
  format: string | null;
  filesize: number | null;
  dpi: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lens: string | null;
  software: string | null;
  orientation: number | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAltitude: number | null;
  takenAt: string | null; // ISO
  rawExif: Record<string, unknown> | null;
}

export interface RedirectHop {
  hopIndex: number;
  kind: "http" | "meta" | "js" | "origin";
  url: string;
  statusCode: number | null;
  resolvedHost: string | null;
  resolvedIp: string | null;
}

export interface CloudMatch {
  provider: string; // "Amazon S3", "Cloudflare R2", ...
  evidence: string; // what matched (hostname pattern / header)
}

export interface CdnMatch {
  provider: string; // "Cloudflare", "Fastly", ...
  evidence: string;
}

export interface Attribution {
  host: string | null;
  cloud: CloudMatch[];
  cdn: CdnMatch[];
}

export interface IntegritySignal {
  key: string;
  detail: string;
}

export interface Integrity {
  metadataStripped: boolean;
  likelyResized: boolean;
  likelyScreenshot: boolean;
  likelyEditedSoftware: string | null;
  confidence: number; // 0..1
  signals: IntegritySignal[];
}

export interface ReverseSearchLink {
  engine: "google_lens" | "yandex" | "bing" | "tineye" | "pimeyes";
  label: string;
  url: string;
}

// ── ML (Phase 2) result shapes ───────────────────────────────────────────────
// Defined here (pure, no runtime deps) so both the server inference layer and the
// client UI can share them without pulling sharp/tesseract into the bundle.

export interface FaceDetection {
  faceIndex: number;
  bbox: { x: number; y: number; w: number; h: number };
  blurScore: number | null;
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  hasGlasses: boolean | null;
  hasMask: boolean | null;
  confidence: number | null;
  // NB: no embedding field — faces are detected, never vectorized (PDPA).
}

export interface ObjectDetection {
  label: string;
  category: string | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  confidence: number | null;
}

export interface OcrResult {
  text: string;
  category: string | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  confidence: number | null;
}

export interface AiReport {
  model: string;
  summary: string;
  likelyOrigin: string;
  leads: string[];
  recommendations: string[];
  riskScore: number; // 0..100
  confidence: number; // 0..100
}

export type SourceType = "upload" | "url" | "base64" | "redirect";

/** The full result returned to the client after an analysis completes. */
export interface AnalysisResult {
  id: string;
  status: "complete" | "failed" | "processing";
  stageStatus: StageStatus;
  caseId: string | null;
  sourceType: SourceType;
  storagePath: string | null;
  metadata: ImageMetadata | null;
  hashes: ImageHashes | null;
  redirects: RedirectHop[];
  attribution: Attribution | null;
  integrity: Integrity | null;
  reverseSearch: ReverseSearchLink[];
  report: AiReport | null;
  faces: FaceDetection[];
  objects: ObjectDetection[];
  ocr: OcrResult[];
  error: string | null;
}
