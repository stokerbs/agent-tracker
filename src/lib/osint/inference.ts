/**
 * ML inference adapter — Phase 2.
 *
 * Face + object detection are GPU/Python workloads and run on Replicate (chosen
 * over a blanket cloud vision API so biometric data stays under our own account,
 * and over a self-hosted worker so there's no always-on box). OCR does NOT go
 * through this adapter — it runs locally via tesseract.js (see ocr.ts).
 *
 * PDPA: face detection returns geometry/pose/quality ONLY. We never request,
 * parse, or persist face embeddings — `normalizeFaces` deliberately drops any
 * embedding/vector field a model might emit. This is enforced here, not just in
 * the schema (image_faces has no embedding column).
 *
 * Model output shapes vary between Replicate models, so the normalizers are
 * intentionally tolerant and the model refs are env-configurable. The exact
 * field mapping should get one verification pass once a live token is wired
 * (see OSINT_REPLICATE_* env + docs).
 */

import sharp from "sharp";
import type { FaceDetection } from "./types";

export type { FaceDetection, OcrResult } from "./types";

export interface InferenceAdapter {
  /** True when this adapter can actually run (provider configured). */
  readonly available: boolean;
  detectFaces(image: Buffer): Promise<FaceDetection[]>;
}

/** Default: no ML provider wired. Returns empty (reported skipped). */
export const noopInferenceAdapter: InferenceAdapter = {
  available: false,
  async detectFaces() {
    return [];
  },
};

const REPLICATE_API = "https://api.replicate.com/v1";
const REPLICATE_TIMEOUT_MS = 90_000;

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1) return true;
  if (v === "false" || v === 0) return false;
  return null;
}

/** Find the detection array inside a variety of Replicate output shapes. */
function detectionArray(output: unknown): Record<string, unknown>[] {
  if (Array.isArray(output)) return output as Record<string, unknown>[];
  const o = (output ?? {}) as Record<string, unknown>;
  for (const key of ["faces", "detections", "predictions", "objects", "results", "boxes"]) {
    if (Array.isArray(o[key])) return o[key] as Record<string, unknown>[];
  }
  return [];
}

/** Pull a {x,y,w,h} box (normalized to 0..1) from assorted bbox encodings. */
function normalizeBbox(item: Record<string, unknown>, w: number, h: number) {
  const raw = (item.bbox ?? item.box ?? item.facial_area ?? item.xyxy) as unknown;
  let x1: number, y1: number, x2: number, y2: number;
  if (Array.isArray(raw) && raw.length >= 4) {
    [x1, y1, x2, y2] = raw.map(Number);
  } else if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    x1 = Number(r.x1 ?? r.left ?? r.x);
    y1 = Number(r.y1 ?? r.top ?? r.y);
    x2 = Number(r.x2 ?? r.right ?? (r.x != null && r.w != null ? Number(r.x) + Number(r.w) : NaN));
    y2 = Number(r.y2 ?? r.bottom ?? (r.y != null && r.h != null ? Number(r.y) + Number(r.h) : NaN));
  } else {
    return null;
  }
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  // Heuristic: if all coords are ≤1 the model already returned normalized values.
  const normalized = [x1, y1, x2, y2].every((v) => v >= 0 && v <= 1);
  const dw = normalized ? 1 : w || 1;
  const dh = normalized ? 1 : h || 1;
  return { x: x1 / dw, y: y1 / dh, w: (x2 - x1) / dw, h: (y2 - y1) / dh };
}

/** Faces → geometry/pose/quality only. Any embedding field is intentionally ignored. */
export function normalizeFaces(output: unknown, w: number, h: number): FaceDetection[] {
  return detectionArray(output).map((item, i) => {
    const pose = (item.pose ?? item) as Record<string, unknown>;
    return {
      faceIndex: i,
      bbox: normalizeBbox(item, w, h) ?? { x: 0, y: 0, w: 0, h: 0 },
      blurScore: num(item.blur ?? item.blur_score ?? item.sharpness),
      yaw: num(pose.yaw),
      pitch: num(pose.pitch),
      roll: num(pose.roll),
      hasGlasses: bool(item.glasses ?? item.has_glasses),
      hasMask: bool(item.mask ?? item.has_mask),
      confidence: num(item.confidence ?? item.score ?? item.det_score),
    };
  });
}


/** Build a `data:` URI from an image buffer (re-encoded to JPEG for size/compat). */
async function toDataUri(buffer: Buffer): Promise<{ uri: string; width: number; height: number }> {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const jpeg = await img.jpeg({ quality: 90 }).toBuffer();
  return {
    uri: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}

/**
 * Run a Replicate model with the image as input. Uses `Prefer: wait` so the
 * create call blocks until the prediction settles (or ~60s), then polls as a
 * fallback for longer runs, up to REPLICATE_TIMEOUT_MS. Throws on API failure.
 */
/** True only for URLs on Replicate's API host (guards where we send the token). */
export function isReplicateHost(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).host === "api.replicate.com";
  } catch {
    return false;
  }
}

