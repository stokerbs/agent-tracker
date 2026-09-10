"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Eye, ExternalLink, ImageIcon, Loader2, Lock, Mic, RefreshCw, TriangleAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/studio/badges";
import { useSafeTransition } from "@/components/studio/use-safe-transition";
import { PLATFORM_META } from "@/lib/studio/constants";
import { MAX_CUSTOM_PROMPT_CHARS } from "@/lib/studio/media/prompts";
import { IMAGE_ASPECTS, type ContentVariant, type CreativeAsset, type CreativePlan, type ImageAspect, type Platform } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { formatDateTimeBkk } from "../format";
import { deleteMediaAsset, generateImage, generateVoiceover, type MediaActionResult } from "./media-actions";
import { ASPECT_LABEL, aspectClassFor, assetFamily, formatBytes, formatMmSs, formatSeconds, kindLabel, truncate } from "./media-format";

/**
 * Media (phase 1): still images + Thai voice-over generated from the saved
 * creative plan / script. No video and no auto-publish yet — the header says
 * so. Generated images cannot be machine-checked for PII, so every card and
 * the header carry the "check by eye" reminder.
 */

export interface MediaAvailabilityProps {
  image: { available: boolean; reason?: string };
  tts: { available: boolean; reason?: string };
}

export interface MediaSectionProps {
  masterId: string;
  title: string;
  plan: CreativePlan | null;
  variants: Pick<ContentVariant, "id" | "platform" | "script" | "hook">[];
  assets: CreativeAsset[];
  assetUrls: Record<string, string | null>;
  availability: MediaAvailabilityProps;
  defaultAspect: ImageAspect;
  hasScript: boolean;
  hasHook: boolean;
  editable: boolean;
  /** Await the editor's autosave so the server reads the current copy. */
  flush: () => Promise<void>;
}

/** Client-side cap is UX feedback only — the server action re-validates with the same constant. */
const MAX_CUSTOM_CHARS = MAX_CUSTOM_PROMPT_CHARS;
const SETTINGS_MEDIA_HREF = "/studio/settings#media";
const LOCK_HINT = "คอนเทนต์ที่เผยแพร่แล้วล็อกการแก้ไข — เก็บถาวรแล้วนำกลับมาเป็นร่างหากต้องการสร้างหรือลบสื่อ";
const EYE_CHECK = "ภาพที่สร้างตรวจ PII อัตโนมัติไม่ได้ — ตรวจด้วยตาก่อนโพสต์";

type ImageTargetValue = "thumbnail" | "custom" | `scene:${number}`;
type VoiceSourceValue = "script" | "hook" | `variant:${string}`;
type PendingJob = { kind: "image" | "audio"; label: string };
type InlineError = { kind: "image" | "audio"; message: string; retry: () => void };

