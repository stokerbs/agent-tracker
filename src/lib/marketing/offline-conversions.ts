/**
 * Google Ads offline-conversion import rows (audit Days 31–90: "offline
 * conversion upload (qualified / paid) to Google Ads"). Pure builder: takes
 * lead rows that carry a gclid and emits the CSV Google Ads accepts for
 * "Conversions from clicks" uploads (one row per conversion event).
 *
 * Conversion names must exist in the Google Ads account first (owner /
 * agency item C8 in facts-to-confirm.md). Times are formatted in Bangkok
 * time with the offset Google requires ("yyyy-MM-dd HH:mm:ss+07:00").
 */
export const OFFLINE_CONVERSION_NAMES = {
  qualified: "Qualified lead",
  paid: "Paid case",
} as const;

export interface OfflineLeadRow {
  gclid: string | null;
  created_at: string;
  stage_changed_at: string | null;
  converted_at: string | null;
  lead_quality: string | null;
  final_revenue: number | string | null;
  quoted_value: number | string | null;
}

export interface OfflineConversion {
  gclid: string;
  name: string;
  time: string;
  value: number;
  currency: "THB";
}

const BANGKOK_OFFSET_MIN = 7 * 60;

/** "yyyy-MM-dd HH:mm:ss+07:00" in Asia/Bangkok (fixed offset, no DST). */
export function formatBangkok(iso: string): string {
  const d = new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MIN * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+07:00`;
}

const num = (v: number | string | null | undefined) => { const n = typeof v === "number" ? v : Number(v ?? 0); return Number.isFinite(n) && n > 0 ? n : 0; };
const GCLID = /^[A-Za-z0-9_-]{10,200}$/;

/** Conversions for one lead: "Qualified lead" (no value) and/or "Paid case" (revenue). */
export function conversionsForLead(l: OfflineLeadRow): OfflineConversion[] {
  if (!l.gclid || !GCLID.test(l.gclid)) return [];
  const out: OfflineConversion[] = [];
  const qualified = l.lead_quality === "qualified" || l.lead_quality === "high_value" || Boolean(l.converted_at);
  if (qualified) out.push({ gclid: l.gclid, name: OFFLINE_CONVERSION_NAMES.qualified, time: formatBangkok(l.stage_changed_at ?? l.created_at), value: 0, currency: "THB" });
  if (l.converted_at) out.push({ gclid: l.gclid, name: OFFLINE_CONVERSION_NAMES.paid, time: formatBangkok(l.converted_at), value: num(l.final_revenue) || num(l.quoted_value), currency: "THB" });
  return out;
}

const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Google Ads "Conversions from clicks" CSV, with the required Parameters line. */
export function offlineConversionsCsv(rows: OfflineLeadRow[]): string {
  const lines = ["Parameters:TimeZone=Asia/Bangkok", "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency"];
  for (const l of rows) for (const c of conversionsForLead(l)) lines.push([esc(c.gclid), esc(c.name), c.time, c.value ? String(c.value) : "", c.currency].join(","));
  return lines.join("\r\n") + "\r\n";
}