const MAX_429_RETRIES = 5;
// Cap total time spent retrying so a run can't blow past the route's maxDuration.
const RETRY_BUDGET_MS = 60_000;

/** Parse a Retry-After (header or JSON body), clamped, in ms. Default 5s. */
export function retryAfterMs(header: string | null, bodyRetryAfter?: unknown): number {
  // Guard: Number(null) and Number("") are 0 (finite), which would mask a
  // missing header — treat empty/null as absent so we fall back correctly.
  const fromHeader = header != null && header !== "" ? Number(header) : NaN;
  const fromBody = bodyRetryAfter != null && bodyRetryAfter !== "" ? Number(bodyRetryAfter) : NaN;
  const secs = Number.isFinite(fromHeader) ? fromHeader : Number.isFinite(fromBody) ? fromBody : 5;
  return Math.min(Math.max(secs, 1), 30) * 1000 + 250;
}

/** POST a prediction, backing off on 429 (throttling) up to a bounded budget. */
async function createWithRetry(url: string, token: string, body: unknown): Promise<Response> {
  const start = Date.now();
  let res!: Response;
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "wait" },
      body: JSON.stringify(body),
    });
    if (res.status !== 429 || attempt === MAX_429_RETRIES) return res;
    let ra: unknown;
    try {
      ra = (await res.clone().json())?.retry_after;
    } catch {
      /* ignore */
    }
    const wait = retryAfterMs(res.headers.get("retry-after"), ra);
    // Give up (return the 429) rather than sleep past the retry budget.
    if (Date.now() - start + wait > RETRY_BUDGET_MS) return res;
    await new Promise((r) => setTimeout(r, wait));
  }
  return res;
}

async function runReplicate(
  token: string,
  modelRef: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const [owner, rest] = modelRef.split("/");
  const [name, version] = (rest ?? "").split(":");
  const isVersioned = Boolean(version);
  const url = isVersioned ? `${REPLICATE_API}/predictions` : `${REPLICATE_API}/models/${owner}/${name}/predictions`;
  const body = isVersioned ? { version, input } : { input };

  const start = Date.now();
  // Create the prediction, retrying on 429. Replicate throttles "create"
  // requests (as low as burst=1 while an account holds < $5 credit), so two
  // near-simultaneous calls (faces + objects) can collide; we honor Retry-After
  // and back off rather than fail the stage.
  let res = await createWithRetry(url, token, body);
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${await res.text()}`);
  let pred = (await res.json()) as { id: string; status: string; output?: unknown; error?: unknown; urls?: { get?: string } };

  while (pred.status === "starting" || pred.status === "processing") {
    if (Date.now() - start > REPLICATE_TIMEOUT_MS) throw new Error("Replicate prediction timed out");
    await new Promise((r) => setTimeout(r, 1500));
    // The poll URL comes from the API response and we attach the API token to it,
    // so only follow it when it's on Replicate's host — otherwise fall back to a
    // URL we construct ourselves. Prevents leaking the token to an unexpected host.
    const fallback = `${REPLICATE_API}/predictions/${pred.id}`;
    const getUrl = isReplicateHost(pred.urls?.get) ? pred.urls!.get! : fallback;
    res = await fetch(getUrl, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Replicate poll ${res.status}: ${await res.text()}`);
    pred = (await res.json()) as typeof pred;
  }

  if (pred.status !== "succeeded") {
    throw new Error(`Replicate prediction ${pred.status}: ${String(pred.error ?? "")}`);
  }
  return pred.output;
}

/** Non-empty env value, or undefined. */
function envOrUndef(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Build the model input. `image` is always sent. When a `query` is configured
 * (open-vocabulary detectors like Grounding DINO require one), include it plus a
 * box threshold; plain detectors leave the query unset and receive only `image`.
 */
export function buildModelInput(uri: string, query: string | undefined): Record<string, unknown> {
  const input: Record<string, unknown> = { image: uri };
  if (query) {
    input.query = query;
    const bt = Number(process.env.OSINT_REPLICATE_BOX_THRESHOLD);
    input.box_threshold = Number.isFinite(bt) ? bt : 0.3;
  }
  return input;
}

class ReplicateInferenceAdapter implements InferenceAdapter {
  constructor(private readonly token: string) {}
  get available() {
    return true;
  }
  async detectFaces(image: Buffer): Promise<FaceDetection[]> {
    const model = process.env.OSINT_REPLICATE_FACE_MODEL;
    if (!model) return [];
    const { uri, width, height } = await toDataUri(image);
    const input = buildModelInput(uri, envOrUndef("OSINT_REPLICATE_FACE_QUERY"));
    const out = await runReplicate(this.token, model, input);
    return normalizeFaces(out, width, height);
  }
}

/**
 * Resolve the active inference adapter. Returns the Replicate-backed adapter when
 * REPLICATE_API_TOKEN is set, otherwise the no-op (stages report `skipped`).
 */
export function getInferenceAdapter(): InferenceAdapter {
  const token = process.env.REPLICATE_API_TOKEN;
  return token ? new ReplicateInferenceAdapter(token) : noopInferenceAdapter;
}
