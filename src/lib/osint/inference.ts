/**
 * Phase-2 ML inference seam.
 *
 * Face detection, OCR and object detection are Python/native ML workloads that
 * cannot run in a Vercel Node function. Phase 1 does NOT perform them. This
 * module defines the adapter interface the Phase-2 provider (Replicate / Modal /
 * managed vision API / self-hosted worker — decision deferred) will implement,
 * plus a no-op default so the pipeline can call it uniformly today and light up
 * the stages later with zero changes to pipeline.ts.
 *
 * PDPA note: per the project decision, FaceDetection intentionally has NO
 * embedding field. Phase 2 stores detection geometry/quality only until a
 * lawful-basis + retention policy is signed off.
 */

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

export interface InferenceResult {
  faces: FaceDetection[];
  objects: ObjectDetection[];
  ocr: OcrResult[];
}

export interface InferenceAdapter {
  /** True when this adapter can actually run (provider configured). */
  readonly available: boolean;
  detectFaces(image: Buffer): Promise<FaceDetection[]>;
  detectObjects(image: Buffer): Promise<ObjectDetection[]>;
  runOcr(image: Buffer): Promise<OcrResult[]>;
}

/** Default: no ML provider wired. Every stage returns empty and reports skipped. */
export const noopInferenceAdapter: InferenceAdapter = {
  available: false,
  async detectFaces() {
    return [];
  },
  async detectObjects() {
    return [];
  },
  async runOcr() {
    return [];
  },
};

/**
 * Resolve the active inference adapter. Phase 2 swaps this for a provider-backed
 * implementation gated on env (e.g. OSINT_INFERENCE_PROVIDER). Kept as a function
 * so the choice is made at call time, not import time.
 */
export function getInferenceAdapter(): InferenceAdapter {
  return noopInferenceAdapter;
}
