import type { CreativeAsset, CreativePlan, RenderJobStatus, VideoFormat } from "@/lib/studio/types";
import { isPresenterImage, MAX_SHOTS, parseVideoFormat, resolveShotImages, type ShotRole } from "@/lib/studio/video/timeline";

/**
 * Pure display helpers for the video section (storyboard preview, render gate,
 * job status pills, clip format). Kept free of React so they can be unit-tested
 * directly. The server action re-checks every gate — these only decide what the
 * button says before the round-trip.
 */

export const RENDER_POLL_MS = 3_000;
/** Give up polling after this long; the server marks orphaned running jobs failed at 8 min. */
export const RENDER_MAX_WAIT_MS = 10 * 60_000;

export const LOCK_HINT = "คอนเทนต์ที่เผยแพร่แล้วล็อกการแก้ไข — เก็บถาวรแล้วนำกลับมาเป็นร่างหากต้องการสร้างวิดีโอใหม่";

// ─── Clip format ─────────────────────────────────────────────────────────────

export const VIDEO_FORMAT_META: Record<VideoFormat, { label: string; hint: string }> = {
  template: { label: "ภาพประกอบ (ไวรัล)", hint: "ภาพนิ่งต่อฉาก + ซับไตเติลแบบไวรัล + hook overlay" },
  storyteller: { label: "นักสืบเล่าเรื่อง", hint: "นักสืบนิรนาม (เงาดำ ไม่เห็นหน้า) เล่าเรื่อง ตัดสลับกับภาพประกอบฉาก" },
};

/** Per-shot badge shown in storyteller mode. */
export const SHOT_ROLE_LABEL: Record<ShotRole, string> = { presenter: "นักสืบ", broll: "ภาพประกอบ" };

/** Storyteller gate reason shown before the round-trip (the server returns the resolver's own wording). */
export const PRESENTER_MISSING_REASON = "ยังไม่มีภาพนักสืบนิรนาม — สร้างภาพ “นักสืบนิรนาม (คนเล่าเรื่อง)” ก่อน";

/** The format a stored render job was created with — same rule as the renderer (anything but "storyteller" is the template). */
export function jobVideoFormat(params: unknown): VideoFormat {
  return parseVideoFormat((params as { format?: unknown } | null)?.format);
}

// ─── Job status ──────────────────────────────────────────────────────────────

export interface RenderStatusMeta {
  label: string;
  className: string;
  dot: string;
}

