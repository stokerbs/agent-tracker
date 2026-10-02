/**
 * Retention rule for marketing leads (privacy notice: "enquiries that do not
 * lead to an engagement are reviewed and deleted on a 12-month cycle after
 * being closed, or earlier on request"). Pure, unit-tested; the cron at
 * /api/cron/purge-marketing-leads applies it, gated by MARKETING_LEAD_PURGE
 * (owner item C5 in docs/seo-growth-audit/facts-to-confirm.md).
 *
 * A lead is purgeable when it never converted AND it is no longer live
 * (closed / referral stage, rated spam or unqualified, or still "new" and
 * never touched) AND its last change is older than the retention window.
 * Converted leads are client records and are never purged here.
 */
export const LEAD_RETENTION_DAYS = 365;

export interface RetentionLeadRow {
  id: string;
  stage: string | null;
  lead_quality: string | null;
  converted_at: string | null;
  stage_changed_at: string | null;
  created_at: string;
}

const DEAD_STAGES = new Set(["closed", "referral"]);
const DEAD_QUALITIES = new Set(["spam", "unqualified"]);

export function retentionCutoff(now: Date = new Date(), days: number = LEAD_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

export function isPurgeable(l: RetentionLeadRow, now: Date = new Date()): boolean {
  if (l.converted_at) return false;
  const dead = DEAD_STAGES.has(l.stage ?? "") || DEAD_QUALITIES.has(l.lead_quality ?? "") || (l.stage ?? "new") === "new";
  if (!dead) return false;
  const ref = new Date(l.stage_changed_at ?? l.created_at);
  return Number.isFinite(ref.getTime()) && ref < retentionCutoff(now);
}

export type PurgeMode = "off" | "dry" | "on";

/** MARKETING_LEAD_PURGE: unset/other → off, "dry" → report only, "1" → delete. */
export function purgeMode(env: Record<string, string | undefined> = process.env): PurgeMode {
  const v = env.MARKETING_LEAD_PURGE;
  if (v === "1") return "on";
  if (v === "dry") return "dry";
  return "off";
}
