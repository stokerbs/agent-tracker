/**
 * OSINT analysis pipeline orchestrator.
 *
 * Resolves the input to a validated image, persists a root image_analysis row,
 * uploads the bytes to the evidence bucket, then runs each forensic stage,
 * recording per-stage status so the UI can show incremental progress / retry.
 * All writes use the service-role client (RLS bypass) AFTER the route handler
 * has authorized the caller (requireStaff + case-access check) — the pipeline is
 * never reachable directly from the client.
 *
 * Phase 1 runs stages synchronously within the request. The per-stage status
 * model means Phase 2 can move stages onto a queue/worker with no UI change.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type {
  AnalysisResult,
  AnalyzeRequest,
  Attribution,
  FaceDetection,
  ImageHashes,
  ImageMetadata,
  Integrity,
  ObjectDetection,
  OcrResult,
  RedirectHop,
  SourceType,
  StageName,
  StageStatus,
} from "./types";
import { decodeBase64, downloadImage, validateImage, type ValidatedImage } from "./ingest";
import { resolveChain } from "./redirect";
import { computeHashes } from "./hashes";
import { extractMetadata } from "./metadata";
import { assessIntegrity } from "./integrity";
import { attribute } from "./attribution";
import { buildReverseSearchLinks } from "./reverse-search";
import { getInferenceAdapter } from "./inference";
import { runOcr } from "./ocr";
import { geolocateImage, geolocationAvailable } from "./geolocation";
import type { GeoPrediction } from "./types";
import sharp from "sharp";

const BUCKET = "evidence";
// Per-stage ceilings so one slow stage can't exhaust the function's maxDuration.
const STAGE_TIMEOUT_MS = 45_000; // Replicate / Picarta network calls
const OCR_TIMEOUT_MS = 45_000; // tesseract WASM incl. first cold-start

interface ResolvedInput {
  sourceType: SourceType;
  image: ValidatedImage;
  finalUrl: string | null;
  finalHeaders: Headers | null;
  redirects: RedirectHop[];
  sourceRef: string | null;
}

/** Turn the validated request into a decoded, size/magic-checked image + chain. */
async function resolveInput(req: AnalyzeRequest): Promise<ResolvedInput> {
  if (req.image_base64) {
    const buf = decodeBase64(req.image_base64);
    const image = await validateImage(buf);
    return { sourceType: "base64", image, finalUrl: null, finalHeaders: null, redirects: [], sourceRef: null };
  }

  if (req.redirect_url) {
    const chain = await resolveChain(req.redirect_url);
    const image = chain.imageBuffer
      ? await validateImage(chain.imageBuffer)
      : (await downloadImage(chain.finalUrl)).image;
    return {
      sourceType: "redirect",
      image,
      finalUrl: chain.finalUrl,
      finalHeaders: chain.finalHeaders,
      redirects: chain.hops,
      sourceRef: req.redirect_url,
    };
  }

  // Direct image URL.
  const { image, response } = await downloadImage(req.image_url!);
  const redirects: RedirectHop[] = response.hops.map((h, i) => ({
    hopIndex: i,
    kind: h.url === response.finalUrl ? "origin" : "http",
    url: h.url,
    statusCode: h.status,
    resolvedHost: h.host,
    resolvedIp: h.ip,
  }));
  return {
    sourceType: "url",
    image,
    finalUrl: response.finalUrl,
    finalHeaders: response.headers,
    redirects,
    sourceRef: req.image_url!,
  };
}

export interface PipelineContext {
  profileId: string;
  caseId: string | null;
}

/**
 * Run the full analysis. Resolution/validation failures throw (the route returns
 * 4xx and nothing is persisted). Once the root row exists, individual stage
 * failures are captured in stage_status and the analysis still completes with a
 * partial result — a failed AI report must not discard good forensic data.
 */
