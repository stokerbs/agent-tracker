"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSafeTransition } from "@/components/studio/use-safe-transition";
import { bangkokDay } from "@/lib/studio/autopilot/plan";
import { PILLARS, PILLAR_META } from "@/lib/studio/constants";
import { PLATFORM_LABEL } from "@/lib/studio/publish/captions";
import { SOCIAL_PLATFORMS, TARGET_DURATIONS, type AutopilotSettings, type AutopilotVideoFormat, type Pillar, type SocialPlatform, type TargetDuration } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import {
  AUTOPILOT_FORMATS,
  AUTOPILOT_FORMAT_META,
  CRON_TIME_TH,
  DAY_INDEXES,
  IMAGE_COST_THB,
  THAI_DAYS_LONG,
  THAI_DAYS_SHORT,
  autopilotIssues,
  imageCostHint,
  nextRunLabel,
} from "./autopilot-format";
import { updateAutopilot } from "./actions";

/**
 * Autopilot config (phase 4): when the studio may produce a finished post by
 * itself and how far it may go without a human. The client checks here are UX
 * feedback only — settings/actions.ts re-validates with zod and the runner
 * enforces the hard stops (a blocked Privacy Check always stops the run).
 */

const PLATFORM_HINT: Partial<Record<SocialPlatform, string>> = {
  youtube: "ต้องมีวิดีโอและบัญชี YouTube ที่เชื่อมต่อแล้ว",
  tiktok: "ต้องมีวิดีโอ — รอบอัตโนมัติสร้างวิดีโอเทมเพลตให้เสมอ",
};

/** Appended to the image cost hint: the storyteller presenter is one more image. */
const PRESENTER_COST_NOTE: Record<AutopilotVideoFormat, string> = {
  template: "",
  storyteller: " รวมภาพนักสืบ",
  alternate: " บางรอบรวมภาพนักสืบ",
};

