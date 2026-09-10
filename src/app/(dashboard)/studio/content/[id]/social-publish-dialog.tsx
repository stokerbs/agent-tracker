"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Film, Loader2, Music, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/studio/badges";
import { useSafeTransition } from "@/components/studio/use-safe-transition";
import { assetMediaKind, PLATFORM_LABEL } from "@/lib/studio/publish/captions";
import { SOCIAL_PLATFORMS, type CreativeAsset, type SocialPlatform, type YoutubeVisibility } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { formatDateTimeBkk } from "../format";
import { previewCaptions, publishToSocial, type CaptionPreview } from "./publish-actions";
import { PlatformIcon } from "./social-platform-icon";
import { formatCharBudget, platformDisabledReason, selectedMediaKinds, YOUTUBE_VISIBILITIES, YOUTUBE_VISIBILITY_LABEL } from "./social-format";

/**
 * "โพสต์ไปโซเชียล" dialog: pick platforms + media, read the exact caption
 * each platform will receive, choose now/scheduled, send. Every disabled
 * state carries its reason. The server re-validates all of it
 * (publish-actions.ts) — nothing here is a security boundary.
 */

export interface SocialPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  masterId: string;
  scheduledAt: string | null;
  /** Ready image/video assets only (see selectableAssets). */
  selectable: CreativeAsset[];
  /** Ready assets that cannot be attached yet (audio) — listed with a hint. */
  nonSelectable: CreativeAsset[];
  assetUrls: Record<string, string | null>;
  activePlatforms: SocialPlatform[];
  defaultYoutubeVisibility: YoutubeVisibility;
  /** Called after a successful publish (caller refreshes the route). */
  onPublished: (scheduled: boolean) => void;
}

type When = "now" | "scheduled";
type PreviewState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; previews: CaptionPreview[] };
type SubmitError = { message: string; details: Partial<Record<SocialPlatform, string>> };

const AUDIO_HINT = "ใช้ประกอบวิดีโอในเฟส 3";