export async function runPipeline(req: AnalyzeRequest, ctx: PipelineContext): Promise<AnalysisResult> {
  const svc = createServiceClient();

  // 1. Resolve + validate input up-front (throws → 4xx, no row written).
  const input = await resolveInput(req);

  // ML adapter: faces/objects only run when a provider (Replicate) is configured.
  const adapter = getInferenceAdapter();
  // OCR (local tesseract.js) can be disabled via env as a serverless safety valve.
  const ocrEnabled = process.env.OSINT_OCR_ENABLED !== "false";
  // AI geolocation (Picarta) only runs when a token is configured.
  const geoEnabled = geolocationAvailable();

  // 2. Create the root row.
  const stageStatus: StageStatus = {
    ingest: "complete",
    hashes: "processing",
    metadata: "processing",
    redirect: input.redirects.length ? "complete" : "skipped",
    attribution: input.finalHeaders ? "processing" : "skipped",
    integrity: "processing",
    ocr: ocrEnabled ? "processing" : "skipped",
    faces: adapter.available ? "processing" : "skipped",
    objects: adapter.available ? "processing" : "skipped",
    geolocation: geoEnabled ? "processing" : "skipped",
  };

  const { data: created, error: insErr } = await svc
    .from("image_analysis")
    .insert({
      created_by: ctx.profileId,
      case_id: ctx.caseId,
      source_type: input.sourceType,
      source_ref: input.sourceRef,
      status: "processing",
      stage_status: stageStatus,
      mime: input.image.mime,
      filesize: input.image.size,
    })
    .select("id")
    .single();

  if (insErr || !created) throw new Error(`Failed to create analysis: ${insErr?.message}`);
  const id: string = created.id;

  // 3. Upload the analyzed bytes to storage (osint/<id>/original).
  const storagePath = `osint/${id}/original`;
  const upload = await svc.storage.from(BUCKET).upload(storagePath, input.image.buffer, {
    contentType: input.image.mime,
    upsert: true,
  });
  const storedPath = upload.error ? null : storagePath;

  // 4. Run stages. Each is isolated so one failure doesn't abort the rest.
  const buf = input.image.buffer;

  // Downscaled working copy for the HEAVY stages (OCR + Replicate). Full-res
  // phone selfies blow up serverless memory/time; the detectors and OCR don't
  // need more than ~1600px. Hashes + EXIF still run on the ORIGINAL bytes, so
  // forensic integrity is preserved.
  let mlBuf = buf;
  try {
    mlBuf = await sharp(buf)
      .rotate() // bake in EXIF orientation before we drop the metadata
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    mlBuf = buf; // if downscale fails, fall back to the original
  }

  const [hashes, metadata] = await Promise.all([
    stage<ImageHashes>(() => computeHashes(buf), stageStatus, "hashes"),
    stage<ImageMetadata>(() => extractMetadata(buf), stageStatus, "metadata"),
  ]);

  let integrity: Integrity | null = null;
  if (metadata) {
    integrity = assessIntegrity(metadata);
    stageStatus.integrity = "complete";
  } else {
    stageStatus.integrity = "failed";
  }

  let attribution: Attribution | null = null;
  if (input.finalUrl && input.finalHeaders) {
    attribution = attribute(input.finalUrl, input.finalHeaders);
    stageStatus.attribution = "complete";
  }

  const reverseSearch = buildReverseSearchLinks(input.finalUrl);

  // Faces + objects hit the same Replicate provider, which throttles concurrent
  // "create" calls (burst can be 1 on low-credit accounts). Run them one after
  // the other — the adapter also retries on 429 — while local OCR and geolocation
  // run in parallel with the whole ML step.
  const mlRun: Promise<{ faces: FaceDetection[] | null; objects: ObjectDetection[] | null }> =
    adapter.available
      ? (async () => {
          const faces = await stage<FaceDetection[]>(() => withTimeout(adapter.detectFaces(mlBuf), STAGE_TIMEOUT_MS, "faces"), stageStatus, "faces");
          const objects = await stage<ObjectDetection[]>(() => withTimeout(adapter.detectObjects(mlBuf), STAGE_TIMEOUT_MS, "objects"), stageStatus, "objects");
          return { faces, objects };
        })()
      : Promise.resolve({ faces: null, objects: null });

  // OCR (tesseract WASM) is heavy on serverless; the ocrEnabled env flag (above)
  // lets us disable it, and a timeout keeps a slow cold-start from stalling the
  // whole request.
  const ocrRun: Promise<OcrResult[] | null> = ocrEnabled
    ? stage<OcrResult[]>(() => withTimeout(runOcr(mlBuf), OCR_TIMEOUT_MS, "ocr"), stageStatus, "ocr")
    : Promise.resolve<OcrResult[] | null>(((stageStatus.ocr = "skipped"), null));

  // AI geolocation (Picarta) — independent provider, runs in parallel with the rest.
  const geoRun: Promise<GeoPrediction | null> = geoEnabled
    ? stage<GeoPrediction | null>(() => withTimeout(geolocateImage(mlBuf), STAGE_TIMEOUT_MS, "geolocation"), stageStatus, "geolocation")
    : Promise.resolve<GeoPrediction | null>(null);

  const [ocr, ml, geolocation] = await Promise.all([ocrRun, mlRun, geoRun]);
  const { faces, objects } = ml;

  // 5. Persist child rows + finalize.
  await persist(svc, id, { hashes, metadata, redirects: input.redirects, ocr, faces, objects, geolocation });

  const anyFailed = Object.values(stageStatus).some((s) => s === "failed");
  await svc
    .from("image_analysis")
    .update({
      status: "complete",
      stage_status: stageStatus,
      storage_path: storedPath,
      width: metadata?.width ?? null,
      height: metadata?.height ?? null,
      format: metadata?.format ?? null,
      dpi: metadata?.dpi ?? null,
      integrity,
      error: anyFailed ? "one or more stages failed" : null,
    })
    .eq("id", id);

  return {
    id,
    status: "complete",
    stageStatus,
    caseId: ctx.caseId,
    sourceType: input.sourceType,
    storagePath: storedPath,
    metadata,
    hashes,
    redirects: input.redirects,
    attribution,
    integrity,
    reverseSearch,
    faces: faces ?? [],
    objects: objects ?? [],
    ocr: ocr ?? [],
    geolocation,
    error: anyFailed ? "one or more stages failed" : null,
  };
}