export const RENDER_STATUS_META: Record<RenderJobStatus, RenderStatusMeta> = {
  queued: { label: "รอเริ่ม", className: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  running: { label: "กำลังทำ", className: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400", dot: "bg-violet-500 animate-pulse" },
  done: { label: "เสร็จ", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  failed: { label: "ล้มเหลว", className: "border-destructive/30 bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

const UNKNOWN_STATUS_META: RenderStatusMeta = { label: "ไม่ทราบสถานะ", className: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" };

export function isRenderStatus(v: string): v is RenderJobStatus {
  return v === "queued" || v === "running" || v === "done" || v === "failed";
}

export function renderStatusMeta(status: string): RenderStatusMeta {
  return isRenderStatus(status) ? RENDER_STATUS_META[status] : UNKNOWN_STATUS_META;
}

export function isActiveRenderStatus(status: string): boolean {
  return status === "queued" || status === "running";
}

/** "m:ss" wall-clock elapsed (never negative). */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m.toLocaleString("en-GB")}:${String(s % 60).padStart(2, "0")}`;
}

/** Clamp a jsonb/int progress value into 0–100 for the progress bar. */
export function clampProgress(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

// ─── Assets / storyboard ─────────────────────────────────────────────────────

/** `meta` is read opaquely (jsonb), so accept any shape — real rows (`Json`) and test fixtures both fit. */
type AssetLite = Pick<CreativeAsset, "id" | "kind" | "status" | "mime"> & { meta: unknown };

/** Images the renderer may use — same kinds the server gate loads. */
export function readyImages<T extends AssetLite>(assets: T[]): T[] {
  return assets.filter((a) => a.status === "ready" && (a.kind === "thumbnail" || a.kind === "image"));
}

/** Which image gates the ready stills satisfy: the template needs a scene/cover still, the storyteller needs the presenter. */
export function imageReadiness(assets: AssetLite[]): { hasSceneImage: boolean; hasPresenter: boolean } {
  const images = readyImages(assets);
  return { hasSceneImage: images.some((a) => !isPresenterImage(a)), hasPresenter: images.some(isPresenterImage) };
}

/** Rendered mp4 outputs, in the order given (the query already sorts newest first). */
export function videoAssets<T extends AssetLite>(assets: T[]): T[] {
  return assets.filter((a) => a.kind === "video" || (a.mime?.startsWith("video/") ?? false));
}

export interface StoryboardRow {
  index: number;
  start_sec: number;
  end_sec: number;
  voice: string;
  visual: string;
  /** Asset id of the still that will be shown, or null when the format's image gate is not met. */
  imageAssetId: string | null;
  /** Storyteller only: the presenter or a cut-away (b-roll). Null for the template and for unresolved/dropped shots. */
  role: ShotRole | null;
  /** True when a non-presenter shot has no image of its own and the cover / another image is used instead. */
  usesFallback: boolean;
  /** No narration — shown for SILENT_SHOT_SEC. */
  silent: boolean;
  /** Beyond MAX_SHOTS — the renderer drops it. */
  dropped: boolean;
}

function sceneIndexOf(meta: unknown): number | null {
  const t = (meta as { target?: { kind?: unknown; index?: unknown } } | null)?.target;
  return t?.kind === "scene" && typeof t.index === "number" ? t.index : null;
}

/** Read-only storyboard: which image (and, for the storyteller, which role) each shot resolves to, plus warning flags. */
export function buildStoryboard(plan: CreativePlan | null, assets: AssetLite[], format: VideoFormat = "template"): StoryboardRow[] {
  const shots = plan?.shots ?? [];
  if (!plan || !shots.length) return [];
  const images = readyImages(assets);
  const resolved = resolveShotImages(plan, images, { format });
  const byIndex = new Map<number, { imageAssetId: string; role: ShotRole | null }>();
  if (!("error" in resolved)) for (const r of resolved) byIndex.set(r.index, { imageAssetId: r.imageAssetId, role: r.role ?? null });
  const explicit = new Set<number>();
  for (const img of images) {
    const i = sceneIndexOf(img.meta);
    if (i != null) explicit.add(i);
  }
  return shots.map((s, i) => {
    const hit = byIndex.get(i);
    const imageAssetId = hit?.imageAssetId ?? null;
    const role = hit?.role ?? null;
    return {
      index: i,
      start_sec: s.start_sec,
      end_sec: s.end_sec,
      voice: (s.voice ?? "").trim(),
      visual: (s.visual ?? "").trim(),
      imageAssetId,
      role,
      usesFallback: imageAssetId != null && role !== "presenter" && !explicit.has(i),
      silent: !(s.voice ?? "").trim(),
      dropped: i >= MAX_SHOTS,
    };
  });
}

/** Nominal length from the plan (the real cut follows narration length). */
export function plannedTotalSec(plan: CreativePlan | null): number {
  const shots = plan?.shots ?? [];
  const last = shots[Math.min(shots.length, MAX_SHOTS) - 1];
  return last ? Math.max(0, Math.floor(last.end_sec)) : 0;
}

export interface RenderGateInput {
  ttsAvailable: boolean;
  ttsReason?: string;
  shotCount: number;
  hasVoice: boolean;
  /** A ready scene/cover still (the presenter does not count) — what the template needs. */
  hasImage: boolean;
  /** A ready storyteller presenter image — what the storyteller needs. */
  hasPresenter: boolean;
  editable: boolean;
  jobActive: boolean;
}

/** Thai reason the "สร้างวิดีโอ" button is disabled, or null when it may run. Mirrors the server gates for the chosen format. */
export function renderBlockedReason(i: RenderGateInput, format: VideoFormat = "template"): string | null {
  if (i.jobActive) return "กำลัง render อยู่ — รอให้เสร็จก่อน";
  if (!i.editable) return LOCK_HINT;
  if (!i.ttsAvailable) return i.ttsReason ?? "ยังไม่ได้ตั้งค่าเสียงพากย์ (TTS)";
  if (i.shotCount === 0) return "ยังไม่มี shot list — สร้าง creative plan ก่อน";
  if (!i.hasVoice) return "shot list ยังไม่มีข้อความพากย์ (voice) — เติมก่อนสร้างวิดีโอ";
  if (format === "storyteller") return i.hasPresenter ? null : PRESENTER_MISSING_REASON;
  if (!i.hasImage) return "ยังไม่มีรูปที่พร้อมใช้ — สร้างภาพในส่วน “สื่อ” ก่อน";
  return null;
}
