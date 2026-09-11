"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Download, ExternalLink, ImageOff, Loader2, Lock, RefreshCw, Trash2, TriangleAlert, User, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pill } from "@/components/studio/badges";
import { useSafeTransition } from "@/components/studio/use-safe-transition";
import { VIDEO_FORMATS, type CreativeAsset, type CreativePlan, type RenderJob, type VideoFormat } from "@/lib/studio/types";
import { MAX_SHOTS, SILENT_SHOT_SEC } from "@/lib/studio/video/timeline";
import { cn } from "@/lib/utils";
import { formatDateTimeBkk } from "../format";
import { deleteMediaAsset, generateImage } from "./media-actions";
import { formatBytes, formatMmSs, formatSeconds, truncate } from "./media-format";
import { createRenderJob, getRenderJob } from "./video-actions";
import {
  buildStoryboard,
  clampProgress,
  formatElapsed,
  imageReadiness,
  isActiveRenderStatus,
  jobVideoFormat,
  LOCK_HINT,
  plannedTotalSec,
  PRESENTER_MISSING_REASON,
  RENDER_MAX_WAIT_MS,
  RENDER_POLL_MS,
  renderBlockedReason,
  renderStatusMeta,
  SHOT_ROLE_LABEL,
  VIDEO_FORMAT_META,
  videoAssets,
  type StoryboardRow,
} from "./video-format";

/**
 * Video (phase 3): 9:16 render in one of two formats — the template (per-shot
 * still + viral captions + hook overlay) or the storyteller (the anonymous
 * silhouette detective narrates, cutting away to scene stills). Both use Thai
 * voice-over + burned-in subtitles. The client creates a job (server action),
 * fires the long-running route handler without awaiting it, and polls the job
 * every 3 s. All gates are re-checked server-side; the reasons shown here are
 * UX only.
 */

export interface VideoAvailabilityProps {
  available: boolean;
  reason?: string;
}

export interface VideoSectionProps {
  masterId: string;
  plan: CreativePlan | null;
  hook: string;
  assets: CreativeAsset[];
  assetUrls: Record<string, string | null>;
  /** Newest first (from the page query). */
  renderJobs: RenderJob[];
  ttsAvailability: VideoAvailabilityProps;
  editable: boolean;
}

const SETTINGS_MEDIA_HREF = "/studio/settings#media";
const HISTORY_LIMIT = 5;
const VOICE_PREVIEW_CHARS = 60;

type RenderRouteResponse = { ok: boolean; assetId?: string; durationSec?: number; error?: string };

