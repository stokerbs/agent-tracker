import { STOP_REASON_TH } from "@/lib/studio/autopilot/plan";
import type { AutopilotRunStatus, AutopilotSettings } from "@/lib/studio/types";

/**
 * Pure UI helpers for the autopilot section (phase 4). No I/O, no React —
 * unit-tested in autopilot-format.test.ts. Every check here is UX feedback
 * only: settings/actions.ts (zod) and lib/studio/autopilot/run.ts re-validate
 * the config and re-run every hard stop on the server.
 */

/** Sunday-first, matching `days` (0 = Sunday) and `bangkokDay()`. */
export const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;
export const THAI_DAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;
export const THAI_DAYS_LONG = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"] as const;

/** Bangkok wall-clock time the cron checks whether a run is due. */
export const CRON_TIME_TH = "02:10 น. (เวลาไทย)";
/** Image cost used in the settings hint — the real invoice comes from Gemini. */
export const IMAGE_COST_THB = 1.5;

export function dayNameLong(day: number): string {
  return THAI_DAYS_LONG[day] ?? String(day);
}

/** "จันทร์ · พฤหัสบดี" in week order — never an empty string. */
export function formatDays(days: number[]): string {
  const sorted = Array.from(new Set(days.filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b);
  return sorted.length ? sorted.map(dayNameLong).join(" · ") : "ยังไม่ได้เลือกวัน";
}

/** The next day the cron may run, counting today. null when no day is selected. */
export function nextRunDay(days: number[], today: number): { day: number; inDays: number } | null {
  const set = new Set(days.filter((d) => d >= 0 && d <= 6));
  if (!set.size) return null;
  for (let i = 0; i < 7; i += 1) {
    const day = (today + i) % 7;
    if (set.has(day)) return { day, inDays: i };
  }
  return null;
}

/** "วันนี้ (จันทร์)" · "พรุ่งนี้ (อังคาร)" · "วันพฤหัสบดี (อีก 3 วัน)". */
export function nextRunLabel(days: number[], today: number): string {
  const next = nextRunDay(days, today);
  if (!next) return "ยังไม่ได้เลือกวัน";
  if (next.inDays === 0) return `วันนี้ (${dayNameLong(next.day)})`;
  if (next.inDays === 1) return `พรุ่งนี้ (${dayNameLong(next.day)})`;
  return `วัน${dayNameLong(next.day)} (อีก ${next.inDays.toLocaleString("en-GB")} วัน)`;
}

export interface RunStatusMeta {
  label: string;
  className: string;
  dot: string;
}

export const RUN_STATUSES: AutopilotRunStatus[] = ["running", "done", "failed", "skipped", "review"];

export const RUN_STATUS_META: Record<AutopilotRunStatus, RunStatusMeta> = {
  running: { label: "กำลังทำงาน", className: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400", dot: "bg-sky-500 animate-pulse" },
  done: { label: "สำเร็จ", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  failed: { label: "ล้มเหลว", className: "border-destructive/30 bg-destructive/10 text-destructive", dot: "bg-destructive" },
  skipped: { label: "ข้ามรอบ", className: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  review: { label: "รอตรวจ", className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
};

/** DB column is `text`; anything unexpected renders as "ข้ามรอบ" rather than crashing the pill. */
export function normaliseRunStatus(status: string): AutopilotRunStatus {
  return (RUN_STATUSES as readonly string[]).includes(status) ? (status as AutopilotRunStatus) : "skipped";
}

/** Thai for a machine-readable stop reason; unknown keys fall back to the raw key. */
export function stopReasonTh(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return STOP_REASON_TH[reason] ?? reason;
}

/** One line for the run: the stop reason wins over the step, because it says *why* it ended. */
export function runReason(run: { step: string | null; stopped_at: string | null }): string {
  return stopReasonTh(run.stopped_at) ?? run.step ?? "—";
}

/** "ภาพ 2 · ช็อต 5 · วิดีโอ 30 วิ · โพสต์ 2" from the jsonb counters — "" when empty/malformed. */
export function runStatsSummary(stats: unknown): string {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return "";
  const s = stats as Record<string, unknown>;
  const num = (k: string): number | null => (typeof s[k] === "number" && Number.isFinite(s[k]) ? (s[k] as number) : null);
  const parts: string[] = [];
  const images = num("images");
  const shots = num("shots");
  const videoSec = num("video_sec");
  const posts = num("posts");
  if (images !== null) parts.push(`ภาพ ${images.toLocaleString("en-GB")}`);
  if (shots !== null) parts.push(`ช็อต ${shots.toLocaleString("en-GB")}`);
  if (videoSec !== null) parts.push(`วิดีโอ ${videoSec.toLocaleString("en-GB")} วิ`);
  if (posts !== null) parts.push(`โพสต์ ${posts.toLocaleString("en-GB")}`);
  return parts.join(" · ");
}

/** "~฿3" — image spend per run at the current setting. */
export function imageCostHint(imagesPerRun: number): string {
  const total = Math.max(0, imagesPerRun) * IMAGE_COST_THB;
  return `~฿${total.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

/**
 * Reasons the config cannot be saved yet — mirrors the zod schema in
 * settings/actions.ts so the owner sees the problem before the round-trip.
 * The server is still the authority; this only disables the button.
 */
export function autopilotIssues(cfg: AutopilotSettings): string[] {
  const issues: string[] = [];
  if (!cfg.days.length) issues.push("เลือกอย่างน้อย 1 วัน");
  if (!cfg.platforms.length) issues.push("เลือกอย่างน้อย 1 แพลตฟอร์ม");
  if (cfg.pillar_mode === "fixed" && !cfg.pillar) issues.push("เลือกเสาคอนเทนต์ที่ต้องการกำหนดเอง");
  if (cfg.images_per_run < 1 || cfg.images_per_run > 6) issues.push("จำนวนภาพต่อรอบต้องอยู่ระหว่าง 1–6");
  if (cfg.max_runs_per_week < 1 || cfg.max_runs_per_week > 14) issues.push("จำนวนรอบต่อสัปดาห์ต้องอยู่ระหว่าง 1–14");
  return issues;
}