/** Run a stage, recording processing→complete/failed. Returns null on failure. */
async function stage<T>(fn: () => Promise<T>, status: StageStatus, name: StageName): Promise<T | null> {
  status[name] = "processing";
  try {
    const result = await fn();
    status[name] = "complete";
    return result;
  } catch (err) {
    status[name] = "failed";
    console.error(`[osint] stage ${name} failed:`, err);
    return null;
  }
}

/**
 * Bound a slow stage so it can't hold the whole serverless request open (which
 * would make the function time out and return a non-JSON error). On timeout the
 * promise rejects and stage() records the failure, isolated from the rest.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/** Insert the child rows for whichever stages produced data. */
async function persist(
  svc: ReturnType<typeof createServiceClient>,
  analysisId: string,
  data: {
    hashes: ImageHashes | null;
    metadata: ImageMetadata | null;
    redirects: RedirectHop[];
    ocr: OcrResult[] | null;
    faces: FaceDetection[] | null;
    objects: ObjectDetection[] | null;
    geolocation: GeoPrediction | null;
  },
): Promise<void> {
  const ops: PromiseLike<unknown>[] = [];

  if (data.hashes) {
    ops.push(svc.from("image_hashes").insert({ analysis_id: analysisId, ...data.hashes }));
  }
  if (data.metadata) {
    const m = data.metadata;
    ops.push(
      svc.from("image_metadata").insert({
        analysis_id: analysisId,
        camera_make: m.cameraMake,
        camera_model: m.cameraModel,
        lens: m.lens,
        software: m.software,
        orientation: m.orientation,
        gps_lat: m.gpsLat,
        gps_lng: m.gpsLng,
        gps_altitude: m.gpsAltitude,
        taken_at: m.takenAt,
        raw_exif: m.rawExif,
      }),
    );
  }
  if (data.redirects.length) {
    ops.push(
      svc.from("image_redirects").insert(
        data.redirects.map((h) => ({
          analysis_id: analysisId,
          hop_index: h.hopIndex,
          kind: h.kind,
          url: h.url,
          status_code: h.statusCode,
          resolved_host: h.resolvedHost,
          resolved_ip: h.resolvedIp,
        })),
      ),
    );
  }
  if (data.ocr && data.ocr.length) {
    ops.push(
      svc.from("image_ocr").insert(
        data.ocr.map((o) => ({
          analysis_id: analysisId,
          text: o.text,
          category: o.category,
          bbox: o.bbox,
          confidence: o.confidence,
        })),
      ),
    );
  }
  if (data.faces && data.faces.length) {
    ops.push(
      svc.from("image_faces").insert(
        data.faces.map((f) => ({
          analysis_id: analysisId,
          face_index: f.faceIndex,
          bbox: f.bbox,
          blur_score: f.blurScore,
          yaw: f.yaw,
          pitch: f.pitch,
          roll: f.roll,
          has_glasses: f.hasGlasses,
          has_mask: f.hasMask,
          confidence: f.confidence,
        })),
      ),
    );
  }
  if (data.objects && data.objects.length) {
    ops.push(
      svc.from("image_objects").insert(
        data.objects.map((o) => ({
          analysis_id: analysisId,
          label: o.label,
          category: o.category,
          bbox: o.bbox,
          confidence: o.confidence,
        })),
      ),
    );
  }
  if (data.geolocation && (data.geolocation.lat != null || data.geolocation.predictions.length)) {
    const g = data.geolocation;
    ops.push(
      svc.from("image_geolocation").insert({
        analysis_id: analysisId,
        provider: g.provider,
        ai_lat: g.lat,
        ai_lon: g.lon,
        confidence: g.confidence,
        country: g.country,
        city: g.city,
        province: g.province,
        predictions: g.predictions,
      }),
    );
  }

  const results = await Promise.allSettled(ops);
  for (const res of results) {
    if (res.status === "rejected") console.error("[osint] persist child row failed:", res.reason);
  }
}