export function VideoSection({ masterId, plan, hook, assets, assetUrls, renderJobs, ttsAvailability, editable }: VideoSectionProps) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [presenterPending, startPresenter] = useSafeTransition();
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [presenterError, setPresenterError] = useState<string | null>(null);

  // Resume polling a job that was queued/running when the page loaded (reload mid-render).
  const initialActive = renderJobs.find((j) => isActiveRenderStatus(j.status)) ?? null;
  const [activeJobId, setActiveJobId] = useState<string | null>(initialActive?.id ?? null);
  const [liveJob, setLiveJob] = useState<RenderJob | null>(initialActive);
  const [startedAtMs, setStartedAtMs] = useState<number>(() => (initialActive ? new Date(initialActive.started_at ?? initialActive.created_at).getTime() : Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const activeJobIdRef = useRef<string | null>(activeJobId);
  activeJobIdRef.current = activeJobId;
  // Template by default; a reload mid-render keeps showing the running job's format.
  const [format, setFormat] = useState<VideoFormat>(() => (initialActive ? jobVideoFormat(initialActive.params) : "template"));

  const shots = plan?.shots ?? [];
  const storyboard = useMemo(() => buildStoryboard(plan, assets, format), [plan, assets, format]);
  const readiness = useMemo(() => imageReadiness(assets), [assets]);
  const videos = useMemo(() => videoAssets(assets), [assets]);
  const history = useMemo(() => renderJobs.slice(0, HISTORY_LIMIT), [renderJobs]);
  const hasVoice = shots.some((s) => s.voice?.trim());
  const jobActive = activeJobId != null;
  const needsPresenter = format === "storyteller" && !readiness.hasPresenter;

  const blocked = renderBlockedReason(
    { ttsAvailable: ttsAvailability.available, ttsReason: ttsAvailability.reason, shotCount: shots.length, hasVoice, hasImage: readiness.hasSceneImage, hasPresenter: readiness.hasPresenter, editable, jobActive },
    format,
  );
  const disabled = pending || !!blocked;

  /** Stop tracking a job (either finished or errored) and surface the outcome. */
  const finish = useCallback(
    (jobId: string, outcome: { kind: "done" } | { kind: "failed"; message: string } | { kind: "timeout" }) => {
      if (activeJobIdRef.current !== jobId) return;
      setActiveJobId(null);
      if (outcome.kind === "done") {
        toast.success("สร้างวิดีโอเสร็จแล้ว — ดูตัวอย่างด้านล่าง แล้วโพสต์ได้จากส่วน “โพสต์โซเชียล”");
        setInlineError(null);
      } else if (outcome.kind === "failed") {
        toast.error(outcome.message);
        setInlineError(outcome.message);
      } else {
        const msg = "รอผลนานเกินไป — รีเฟรชหน้าเพื่อดูสถานะล่าสุด หรือลองอีกครั้ง";
        toast.error(msg);
        setInlineError(msg);
      }
      router.refresh();
    },
    [router],
  );

  // Poll the job every 3 s while active.
  useEffect(() => {
    if (!activeJobId) return;
    const jobId = activeJobId;
    let cancelled = false;
    const poll = async () => {
      if (Date.now() - startedAtMs > RENDER_MAX_WAIT_MS) {
        finish(jobId, { kind: "timeout" });
        return;
      }
      try {
        const res = await getRenderJob({ jobId });
        if (cancelled) return;
        if (!res.ok) {
          finish(jobId, { kind: "failed", message: res.error });
          return;
        }
        setLiveJob(res.job);
        if (res.job.status === "done") finish(jobId, { kind: "done" });
        else if (res.job.status === "failed") finish(jobId, { kind: "failed", message: res.job.error?.trim() || "สร้างวิดีโอไม่สำเร็จ — ไม่มีรายละเอียดจากเซิร์ฟเวอร์" });
      } catch (e) {
        // Transient network error — keep polling; the timeout above bounds it.
        console.error("[studio:video] poll failed:", e);
      }
    };
    void poll();
    const id = setInterval(() => void poll(), RENDER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeJobId, startedAtMs, finish]);

  // Elapsed-time ticker.
  useEffect(() => {
    if (!activeJobId) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [activeJobId]);

  function runRender() {
    if (disabled) return;
    setInlineError(null);
    start(async () => {
      const res = await createRenderJob({ masterId, format });
      if (!res.ok) {
        if (res.code === "busy") {
          toast.info(res.error);
          router.refresh();
          return;
        }
        toast.error(res.error);
        setInlineError(res.error);
        return;
      }
      const jobId = res.jobId;
      setLiveJob(null);
      setStartedAtMs(Date.now());
      setActiveJobId(jobId);
      // Kick off the render. Deliberately not awaited for UI state — it can run ~4 min; polling drives the card.
      void fetch(`/api/studio/render/${jobId}`, { method: "POST" })
        .then(async (r) => {
          const body = (await r.json().catch(() => null)) as RenderRouteResponse | null;
          if (!r.ok || !body?.ok) finish(jobId, { kind: "failed", message: body?.error?.trim() || `เซิร์ฟเวอร์ render ตอบกลับผิดพลาด (${r.status.toLocaleString("en-GB")})` });
          // On success the next poll picks up status=done (the route updates the row before responding).
        })
        .catch((e: unknown) => {
          console.error("[studio:video] render request failed:", e);
          finish(jobId, { kind: "failed", message: "เชื่อมต่อเซิร์ฟเวอร์ render ไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง" });
        });
    });
  }

  function changeFormat(next: VideoFormat) {
    if (next === format) return;
    setFormat(next);
    setInlineError(null);
  }

  /** Storyteller narrator: same server action as the media section (fixed prompt server-side), 9:16 for the vertical clip. */
  function runPresenter() {
    if (presenterPending || !editable) return;
    setPresenterError(null);
    startPresenter(async () => {
      const res = await generateImage({ masterId, target: { kind: "presenter" }, aspect: "9:16" });
      if (!res.ok) {
        toast.error(res.error);
        setPresenterError(res.error);
        return;
      }
      toast.success("สร้างภาพนักสืบนิรนามแล้ว — ตรวจภาพด้วยตาก่อนโพสต์");
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border/70 bg-card" aria-labelledby="video-title">
      <header className="space-y-1.5 border-b border-border/60 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="video-title" className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Clapperboard className="h-3.5 w-3.5" /> วิดีโอ (9:16)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <FormatToggle value={format} onChange={changeFormat} disabled={pending || jobActive} />
            <Button size="sm" onClick={runRender} disabled={disabled} title={blocked ?? `สร้างวิดีโอ 1080×1920 แบบ “${VIDEO_FORMAT_META[format].label}” จาก shot list — ใช้เวลาประมาณ 1–3 นาที`}>
              {pending || jobActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />} สร้างวิดีโอ
            </Button>
          </div>
        </div>
        {format === "storyteller" ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">นักสืบนิรนาม (เงาดำ ไม่เห็นหน้า)</span> เปิด–ปิดคลิปและเล่าเรื่อง ตัดสลับกับ<span className="font-medium text-foreground/80">ภาพประกอบฉาก</span> + เสียงพากย์ไทยต่อฉาก + ซับไตเติล เป็น MP4 แนวตั้ง
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            ต่อ<span className="font-medium text-foreground/80">ภาพนิ่งต่อฉาก</span> + <span className="font-medium text-foreground/80">เสียงพากย์ไทยต่อฉาก</span> + ซับไตเติล + hook overlay เป็น MP4 แนวตั้ง — ยังไม่มีเพลงและวิดีโอเคลื่อนไหว
          </p>
        )}
      </header>

      <div className="space-y-4 p-3">
        {!editable && (
          <p className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" /> {LOCK_HINT}
          </p>
        )}
        {blocked && editable && !jobActive && !(needsPresenter && blocked === PRESENTER_MISSING_REASON) && <GateNotice reason={blocked} showSettingsLink={!ttsAvailability.available} />}
        {needsPresenter && editable && !jobActive && <PresenterNeeded pending={presenterPending} error={presenterError} onGenerate={runPresenter} onDismissError={() => setPresenterError(null)} />}

        {jobActive && <ProgressCard job={liveJob} elapsedMs={Math.max(0, now - startedAtMs)} shotCount={shots.length} />}

        {inlineError && !jobActive && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs" role="alert">
            <span className="inline-flex items-start gap-1.5 text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {inlineError}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={runRender} disabled={disabled}>
                <RefreshCw className="h-3 w-3" /> ลองอีกครั้ง
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setInlineError(null)}>
                ปิด
              </Button>
            </div>
          </div>
        )}

        {/* ── Storyboard ── */}
        {storyboard.length === 0 ? (
          <EmptyVideo hasPlan={false} />
        ) : (
          <Storyboard rows={storyboard} format={format} hook={hook} assetUrls={assetUrls} plannedSec={plannedTotalSec(plan)} onRefresh={() => router.refresh()} />
        )}

        {/* ── Results ── */}
        {videos.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium">วิดีโอที่สร้างแล้ว</p>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="วิดีโอที่สร้างแล้ว">
              {videos.map((v, i) => (
                <li key={v.id}>
                  <VideoCard asset={v} url={assetUrls[v.id] ?? null} latest={i === 0} editable={editable} onRefresh={() => router.refresh()} />
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">โพสต์วิดีโอนี้ไป TikTok / Reels / YouTube Shorts ได้จากส่วน “โพสต์โซเชียล” ด้านล่าง</p>
          </div>
        ) : (
          storyboard.length > 0 && !jobActive && <EmptyVideo hasPlan />
        )}

        {/* ── Job history ── */}
        {history.length > 0 && <JobHistory jobs={history} />}
      </div>
    </section>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function GateNotice({ reason, showSettingsLink }: { reason: string; showSettingsLink: boolean }) {
  return (
    <p className="inline-flex w-full items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">
        {reason}
        {showSettingsLink && (
          <>
            {" · "}
            <Link href={SETTINGS_MEDIA_HREF} className="underline-offset-2 hover:underline">
              ตั้งค่าเสียงพากย์ใน Settings → สื่อ
            </Link>
          </>
        )}
      </span>
    </p>
  );
}

/** Segmented control: two toggle buttons (aria-pressed) — the selection is local until "สร้างวิดีโอ" sends it. */
function FormatToggle({ value, onChange, disabled }: { value: VideoFormat; onChange: (f: VideoFormat) => void; disabled: boolean }) {
  return (
    <div role="group" aria-label="รูปแบบวิดีโอ" className="inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-muted/40 p-0.5">
      {VIDEO_FORMATS.map((f) => {
        const active = value === f;
        return (
          <Button
            key={f}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={active}
            onClick={() => onChange(f)}
            disabled={disabled}
            title={VIDEO_FORMAT_META[f].hint}
            className={cn("h-7 px-2.5 text-xs", active ? "bg-background text-foreground shadow-sm hover:bg-background" : "text-muted-foreground")}
          >
            {f === "storyteller" && <User className="h-3 w-3" />}
            {VIDEO_FORMAT_META[f].label}
          </Button>
        );
      })}
    </div>
  );
}

function PresenterNeeded({ pending, error, onGenerate, onDismissError }: { pending: boolean; error: string | null; onGenerate: () => void; onDismissError: () => void }) {
  return (
    <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-start gap-1.5 text-amber-700 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">{PRESENTER_MISSING_REASON} · ภาพเงาดำไม่เห็นหน้า สร้างครั้งเดียวใช้ได้ทุกครั้งที่ render คอนเทนต์นี้</span>
        </span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onGenerate} disabled={pending}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <User className="h-3 w-3" />} สร้างภาพนักสืบนิรนาม
        </Button>
      </div>
      {pending && (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-3 w-3 animate-spin text-violet-500" /> กำลังสร้างภาพนักสืบนิรนาม (9:16)… ปกติ 10–60 วินาที
        </p>
      )}
      {error && !pending && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5" role="alert">
          <span className="inline-flex items-start gap-1.5 text-destructive">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onGenerate}>
              <RefreshCw className="h-3 w-3" /> ลองอีกครั้ง
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDismissError}>
              ปิด
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressCard({ job, elapsedMs, shotCount }: { job: RenderJob | null; elapsedMs: number; shotCount: number }) {
  const progress = clampProgress(job?.progress);
  const step = job?.step?.trim() || (job?.status === "running" ? "กำลังทำ…" : "รอเริ่ม…");
  return (
    <div className="space-y-2 rounded-md border border-violet-500/40 bg-violet-500/5 p-3" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" /> กำลังสร้างวิดีโอ — {step}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {progress.toLocaleString("en-GB")}% · ผ่านไป {formatElapsed(elapsedMs)}
        </span>
      </div>
      <Progress value={progress} aria-label="ความคืบหน้าการสร้างวิดีโอ" indicatorClassName="bg-violet-500" />
      <p className="text-[11px] text-muted-foreground">
        ปกติ 1–3 นาที ({shotCount.toLocaleString("en-GB")} ฉาก) — ปิดหน้านี้ได้ งานยังทำต่อบนเซิร์ฟเวอร์ กลับมาดูผลได้ทีหลัง
      </p>
    </div>
  );
}

function Storyboard({ rows, format, hook, assetUrls, plannedSec, onRefresh }: { rows: StoryboardRow[]; format: VideoFormat; hook: string; assetUrls: Record<string, string | null>; plannedSec: number; onRefresh: () => void }) {
  const noImages = rows.every((r) => r.imageAssetId == null);
  const kept = rows.filter((r) => !r.dropped).length;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">
          Storyboard · {kept.toLocaleString("en-GB")} ฉาก · ตามแผน ~{formatSeconds(plannedSec)}
        </p>
        <p className="text-[11px] text-muted-foreground">ความยาวจริงตามเสียงพากย์ · ฉากไม่มีเสียงแสดง {SILENT_SHOT_SEC.toLocaleString("en-GB")} วิ</p>
      </div>
      {hook.trim() ? (
        <p className="truncate text-[11px] text-muted-foreground" title={hook}>
          Hook overlay (ฉาก 1, 2.5 วิแรก): <span className="text-foreground/80">{truncate(hook, 80)}</span>
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">ไม่มี hook — จะไม่แสดง overlay บนฉากแรก</p>
      )}
      {format === "storyteller" && !noImages && (
        <p className="text-[11px] text-muted-foreground">นักสืบเปิดและปิดคลิป เล่าสลับทุกฉาก — ฉากระหว่างนั้นตัดไปภาพประกอบของฉาก (ไม่มีภาพฉากใช้ภาพปก ไม่มีภาพเลยอยู่ที่นักสืบ)</p>
      )}
      {noImages && (
        <p className="inline-flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <ImageOff className="mt-0.5 h-3 w-3 shrink-0" />
          {format === "storyteller"
            ? "ยังไม่มีภาพนักสืบนิรนามที่พร้อมใช้ — สร้างภาพ “นักสืบนิรนาม (คนเล่าเรื่อง)” ก่อน จึงจะเห็นภาพต่อฉากและสร้างวิดีโอแบบนักสืบเล่าเรื่องได้"
            : "ยังไม่มีภาพที่พร้อมใช้เลย — สร้างภาพปกหรือภาพฉากในส่วน “สื่อ” ก่อน จึงจะสร้างวิดีโอได้"}
        </p>
      )}
      <ol className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/70" aria-label="Storyboard">
        {rows.map((r) => (
          <li key={r.index}>
            <StoryboardRowView row={r} url={r.imageAssetId ? (assetUrls[r.imageAssetId] ?? null) : null} onRefresh={onRefresh} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function StoryboardRowView({ row, url, onRefresh }: { row: StoryboardRow; url: string | null; onRefresh: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <article className={cn("flex items-start gap-3 px-3 py-2 text-xs", row.dropped && "opacity-50")} aria-label={`ฉาก ${row.index + 1}`}>
      {/* Thumbnail (9:16 crop) */}
      <div className="h-16 w-9 shrink-0 overflow-hidden rounded bg-muted/40">
        {row.imageAssetId == null ? (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground" title="ไม่มีภาพ">
            <ImageOff className="h-3.5 w-3.5" />
          </div>
        ) : url == null || broken ? (
          <button type="button" onClick={onRefresh} className="flex h-full w-full items-center justify-center text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="ลิงก์หมดอายุ — รีเฟรช" aria-label="ลิงก์หมดอายุ — รีเฟรช">
            <RefreshCw className="h-3 w-3" />
          </button>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket; next/image cannot cache it
          <img src={url} alt={row.role === "presenter" ? `ภาพนักสืบนิรนาม ฉาก ${row.index + 1}` : `ภาพฉาก ${row.index + 1}`} className="h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium tabular-nums">ฉาก {(row.index + 1).toLocaleString("en-GB")}</span>
          <span className="text-muted-foreground tabular-nums">
            {formatSeconds(row.start_sec)}–{formatSeconds(row.end_sec)}
          </span>
          {/* role is only set in storyteller mode */}
          {row.role && !row.dropped && (
            <Pill className={row.role === "presenter" ? "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300" : "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"}>
              {row.role === "presenter" ? <User className="h-3 w-3" /> : null}
              {SHOT_ROLE_LABEL[row.role]}
            </Pill>
          )}
          {row.dropped && <Pill className="border-border bg-muted text-muted-foreground">เกิน {MAX_SHOTS.toLocaleString("en-GB")} ฉาก — ไม่ถูกใช้</Pill>}
          {row.silent && !row.dropped && (
            <Pill className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <VolumeX className="h-3 w-3" /> ไม่มีเสียง — แสดง {SILENT_SHOT_SEC.toLocaleString("en-GB")} วิ
            </Pill>
          )}
          {row.imageAssetId == null && !row.dropped && (
            <Pill className="border-destructive/30 bg-destructive/10 text-destructive">
              <ImageOff className="h-3 w-3" /> ไม่มีภาพ
            </Pill>
          )}
          {row.usesFallback && !row.dropped && <Pill className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300">ใช้ภาพปกแทน</Pill>}
        </p>
        <p className={cn("truncate", row.silent ? "italic text-muted-foreground" : "text-foreground/90")} title={row.voice || undefined}>
          {row.silent ? "— ไม่มีข้อความพากย์ —" : truncate(row.voice, VOICE_PREVIEW_CHARS)}
        </p>
        {row.visual && (
          <p className="truncate text-[11px] text-muted-foreground" title={row.visual}>
            ภาพ: {truncate(row.visual, VOICE_PREVIEW_CHARS)}
          </p>
        )}
      </div>
    </article>
  );
}

function VideoCard({ asset, url, latest, editable, onRefresh }: { asset: CreativeAsset; url: string | null; latest: boolean; editable: boolean; onRefresh: () => void }) {
  const [broken, setBroken] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useSafeTransition();
  const label = asset.label?.trim() || "วิดีโอ 9:16";
  const fileName = `${label.replace(/[\\/:*?"<>|]+/g, "-")}.mp4`;

  function remove() {
    start(async () => {
      const res = await deleteMediaAsset({ assetId: asset.id });
      if (!res.ok) {
        toast.error(res.error);
        setConfirm(false);
        return;
      }
      toast.success("ลบวิดีโอแล้ว");
      onRefresh();
    });
  }

  return (
    <article className={cn("flex h-full flex-col overflow-hidden rounded-md border border-border/70 bg-background", pending && "opacity-60")} aria-label={label}>
      <div className="mx-auto w-full max-w-[220px] bg-black/90">
        {asset.status === "failed" ? (
          <div className="flex aspect-[9/16] flex-col items-center justify-center gap-1 bg-destructive/5 px-3 text-center">
            <TriangleAlert className="h-4 w-4 text-destructive" />
            <p className="text-[11px] text-destructive">{asset.error?.trim() || "สร้างไม่สำเร็จ"}</p>
          </div>
        ) : asset.status === "pending" ? (
          <div className="flex aspect-[9/16] items-center justify-center bg-muted/30" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          </div>
        ) : url == null || broken ? (
          <button type="button" onClick={onRefresh} className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-1 bg-muted/30 text-center text-[11px] text-muted-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <RefreshCw className="h-3.5 w-3.5" /> ลิงก์หมดอายุ — รีเฟรช
          </button>
        ) : (
          <div className="aspect-[9/16] w-full">
            <video controls preload="metadata" src={url} className="h-full w-full object-contain" aria-label={label} playsInline onError={() => setBroken(true)} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-medium" title={label}>
            {label}
          </p>
          <span className="flex shrink-0 items-center gap-1">
            {latest && <Pill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">ล่าสุด</Pill>}
            <Pill className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400">วิดีโอ</Pill>
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          ความยาว {formatMmSs(asset.duration_ms)} · {formatBytes(asset.bytes)}
          {asset.width && asset.height ? ` · ${asset.width.toLocaleString("en-GB")}×${asset.height.toLocaleString("en-GB")}` : ""}
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums">{formatDateTimeBkk(asset.created_at)}</p>
        <div className="mt-auto flex items-center justify-between gap-1 pt-1">
          {url != null && !broken ? (
            <span className="inline-flex items-center gap-1">
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ExternalLink className="h-3 w-3" /> เปิด
              </a>
              <a href={url} download={fileName} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Download className="h-3 w-3" /> ดาวน์โหลด
              </a>
            </span>
          ) : (
            <span />
          )}
          {confirm ? (
            <span className="inline-flex items-center gap-1">
              <span className="text-[11px] text-amber-600 dark:text-amber-400">ลบถาวร?</span>
              <Button size="sm" variant="destructive" className="h-7 px-2 text-[11px]" onClick={remove} disabled={pending}>
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "ยืนยัน"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setConfirm(false)} disabled={pending}>
                ยกเลิก
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirm(true)} disabled={!editable || pending} aria-label={`ลบ ${label}`} title={!editable ? LOCK_HINT : "ลบวิดีโอ"}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function JobHistory({ jobs }: { jobs: RenderJob[] }) {
  return (
    <details className="group rounded-md border border-border/70">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        ประวัติการ render ({jobs.length.toLocaleString("en-GB")} ล่าสุด)
      </summary>
      <ul className="divide-y divide-border/60 border-t border-border/60" aria-label="ประวัติการ render">
        {jobs.map((j) => {
          const meta = renderStatusMeta(j.status);
          const shots = (j.params as { shots?: unknown } | null)?.shots;
          return (
            <li key={j.id} className="flex flex-wrap items-start gap-2 px-3 py-2 text-xs">
              <Pill className={meta.className} dot={meta.dot}>
                {meta.label}
              </Pill>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-muted-foreground" title={j.step ?? undefined}>
                  {j.step?.trim() || "—"}
                  {typeof shots === "number" ? ` · ${shots.toLocaleString("en-GB")} ฉาก` : ""}
                  {` · ${VIDEO_FORMAT_META[jobVideoFormat(j.params)].label}`}
                  {isActiveRenderStatus(j.status) ? ` · ${clampProgress(j.progress).toLocaleString("en-GB")}%` : ""}
                </p>
                {j.status === "failed" && j.error?.trim() && (
                  <p className="text-destructive" role="alert">
                    {j.error}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/80 tabular-nums">
                  สร้าง {formatDateTimeBkk(j.created_at)}
                  {j.finished_at && j.started_at ? ` · ใช้เวลา ${formatElapsed(new Date(j.finished_at).getTime() - new Date(j.started_at).getTime())}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function EmptyVideo({ hasPlan }: { hasPlan: boolean }) {
  return (
    <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center">
      <p className="text-sm text-muted-foreground">{hasPlan ? "ยังไม่มีวิดีโอ" : "ยังไม่มี shot list"}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground/70">
        “สร้างวิดีโอ” จะต่อภาพนิ่งของแต่ละฉาก (ซูมช้า ๆ) กับเสียงพากย์ไทยของฉากนั้น ใส่ซับไตเติลและ hook overlay บนฉากแรก ออกมาเป็น MP4 1080×1920 — ยังไม่มีเพลงประกอบและวิดีโอเคลื่อนไหว
        {hasPlan ? "" : " · สร้าง creative plan ด้านบนก่อน จึงจะเห็น storyboard ที่นี่"}
      </p>
    </div>
  );
}