const PILLAR_MODE_LABEL: Record<AutopilotSettings["pillar_mode"], string> = {
  rotate: "หมุนเวียนตามสัดส่วน",
  fixed: "กำหนดเอง",
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function AutopilotForm({ initial }: { initial: AutopilotSettings }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<AutopilotSettings>(initial);
  const [pending, start] = useSafeTransition();
  // Computed after mount: the server and the browser can disagree across a
  // Bangkok midnight tick, and a hydration mismatch is not worth the flash.
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => setToday(bangkokDay(new Date())), []);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(initial);
  const issues = autopilotIssues(cfg);

  function set<K extends keyof AutopilotSettings>(k: K, v: AutopilotSettings[K]) {
    setCfg((c) => ({ ...c, [k]: v }));
  }

  function toggleDay(day: number) {
    setCfg((c) => ({ ...c, days: c.days.includes(day) ? c.days.filter((d) => d !== day) : [...c.days, day].sort((a, b) => a - b) }));
  }

  function togglePlatform(p: SocialPlatform, on: boolean) {
    setCfg((c) => ({ ...c, platforms: on ? Array.from(new Set([...c.platforms, p])) : c.platforms.filter((x) => x !== p) }));
  }

  function setPillarMode(mode: AutopilotSettings["pillar_mode"]) {
    // The server refuses fixed + null, so pre-fill the first pillar on switch.
    setCfg((c) => ({ ...c, pillar_mode: mode, pillar: mode === "fixed" ? (c.pillar ?? PILLARS[0]) : null }));
  }

  function save() {
    start(async () => {
      const res = await updateAutopilot(cfg);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(cfg.enabled ? "บันทึกแล้ว — โหมดอัตโนมัติเปิดอยู่" : "บันทึกแล้ว — โหมดอัตโนมัติปิดอยู่");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Master switch */}
      <div className={cn("flex items-center justify-between gap-4 rounded-lg border p-3", cfg.enabled ? "border-primary/40 bg-primary/5" : "bg-muted/20")}>
        <div className="min-w-0">
          <p className="text-sm font-medium">เปิดโหมดอัตโนมัติ</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ระบบตรวจรอบทุกวันเวลา {CRON_TIME_TH} — ถ้าตรงกับวันที่เลือกและยังไม่ครบโควตา จะผลิตคอนเทนต์ 1 ชิ้นตั้งแต่เลือกหัวข้อจนถึงวิดีโอ
          </p>
        </div>
        <Switch checked={cfg.enabled} onCheckedChange={(v) => set("enabled", v)} disabled={pending} aria-label="เปิดโหมดอัตโนมัติ" />
      </div>

      {/* What "auto publish" really means */}
      {cfg.auto_publish ? (
        <div className="flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">โหมดนี้จะโพสต์ขึ้นเพจจริงโดยไม่มีคนอ่านก่อน</p>
            <p>
              สตูดิโอจะเขียนสคริปต์ สร้างภาพ พากย์เสียง ตัดต่อวิดีโอ อนุมัติเอง แล้วโพสต์ไปยังแพลตฟอร์มที่เลือก — ไม่มีใครตรวจข้อความก่อนเผยแพร่
            </p>
            <p className="font-medium">
              Privacy Check ที่ได้ผล “blocked” จะหยุดรอบนั้นเสมอ ไม่มีการข้าม — คอนเทนต์จะถูกพักไว้ที่สถานะรอตรวจให้เจ้าของดูเอง
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          ปิด “โพสต์เองอัตโนมัติ” อยู่ — ระบบจะผลิตจนเสร็จแล้วพักไว้ที่สถานะ “รอตรวจ” ให้เจ้าของกดโพสต์เอง
        </p>
      )}

      {/* Days */}
      <div className="space-y-1.5">
        <Label>วันที่ทำงาน</Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="วันที่ทำงาน">
          {DAY_INDEXES.map((d) => {
            const on = cfg.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                disabled={pending}
                aria-pressed={on}
                title={THAI_DAYS_LONG[d]}
                className={cn(
                  "h-9 w-12 rounded-md border text-xs font-medium transition-colors disabled:opacity-60",
                  on ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                {THAI_DAYS_SHORT[d]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {cfg.days.length === 0
            ? "ยังไม่ได้เลือกวัน — ต้องเลือกอย่างน้อย 1 วัน"
            : today === null
              ? `เลือกไว้ ${cfg.days.length.toLocaleString("en-GB")} วันต่อสัปดาห์`
              : `รอบถัดไป: ${nextRunLabel(cfg.days, today)}${cfg.enabled ? "" : " (ยังปิดอยู่ จึงจะไม่ทำงาน)"}`}
        </p>
      </div>

      {/* Platforms */}
      <div className="space-y-1.5">
        <Label>แพลตฟอร์มที่จะโพสต์</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SOCIAL_PLATFORMS.map((p) => {
            const on = cfg.platforms.includes(p);
            return (
              <label
                key={p}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  on ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/40",
                  pending && "pointer-events-none opacity-60",
                )}
              >
                <Checkbox checked={on} onCheckedChange={(v) => togglePlatform(p, v === true)} disabled={pending} aria-label={PLATFORM_LABEL[p]} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{PLATFORM_LABEL[p]}</p>
                  {PLATFORM_HINT[p] && <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{PLATFORM_HINT[p]}</p>}
                </div>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">ต้องเชื่อมบัญชีใน Ayrshare ก่อน — แพลตฟอร์มที่ยังไม่เชื่อมจะถูกข้ามและบันทึกเป็นเหตุผลที่หยุดรอบ</p>
      </div>

      {/* Pillar + duration */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="autopilot-pillar-mode">การเลือกเสาคอนเทนต์</Label>
          <Select value={cfg.pillar_mode} onValueChange={(v) => setPillarMode(v as AutopilotSettings["pillar_mode"])} disabled={pending}>
            <SelectTrigger id="autopilot-pillar-mode" className="h-9" aria-label="การเลือกเสาคอนเทนต์">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rotate">{PILLAR_MODE_LABEL.rotate}</SelectItem>
              <SelectItem value="fixed">{PILLAR_MODE_LABEL.fixed}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {cfg.pillar_mode === "rotate" ? "เลือกเสาที่ห่างจากเป้าหมายสัดส่วนมากที่สุดในแต่ละรอบ" : "ใช้เสาเดิมทุกรอบตามที่กำหนด"}
          </p>
        </div>

        {cfg.pillar_mode === "fixed" && (
          <div className="space-y-1.5">
            <Label htmlFor="autopilot-pillar">เสาคอนเทนต์ที่กำหนด</Label>
            <Select value={cfg.pillar ?? undefined} onValueChange={(v) => set("pillar", v as Pillar)} disabled={pending}>
              <SelectTrigger id="autopilot-pillar" className="h-9" aria-label="เสาคอนเทนต์ที่กำหนด">
                <SelectValue placeholder="เลือกเสาคอนเทนต์" />
              </SelectTrigger>
              <SelectContent>
                {PILLARS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PILLAR_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{cfg.pillar ? PILLAR_META[cfg.pillar].description : "ต้องเลือกก่อนบันทึก"}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="autopilot-duration">ความยาวเป้าหมาย</Label>
          <Select value={String(cfg.target_seconds)} onValueChange={(v) => set("target_seconds", Number(v) as TargetDuration)} disabled={pending}>
            <SelectTrigger id="autopilot-duration" className="h-9" aria-label="ความยาวเป้าหมาย">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_DURATIONS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s.toLocaleString("en-GB")} วินาที
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">ใช้กับสคริปต์และวิดีโอเทมเพลตของรอบอัตโนมัติ</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="autopilot-format">รูปแบบคลิป</Label>
          <Select value={cfg.video_format} onValueChange={(v) => set("video_format", v as AutopilotVideoFormat)} disabled={pending}>
            <SelectTrigger id="autopilot-format" className="h-9" aria-label="รูปแบบคลิป">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTOPILOT_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {AUTOPILOT_FORMAT_META[f].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{AUTOPILOT_FORMAT_META[cfg.video_format].hint}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="autopilot-images">จำนวนภาพต่อรอบ</Label>
          <Input
            id="autopilot-images"
            type="number"
            min={1}
            max={6}
            value={cfg.images_per_run}
            onChange={(e) => set("images_per_run", clamp(Number(e.target.value), 1, 6))}
            disabled={pending}
            className="h-9 w-28 tabular-nums"
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground">
            1 = ภาพปกอย่างเดียว · มากกว่านั้นคือภาพประกอบรายช็อต — ค่าใช้จ่ายภาพประมาณ ฿{IMAGE_COST_THB.toLocaleString("en-GB")} ต่อภาพ (รอบนี้ {imageCostHint(cfg.images_per_run, cfg.video_format)}
            {PRESENTER_COST_NOTE[cfg.video_format]})
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="autopilot-max-runs">จำนวนรอบสูงสุดต่อสัปดาห์</Label>
          <Input
            id="autopilot-max-runs"
            type="number"
            min={1}
            max={14}
            value={cfg.max_runs_per_week}
            onChange={(e) => set("max_runs_per_week", clamp(Number(e.target.value), 1, 14))}
            disabled={pending}
            className="h-9 w-28 tabular-nums"
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground">เพดานกันหลุด — ครบแล้วรอบถัดไปจะถูกข้ามแม้ตรงวัน</p>
        </div>
      </div>

      {/* How far it may go without a human */}
      <div className="space-y-3">
        <SwitchRow
          label="โพสต์เองอัตโนมัติ"
          hint="ถ้าปิด: ผลิตจนเสร็จแล้วพักไว้ที่สถานะ “รอตรวจ” ให้เจ้าของกดโพสต์เอง"
          checked={cfg.auto_publish}
          onChange={(v) => set("auto_publish", v)}
          disabled={pending}
        />
        <SwitchRow
          tone="caution"
          label="โพสต์แม้ Privacy Check ขอให้ตรวจ"
          hint="ผล review_required = มีจุดที่ควรมีคนดู เช่น ชื่อ สถานที่ หรือรายละเอียดที่อาจย้อนไปถึงเคสจริง · ผล blocked ยังหยุดเสมอไม่ว่าตั้งค่าอย่างไร"
          checked={cfg.publish_on_review_required}
          onChange={(v) => set("publish_on_review_required", v)}
          disabled={pending}
        />
        <SwitchRow
          tone="caution"
          label="ยอมให้มีข้อความที่ยังไม่มีแหล่งอ้างอิง"
          hint="ถ้าปิด: พบข้อความที่ AI ยังอ้างอิงคลังความรู้ไม่ได้ จะหยุดรอบและรอให้คนตรวจ — ปิดไว้จะปลอดภัยกว่าสำหรับแบรนด์นักสืบ"
          checked={cfg.allow_unsupported_claims}
          onChange={(v) => set("allow_unsupported_claims", v)}
          disabled={pending}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {issues.length > 0 && <span className="text-xs text-amber-600 dark:text-amber-400">{issues.join(" · ")}</span>}
        {issues.length === 0 && dirty && <span className="text-xs text-muted-foreground">มีการแก้ไขที่ยังไม่บันทึก</span>}
        <Button onClick={save} disabled={pending || !dirty || issues.length > 0} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  tone = "default",
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** "caution" = the switch lets the autopilot skip a human check. */
  tone?: "default" | "caution";
}) {
  const warn = tone === "caution" && checked;
  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-lg border p-3", warn && "border-amber-500/40 bg-amber-500/5")}>
      <div className="min-w-0">
        <p className={cn("flex items-center gap-1.5 text-sm font-medium", warn && "text-amber-700 dark:text-amber-300")}>
          {warn && <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          {label}
        </p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </div>
  );
}