export function MediaSection({ masterId, title, plan, variants, assets, assetUrls, availability, defaultAspect, hasScript, hasHook, editable, flush }: MediaSectionProps) {
  const router = useRouter();
  const [imagePending, startImage] = useSafeTransition();
  const [voicePending, startVoice] = useSafeTransition();
  const [jobs, setJobs] = useState<PendingJob[]>([]);
  const [inlineError, setInlineError] = useState<InlineError | null>(null);

  // ── Image controls ──
  const shots = plan?.shots ?? [];
  const [imageTarget, setImageTarget] = useState<ImageTargetValue>("thumbnail");
  const [customText, setCustomText] = useState("");
  const [aspect, setAspect] = useState<ImageAspect>(defaultAspect);
  // A scene that no longer exists (plan edited) falls back to the cover.
  const effectiveTarget: ImageTargetValue = imageTarget.startsWith("scene:") && Number(imageTarget.slice(6)) >= shots.length ? "thumbnail" : imageTarget;
  const customTooShort = effectiveTarget === "custom" && customText.trim().length < 3;

  // ── Voice controls ──
  const voiceOptions = useMemo(() => {
    const opts: { value: VoiceSourceValue; label: string; disabled: boolean }[] = [
      { value: "script", label: "สคริปต์หลัก", disabled: !hasScript },
      { value: "hook", label: "Hook", disabled: !hasHook },
    ];
    for (const v of variants) {
      const platformLabel = PLATFORM_META[v.platform as Platform]?.label ?? v.platform;
      const hasText = !!(v.script?.trim() || v.hook?.trim());
      opts.push({ value: `variant:${v.id}`, label: `Variant ${platformLabel}${hasText ? "" : " (ไม่มีข้อความ)"}`, disabled: !hasText });
    }
    return opts;
  }, [hasScript, hasHook, variants]);
  const [voiceSource, setVoiceSource] = useState<VoiceSourceValue>("script");
  const firstEnabledVoice = voiceOptions.find((o) => !o.disabled)?.value;
  const effectiveVoice = voiceOptions.some((o) => o.value === voiceSource && !o.disabled) ? voiceSource : firstEnabledVoice;

  const imageDisabled = !editable || !availability.image.available || imagePending || customTooShort;
  const voiceDisabled = !editable || !availability.tts.available || voicePending || !effectiveVoice;
  const nothingConfigured = !availability.image.available && !availability.tts.available;

  function handleResult(res: MediaActionResult, kind: PendingJob["kind"], successMsg: string, retry: () => void) {
    if (res.ok) {
      setInlineError(null);
      toast.success(successMsg);
      router.refresh();
      return;
    }
    const message = res.code === "not_configured" ? ((kind === "image" ? availability.image.reason : availability.tts.reason) ?? res.error) : res.error;
    toast.error(message);
    setInlineError({ kind, message, retry });
  }

  function runImage() {
    if (imageDisabled) return;
    const label = effectiveTarget === "thumbnail" ? "กำลังสร้างภาพปก…" : effectiveTarget === "custom" ? "กำลังสร้างภาพจากคำบรรยาย…" : `กำลังสร้างภาพฉาก ${Number(effectiveTarget.slice(6)) + 1}…`;
    const target =
      effectiveTarget === "thumbnail" ? ({ kind: "thumbnail" } as const) : effectiveTarget === "custom" ? ({ kind: "custom", text: customText.trim() } as const) : ({ kind: "scene", index: Number(effectiveTarget.slice(6)) } as const);
    setJobs((j) => [...j, { kind: "image", label }]);
    startImage(async () => {
      try {
        await flush();
        const res = await generateImage({ masterId, target, aspect });
        handleResult(res, "image", "สร้างภาพแล้ว — ตรวจภาพด้วยตาก่อนโพสต์", runImage);
      } finally {
        setJobs((j) => j.filter((x) => x.label !== label));
      }
    });
  }

  function runVoice() {
    if (voiceDisabled || !effectiveVoice) return;
    const label = effectiveVoice === "script" ? "กำลังพากย์สคริปต์หลัก…" : effectiveVoice === "hook" ? "กำลังพากย์ hook…" : "กำลังพากย์ variant…";
    const source = effectiveVoice === "script" ? ({ kind: "script" } as const) : effectiveVoice === "hook" ? ({ kind: "hook" } as const) : ({ kind: "variant", variantId: effectiveVoice.slice(8) } as const);
    setJobs((j) => [...j, { kind: "audio", label }]);
    startVoice(async () => {
      try {
        await flush();
        const res = await generateVoiceover({ masterId, source });
        handleResult(res, "audio", "พากย์เสียงเสร็จแล้ว — ฟังตรวจก่อนใช้", runVoice);
      } finally {
        setJobs((j) => j.filter((x) => x.label !== label));
      }
    });
  }

  const showEmpty = assets.length === 0 && jobs.length === 0;

  return (
    <section className="rounded-lg border border-border/70 bg-card" aria-labelledby="media-title">
      <header className="space-y-1.5 border-b border-border/60 px-3 py-2">
        <h2 id="media-title" className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" /> สื่อ (รูป / เสียงพากย์)
        </h2>
        <p className="text-xs text-muted-foreground">
          V1 สร้าง<span className="font-medium text-foreground/80">ภาพนิ่ง</span>จากแผนวิดีโอ และ<span className="font-medium text-foreground/80">เสียงพากย์ไทย</span>จากสคริปต์ — ยังไม่สร้างวิดีโอและไม่โพสต์อัตโนมัติ
        </p>
        <p className="inline-flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <Eye className="mt-0.5 h-3 w-3 shrink-0" /> {EYE_CHECK}
        </p>
      </header>

      <div className="space-y-4 p-3">
        {!editable && (
          <p className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" /> {LOCK_HINT}
          </p>
        )}

        {nothingConfigured ? (
          <NotConfiguredNotice reasons={[availability.image.reason, availability.tts.reason]} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {/* ── Image ── */}
            <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium">
                <ImageIcon className="h-3.5 w-3.5" /> สร้างภาพ
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Select value={effectiveTarget} onValueChange={(v) => setImageTarget(v as ImageTargetValue)} disabled={!editable || imagePending}>
                  <SelectTrigger className="h-8 text-xs" aria-label="เป้าหมายภาพ">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thumbnail" className="text-xs">
                      ปก (thumbnail){plan?.thumbnail_concept ? ` · ${truncate(plan.thumbnail_concept, 40)}` : ` · ${truncate(title, 40)}`}
                    </SelectItem>
                    {shots.map((s, i) => (
                      <SelectItem key={i} value={`scene:${i}`} className="text-xs">
                        ฉาก {i + 1} ({formatSeconds(s.start_sec)}–{formatSeconds(s.end_sec)}){s.visual.trim() ? ` · ${truncate(s.visual, 40)}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom" className="text-xs">
                      กำหนดเอง…
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select value={aspect} onValueChange={(v) => setAspect(v as ImageAspect)} disabled={!editable || imagePending}>
                  <SelectTrigger className="h-8 w-full text-xs sm:w-[210px]" aria-label="สัดส่วนภาพ">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_ASPECTS.map((a) => (
                      <SelectItem key={a} value={a} className="text-xs">
                        {ASPECT_LABEL[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {shots.length === 0 && <p className="text-[11px] text-muted-foreground">ยังไม่มี shot ในแผนวิดีโอ — สร้างแผนวิดีโอด้านบนก่อน จึงจะสร้างภาพต่อฉากได้ (ภาพปกและกำหนดเองใช้ได้เลย)</p>}
              {effectiveTarget === "custom" && (
                <div className="space-y-1">
                  <Textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value.slice(0, MAX_CUSTOM_CHARS))}
                    rows={3}
                    maxLength={MAX_CUSTOM_CHARS}
                    disabled={!editable || imagePending}
                    placeholder="บรรยายภาพที่ต้องการ เช่น โต๊ะทำงานนักสืบตอนกลางคืน มีแฟ้มเอกสารและโคมไฟ (ห้ามหน้าคนจริง/ทะเบียนรถ/ชื่อ)"
                    className="text-xs"
                    aria-label="คำบรรยายภาพ"
                  />
                  <p className={cn("text-right text-[11px] tabular-nums", customText.length >= MAX_CUSTOM_CHARS ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                    {customText.length.toLocaleString("en-GB")}/{MAX_CUSTOM_CHARS.toLocaleString("en-GB")}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <UnavailableHint show={!availability.image.available} reason={availability.image.reason} />
                <Button size="sm" onClick={runImage} disabled={imageDisabled} title={!editable ? LOCK_HINT : !availability.image.available ? availability.image.reason : customTooShort ? "พิมพ์คำบรรยายภาพอย่างน้อย 3 ตัวอักษร" : undefined} className="ml-auto">
                  {imagePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} สร้างภาพ
                </Button>
              </div>
            </div>

            {/* ── Voice ── */}
            <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium">
                <Mic className="h-3.5 w-3.5" /> พากย์เสียง (ไทย)
              </p>
              <Select value={effectiveVoice ?? "script"} onValueChange={(v) => setVoiceSource(v as VoiceSourceValue)} disabled={!editable || voicePending || !effectiveVoice}>
                <SelectTrigger className="h-8 text-xs" aria-label="ต้นทางเสียงพากย์">
                  <SelectValue placeholder="เลือกข้อความที่จะพากย์" />
                </SelectTrigger>
                <SelectContent>
                  {voiceOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} disabled={o.disabled} className="text-xs">
                      {o.label}
                      {o.disabled && o.value === "script" ? " (ยังไม่มีสคริปต์)" : o.disabled && o.value === "hook" ? " (ยังไม่มี hook)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!effectiveVoice && <p className="text-[11px] text-muted-foreground">พิมพ์สคริปต์หรือ hook ก่อน จึงจะพากย์เสียงได้ — ระบบอ่านจากสำเนาที่บันทึกแล้วเสมอ</p>}
              <p className="text-[11px] text-muted-foreground">บันทึกอัตโนมัติก่อนพากย์ทุกครั้ง · ความยาวสูงสุด 5,000 ตัวอักษร</p>
              <div className="flex items-center justify-between gap-2">
                <UnavailableHint show={!availability.tts.available} reason={availability.tts.reason} />
                <Button size="sm" onClick={runVoice} disabled={voiceDisabled} title={!editable ? LOCK_HINT : !availability.tts.available ? availability.tts.reason : !effectiveVoice ? "ต้องมีสคริปต์หรือ hook ก่อน" : undefined} className="ml-auto">
                  {voicePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} พากย์เสียง
                </Button>
              </div>
            </div>
          </div>
        )}

        {inlineError && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs" role="alert">
            <span className="inline-flex items-start gap-1.5 text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {inlineError.message}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={inlineError.retry} disabled={!editable || (inlineError.kind === "image" ? imagePending || !availability.image.available : voicePending || !availability.tts.available)}>
                <RefreshCw className="h-3 w-3" /> ลองอีกครั้ง
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setInlineError(null)}>
                ปิด
              </Button>
            </div>
          </div>
        )}

        {/* ── Assets ── */}
        {showEmpty ? (
          <EmptyAssets nothingConfigured={nothingConfigured} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="สื่อที่สร้างแล้ว">
            {jobs.map((j, i) => (
              <li key={`job-${i}-${j.label}`}>
                <PendingCard label={j.label} kind={j.kind} />
              </li>
            ))}
            {assets.map((a) => (
              <li key={a.id}>
                <AssetCard asset={a} url={assetUrls[a.id] ?? null} editable={editable} onRefresh={() => router.refresh()} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function UnavailableHint({ show, reason }: { show: boolean; reason?: string }) {
  if (!show) return <span />;
  return (
    <p className="inline-flex min-w-0 items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
      <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
      <span className="min-w-0">
        {reason ?? "ยังไม่ได้ตั้งค่า provider"} ·{" "}
        <Link href={SETTINGS_MEDIA_HREF} className="underline-offset-2 hover:underline">
          ตั้งค่า
        </Link>
      </span>
    </p>
  );
}

function NotConfiguredNotice({ reasons }: { reasons: (string | undefined)[] }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium text-amber-700 dark:text-amber-300">ยังสร้างสื่อไม่ได้ — ไม่มี API key ของทั้งภาพและเสียง</p>
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {reasons.filter((r): r is string => !!r).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          ดูสถานะและตั้งค่าโมเดล/เสียงได้ที่{" "}
          <Link href={SETTINGS_MEDIA_HREF} className="text-primary hover:underline">
            Studio Settings → สื่อ
          </Link>
        </p>
      </div>
    </div>
  );
}

function EmptyAssets({ nothingConfigured }: { nothingConfigured: boolean }) {
  if (nothingConfigured) return null;
  return (
    <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center">
      <p className="text-sm text-muted-foreground">ยังไม่มีสื่อ</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground/70">
        “สร้างภาพ” จะวาดภาพปกหรือภาพต่อฉากจากแผนวิดีโอตามสไตล์แบรนด์ (ไม่มีหน้าคนจริง/ทะเบียน/ชื่อ) · “พากย์เสียง” จะอ่านสคริปต์เป็นเสียงไทย — ใช้เวลาประมาณ 10–60 วินาทีต่อชิ้น
      </p>
    </div>
  );
}

function PendingCard({ label, kind }: { label: string; kind: PendingJob["kind"] }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-violet-500/40 bg-violet-500/5 p-3 text-center" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground/70">{kind === "image" ? "ปกติ 10–60 วินาที" : "ปกติ 5–30 วินาที"}</p>
    </div>
  );
}

function AssetCard({ asset, url, editable, onRefresh }: { asset: CreativeAsset; url: string | null; editable: boolean; onRefresh: () => void }) {
  const [confirm, setConfirm] = useState(false);
  // Signed URLs live 10 minutes; a 403 after that surfaces as a broken <img> — show the refresh placeholder instead.
  const [broken, setBroken] = useState(false);
  const [pending, start] = useSafeTransition();
  const family = assetFamily(asset.kind);
  const label = asset.label?.trim() || kindLabel(asset.kind);

  function remove() {
    start(async () => {
      const res = await deleteMediaAsset({ assetId: asset.id });
      if (!res.ok) {
        toast.error(res.error);
        setConfirm(false);
        return;
      }
      toast.success("ลบสื่อแล้ว");
      onRefresh();
    });
  }

  return (
    <article className={cn("flex h-full flex-col overflow-hidden rounded-md border border-border/70 bg-background", pending && "opacity-60")} aria-label={label}>
      {/* Preview */}
      {asset.status === "pending" ? (
        <div className="flex aspect-video items-center justify-center bg-muted/30" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
        </div>
      ) : asset.status === "failed" ? (
        <div className="flex aspect-video flex-col items-center justify-center gap-1 bg-destructive/5 px-3 text-center">
          <TriangleAlert className="h-4 w-4 text-destructive" />
          <p className="text-[11px] text-destructive">{asset.error?.trim() || "สร้างไม่สำเร็จ"}</p>
        </div>
      ) : url == null || broken ? (
        <button type="button" onClick={onRefresh} className="flex aspect-video flex-col items-center justify-center gap-1 bg-muted/30 text-center text-[11px] text-muted-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <RefreshCw className="h-3.5 w-3.5" /> ลิงก์หมดอายุ — รีเฟรช
        </button>
      ) : family === "image" ? (
        <div className={cn("w-full overflow-hidden bg-muted/30", aspectClassFor(asset.meta, asset.width, asset.height))}>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket; next/image cannot cache it */}
          <img src={url} alt={label} className="h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} />
        </div>
      ) : family === "audio" ? (
        <div className="flex flex-col gap-1.5 bg-muted/30 px-3 py-4">
          <audio controls preload="none" src={url} className="w-full" aria-label={label} onError={() => setBroken(true)} />
          <p className="text-[11px] text-muted-foreground tabular-nums">ความยาว {formatMmSs(asset.duration_ms)}</p>
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-muted/30 text-[11px] text-muted-foreground">{kindLabel(asset.kind)}</div>
      )}

      {/* Meta */}
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-medium" title={label}>
            {label}
          </p>
          <Pill className={cn("shrink-0", family === "audio" ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400" : "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400")}>{kindLabel(asset.kind)}</Pill>
        </div>
        <p className="truncate text-[11px] text-muted-foreground" title={[asset.provider, asset.model].filter(Boolean).join(" · ")}>
          {asset.provider ?? "—"} · {asset.model ?? "—"}
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {formatBytes(asset.bytes)}
          {asset.width && asset.height ? ` · ${asset.width.toLocaleString("en-GB")}×${asset.height.toLocaleString("en-GB")}` : ""} · {formatDateTimeBkk(asset.created_at)}
        </p>
        {family === "image" && asset.status === "ready" && (
          <p className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
            <Eye className="h-3 w-3" /> ตรวจภาพด้วยตาก่อนโพสต์
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-1 pt-1">
          {url != null && !broken ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ExternalLink className="h-3 w-3" /> เปิด
            </a>
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
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirm(true)} disabled={!editable || pending} aria-label={`ลบ ${label}`} title={!editable ? LOCK_HINT : "ลบสื่อ"}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