export function SocialPublishDialog({ open, onOpenChange, masterId, scheduledAt, selectable, nonSelectable, assetUrls, activePlatforms, defaultYoutubeVisibility, onPublished }: SocialPublishDialogProps) {
  const [pending, start] = useSafeTransition();
  // The parent remounts this dialog (key) on every open, so initialising from props once is enough.
  const [picked, setPicked] = useState<SocialPlatform[]>(() => activePlatforms.filter((p) => SOCIAL_PLATFORMS.includes(p)));
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [when, setWhen] = useState<When>(scheduledAt ? "scheduled" : "now");
  const [ytVisibility, setYtVisibility] = useState<YoutubeVisibility>(defaultYoutubeVisibility);
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);

  // Load the captions each platform would receive right now (copy may have changed since the last open).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreview({ status: "loading" });
    (async () => {
      try {
        const res = await previewCaptions({ masterId });
        if (cancelled) return;
        setPreview(res.ok ? { status: "ready", previews: res.previews } : { status: "error", message: res.error });
      } catch (e) {
        console.error("[studio] previewCaptions failed:", e);
        if (!cancelled) setPreview({ status: "error", message: "โหลดตัวอย่างแคปชันไม่สำเร็จ — โหลดหน้าใหม่แล้วลองอีกครั้ง" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, masterId]);

  const kinds = useMemo(() => selectedMediaKinds(selectable, assetIds), [selectable, assetIds]);
  const reasons = useMemo(() => Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, platformDisabledReason(p, activePlatforms, kinds)])) as Record<SocialPlatform, string | null>, [activePlatforms, kinds]);
  // A platform the media selection has since made ineligible drops out silently — its checkbox shows the reason.
  const effective = useMemo(() => picked.filter((p) => reasons[p] === null), [picked, reasons]);
  const youtubeSelected = effective.includes("youtube");
  const scheduleUnavailable = when === "scheduled" && !scheduledAt;
  const canSubmit = effective.length > 0 && !scheduleUnavailable && !pending;

  function togglePlatform(p: SocialPlatform, on: boolean) {
    setPicked((prev) => (on ? (prev.includes(p) ? prev : [...prev, p]) : prev.filter((x) => x !== p)));
  }
  function toggleAsset(id: string, on: boolean) {
    // Selection order = carousel order, so append rather than sort.
    setAssetIds((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  }

  function submit() {
    if (!canSubmit) return;
    setSubmitError(null);
    start(async () => {
      const res = await publishToSocial({ masterId, platforms: effective, assetIds, when, ...(youtubeSelected ? { youtubeVisibility: ytVisibility } : {}) });
      if (!res.ok) {
        toast.error(res.error);
        setSubmitError({ message: res.error, details: res.details ?? {} });
        return;
      }
      toast.success(res.scheduled ? `ตั้งเวลาโพสต์แล้ว — Ayrshare จะโพสต์ ${formatDateTimeBkk(scheduledAt)}` : `ส่งโพสต์แล้ว ${res.posts.length.toLocaleString("en-GB")} แพลตฟอร์ม`);
      onPublished(res.scheduled);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" /> โพสต์ไปโซเชียล
          </DialogTitle>
          <DialogDescription>ส่งผ่าน Ayrshare ไปยังบัญชีที่เชื่อมไว้ — ระบบตรวจ Privacy ซ้ำก่อนส่งทุกครั้ง</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* (a) Platforms */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">แพลตฟอร์ม</legend>
            <ul className="grid gap-2 sm:grid-cols-2">
              {SOCIAL_PLATFORMS.map((p) => {
                const reason = reasons[p];
                const checked = effective.includes(p);
                const detail = submitError?.details[p];
                return (
                  <li key={p}>
                    <label className={cn("flex cursor-pointer items-start gap-2 rounded-md border border-border/70 p-2.5 text-xs", reason && "cursor-not-allowed opacity-70", checked && "border-primary/50 bg-primary/5")}>
                      <Checkbox checked={checked} disabled={!!reason || pending} onCheckedChange={(v) => togglePlatform(p, v === true)} className="mt-0.5" aria-label={PLATFORM_LABEL[p]} />
                      <span className="min-w-0 flex-1">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <PlatformIcon platform={p} className="h-3.5 w-3.5" /> {PLATFORM_LABEL[p]}
                        </span>
                        {reason && <span className="mt-0.5 block text-[11px] text-muted-foreground">{reason}</span>}
                        {detail && (
                          <span className="mt-0.5 block text-[11px] text-destructive" role="alert">
                            {detail}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {/* (b) Media */}
          <MediaPicker selectable={selectable} nonSelectable={nonSelectable} assetUrls={assetUrls} selected={assetIds} onToggle={toggleAsset} disabled={pending} />

          {/* (c) Captions */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">แคปชันที่แต่ละแพลตฟอร์มจะได้รับ</p>
            <CaptionPreviews state={preview} platforms={effective} />
          </div>

          {/* (d) When */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">เวลาโพสต์</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <WhenOption value="now" current={when} onSelect={setWhen} disabled={pending} label="โพสต์ทันที" hint="ส่งไปทุกแพลตฟอร์มตอนนี้ — สถานะคอนเทนต์เป็น “เผยแพร่แล้ว”" />
              <WhenOption
                value="scheduled"
                current={when}
                onSelect={setWhen}
                disabled={pending || !scheduledAt}
                label="ตามเวลาที่ตั้งไว้"
                hint={scheduledAt ? (new Date(scheduledAt).getTime() <= Date.now() + 60_000 ? `${formatDateTimeBkk(scheduledAt)} — เวลาผ่านไปแล้ว ตั้งเวลาใหม่ก่อน หรือเลือกโพสต์ทันที` : `${formatDateTimeBkk(scheduledAt)} — Ayrshare ถือคิวและโพสต์เมื่อถึงเวลา`) : "ยังไม่ได้ตั้งเวลา — ใช้ปุ่ม “ตั้งเวลาโพสต์” ด้านบนก่อน"}
              />
            </div>
          </fieldset>

          {/* (e) YouTube visibility */}
          {youtubeSelected && (
            <div className="space-y-1.5">
              <Label htmlFor="yt-visibility">การมองเห็นบน YouTube</Label>
              <Select value={ytVisibility} onValueChange={(v) => setYtVisibility(v as YoutubeVisibility)} disabled={pending}>
                <SelectTrigger id="yt-visibility" className="h-9 text-xs" aria-label="การมองเห็นบน YouTube">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YOUTUBE_VISIBILITIES.map((v) => (
                    <SelectItem key={v} value={v} className="text-xs">
                      {YOUTUBE_VISIBILITY_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {submitError && (
            <p className="inline-flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {submitError.message}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={!canSubmit} title={effective.length === 0 ? "เลือกอย่างน้อย 1 แพลตฟอร์ม" : scheduleUnavailable ? "ยังไม่ได้ตั้งเวลา" : undefined}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ส่งโพสต์{effective.length > 0 ? ` (${effective.length.toLocaleString("en-GB")})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function WhenOption({ value, current, onSelect, disabled, label, hint }: { value: When; current: When; onSelect: (w: When) => void; disabled: boolean; label: string; hint: string }) {
  const selected = current === value;
  return (
    <label className={cn("flex cursor-pointer items-start gap-2 rounded-md border border-border/70 p-2.5 text-xs", disabled && "cursor-not-allowed opacity-60", selected && !disabled && "border-primary/50 bg-primary/5")}>
      <input type="radio" name="social-when" value={value} checked={selected} disabled={disabled} onChange={() => onSelect(value)} className="mt-0.5 h-3.5 w-3.5 accent-primary" />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function MediaPicker({ selectable, nonSelectable, assetUrls, selected, onToggle, disabled }: { selectable: CreativeAsset[]; nonSelectable: CreativeAsset[]; assetUrls: Record<string, string | null>; selected: string[]; onToggle: (id: string, on: boolean) => void; disabled: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">สื่อที่แนบ</p>
        <span className="text-[11px] text-muted-foreground tabular-nums">เลือก {selected.length.toLocaleString("en-GB")} ชิ้น · เรียงตามลำดับที่เลือก</span>
      </div>
      {selectable.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">ยังไม่มีรูป/วิดีโอที่พร้อมใช้ — Facebook โพสต์ข้อความล้วนได้ ส่วน Instagram/TikTok/YouTube ต้องมีสื่อ</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="เลือกสื่อ">
          {selectable.map((a) => {
            const idx = selected.indexOf(a.id);
            const on = idx >= 0;
            const url = assetUrls[a.id] ?? null;
            const label = a.label?.trim() || (assetMediaKind(a) === "video" ? "วิดีโอ" : "รูป");
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onToggle(a.id, !on)}
                  disabled={disabled}
                  aria-pressed={on}
                  aria-label={`${on ? "ยกเลิก" : "เลือก"} ${label}`}
                  title={label}
                  className={cn("relative block aspect-square w-full overflow-hidden rounded-md border bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary ring-2 ring-primary/40" : "border-border/70 hover:border-border")}
                >
                  {assetMediaKind(a) === "image" && url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket; next/image cannot cache it
                    <img src={url} alt={label} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      <Film className="h-5 w-5" /> {label}
                    </span>
                  )}
                  {on && (
                    <span className="absolute left-1.5 top-1.5 inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full border border-primary bg-primary px-1 text-[11px] font-medium text-primary-foreground tabular-nums" aria-hidden="true">
                      <Check className="h-3 w-3" /> {idx + 1}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {nonSelectable.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="สื่อที่ยังแนบไม่ได้">
          {nonSelectable.map((a) => (
            <li key={a.id}>
              <Pill className="border-border bg-muted text-muted-foreground" title={AUDIO_HINT}>
                <Music className="h-3 w-3" /> {a.label?.trim() || "เสียงพากย์"} · {AUDIO_HINT}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CaptionPreviews({ state, platforms }: { state: PreviewState; platforms: SocialPlatform[] }) {
  if (state.status === "loading") {
    return (
      <div className="space-y-2" role="status" aria-live="polite" aria-label="กำลังโหลดตัวอย่างแคปชัน">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <p className="inline-flex items-start gap-1.5 text-xs text-destructive" role="alert">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {state.message}
      </p>
    );
  }
  if (platforms.length === 0) return <p className="text-xs text-muted-foreground">เลือกแพลตฟอร์มด้านบนเพื่อดูแคปชัน</p>;
  const byPlatform = new Map(state.previews.map((p) => [p.platform, p] as const));
  return (
    <ul className="space-y-2">
      {platforms.map((p) => {
        const pv = byPlatform.get(p);
        if (!pv) return null;
        const over = pv.chars >= pv.limit;
        return (
          <li key={p} className="rounded-md border border-border/70 bg-muted/10 p-2.5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                <PlatformIcon platform={p} className="h-3.5 w-3.5" /> {PLATFORM_LABEL[p]}
                {pv.fromVariant && <Pill className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400">จาก variant</Pill>}
              </span>
              <span className={cn("text-[11px] tabular-nums", over ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{formatCharBudget(pv.chars, pv.limit)}</span>
            </div>
            {pv.youtubeTitle !== undefined && (
              <p className="mb-1 text-xs">
                <span className="text-muted-foreground">ชื่อวิดีโอ: </span>
                <span className="font-medium">{pv.youtubeTitle || "—"}</span>
              </p>
            )}
            {pv.text ? <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-sans text-xs text-foreground/90">{pv.text}</pre> : <p className="text-xs text-amber-600 dark:text-amber-400">ยังไม่มีแคปชัน — พิมพ์ Caption/CTA ในคอนเทนต์ก่อน</p>}
          </li>
        );
      })}
    </ul>
  );
}
