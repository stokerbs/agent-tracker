import { z } from "zod";

/**
 * Ad-spend import (migration 0128, table marketing_ad_spend) and cost-per-lead
 * maths for /marketing-insights. Pure: parses the CSV text an admin pastes
 * from a Google Ads / Meta export, normalises headers in English or Thai, and
 * returns typed rows or per-line errors. The server action re-validates every
 * row with the zod schema before upserting — nothing client-parsed is trusted.
 */
export const AD_PLATFORMS = ["google_ads", "meta", "line", "other"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];
export const AD_LOCALES = ["th", "en", "zh", "all"] as const;
export type AdLocale = (typeof AD_LOCALES)[number];

export const adSpendRowSchema = z.object({
  spend_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: z.enum(AD_PLATFORMS),
  campaign: z.string().trim().max(200).default(""),
  locale: z.enum(AD_LOCALES).default("all"),
  cost: z.number().min(0).max(100_000_000),
  clicks: z.number().int().min(0).max(100_000_000).default(0),
  impressions: z.number().int().min(0).max(10_000_000_000).default(0),
  conversions: z.number().min(0).max(1_000_000).default(0),
});
export type AdSpendRow = z.infer<typeof adSpendRowSchema>;

const HEADER_ALIASES: Record<keyof AdSpendRow, string[]> = {
  spend_date: ["date", "day", "spend_date", "วัน", "วันที่", "reporting starts", "reporting_starts"],
  platform: ["platform", "network", "แพลตฟอร์ม"],
  campaign: ["campaign", "campaign name", "campaign_name", "แคมเปญ", "ชื่อแคมเปญ"],
  locale: ["locale", "language", "lang", "ภาษา"],
  cost: ["cost", "spend", "amount spent", "amount spent (thb)", "cost (thb)", "ค่าใช้จ่าย", "ยอดใช้จ่าย"],
  clicks: ["clicks", "link clicks", "คลิก", "จำนวนคลิก"],
  impressions: ["impressions", "impr.", "impr", "การแสดงผล", "อิมเพรสชัน"],
  conversions: ["conversions", "conv.", "results", "คอนเวอร์ชัน", "ผลลัพธ์"],
};

export interface ParsedAdSpend {
  rows: AdSpendRow[];
  errors: { line: number; message: string }[];
}

/** Minimal CSV split handling quoted fields and commas inside quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === "," && !q) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toNumber(s: string | undefined): number | null {
  if (s === undefined) return null;
  const cleaned = s.replace(/[฿$€,\s]/g, "").replace(/^--$/, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // d/m/yyyy (Thai / UK)
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  m = t.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function guessPlatform(s: string | undefined, fallback: AdPlatform): AdPlatform {
  const v = (s ?? "").toLowerCase();
  if (/google|search|adwords/.test(v)) return "google_ads";
  if (/meta|facebook|instagram/.test(v)) return "meta";
  if (/line/.test(v)) return "line";
  return (AD_PLATFORMS as readonly string[]).includes(v) ? (v as AdPlatform) : fallback;
}

function guessLocale(s: string | undefined, campaign: string, fallback: AdLocale): AdLocale {
  const v = (s ?? "").toLowerCase();
  if ((AD_LOCALES as readonly string[]).includes(v)) return v as AdLocale;
  const c = campaign.toLowerCase();
  if (/\b(en|eng|english|intl|international)\b/.test(c)) return "en";
  if (/\b(zh|cn|chinese|中文)\b/.test(c)) return "zh";
  if (/\b(th|thai|ไทย)\b/.test(c)) return "th";
  return fallback;
}

/**
 * Parse pasted CSV (header row required). `defaults` fill columns the export
 * lacks (platform and locale are usually not in a Google Ads export).
 */
export function parseAdSpendCsv(text: string, defaults: { platform: AdPlatform; locale: AdLocale }): ParsedAdSpend {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: ParsedAdSpend["errors"] = [];
  if (lines.length < 2) return { rows: [], errors: [{ line: 1, message: "ต้องมีแถวหัวตารางและข้อมูลอย่างน้อย 1 แถว" }] };
  // Google Ads exports prepend 2 title lines before the header; find the header row.
  let headerIdx = lines.findIndex((l) => {
    const cells = splitCsvLine(l).map((c) => c.toLowerCase());
    return cells.some((c) => HEADER_ALIASES.spend_date.includes(c)) && cells.some((c) => HEADER_ALIASES.cost.includes(c));
  });
  if (headerIdx === -1) headerIdx = 0;
  const header = splitCsvLine(lines[headerIdx]!).map((c) => c.toLowerCase());
  const col = (key: keyof AdSpendRow) => header.findIndex((h) => HEADER_ALIASES[key].includes(h));
  const idx = Object.fromEntries((Object.keys(HEADER_ALIASES) as (keyof AdSpendRow)[]).map((k) => [k, col(k)])) as Record<keyof AdSpendRow, number>;
  if (idx.spend_date === -1 || idx.cost === -1) {
    return { rows: [], errors: [{ line: headerIdx + 1, message: "ไม่พบคอลัมน์วันที่ (Date/Day) หรือค่าใช้จ่าย (Cost) ในหัวตาราง" }] };
  }
  const rows: AdSpendRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const get = (k: keyof AdSpendRow) => (idx[k] >= 0 ? cells[idx[k]] : undefined);
    const dateRaw = get("spend_date") ?? "";
    // Skip Google Ads total/summary rows.
    if (/^total/i.test(dateRaw) || /^รวม/.test(dateRaw)) continue;
    const spend_date = toIsoDate(dateRaw);
    const cost = toNumber(get("cost"));
    if (!spend_date) { errors.push({ line: i + 1, message: `วันที่ไม่ถูกต้อง: "${dateRaw}"` }); continue; }
    if (cost === null) { errors.push({ line: i + 1, message: `ค่าใช้จ่ายไม่ถูกต้อง: "${get("cost") ?? ""}"` }); continue; }
    const campaign = (get("campaign") ?? "").slice(0, 200);
    const candidate = {
      spend_date,
      platform: guessPlatform(get("platform"), defaults.platform),
      campaign,
      locale: guessLocale(get("locale"), campaign, defaults.locale),
      cost,
      clicks: Math.round(toNumber(get("clicks")) ?? 0),
      impressions: Math.round(toNumber(get("impressions")) ?? 0),
      conversions: toNumber(get("conversions")) ?? 0,
    };
    const parsed = adSpendRowSchema.safeParse(candidate);
    if (!parsed.success) { errors.push({ line: i + 1, message: parsed.error.issues[0]?.message ?? "แถวไม่ถูกต้อง" }); continue; }
    rows.push(parsed.data);
  }
  return { rows, errors };
}

export interface SpendLike { platform: string; locale: string; cost: number | string; spend_date: string }
export interface LeadLike { channel: string | null; locale: string; created_at: string; lead_quality?: string | null; converted_at?: string | null; final_revenue?: number | string | null }

const num = (v: number | string | null | undefined) => { const n = typeof v === "number" ? v : Number(v ?? 0); return Number.isFinite(n) ? n : 0; };

/** Channel a platform's spend is expected to produce leads in. */
export const PLATFORM_CHANNEL: Record<AdPlatform, "paid_search" | "paid_social"> = { google_ads: "paid_search", meta: "paid_social", line: "paid_social", other: "paid_social" };

export interface CplRow {
  platform: AdPlatform;
  cost: number;
  leads: number;
  qualified: number;
  paid: number;
  revenue: number;
  /** cost / leads, null when no leads. */
  cpl: number | null;
  /** cost / qualified leads. */
  cpql: number | null;
  /** revenue / cost, null when no cost. */
  roas: number | null;
}

/**
 * Cost per lead per platform for a window: spend in the window vs paid-channel
 * leads created in the window (same locale when the spend is locale-tagged).
 */
export function costPerLead(spend: SpendLike[], leads: LeadLike[], window: { from: Date; to: Date }): CplRow[] {
  const inWin = (iso: string) => { const t = new Date(iso).getTime(); return t >= window.from.getTime() && t <= window.to.getTime(); };
  const out: CplRow[] = [];
  for (const platform of AD_PLATFORMS) {
    const rows = spend.filter((s) => s.platform === platform && inWin(`${s.spend_date}T12:00:00Z`));
    if (rows.length === 0) continue;
    const cost = rows.reduce((a, r) => a + num(r.cost), 0);
    const locales = new Set(rows.map((r) => r.locale));
    const channel = PLATFORM_CHANNEL[platform];
    const matched = leads.filter((l) => l.channel === channel && inWin(l.created_at) && (locales.has("all") || locales.has(l.locale)));
    const qualified = matched.filter((l) => l.lead_quality === "qualified" || l.lead_quality === "high_value" || l.converted_at).length;
    const paid = matched.filter((l) => l.converted_at).length;
    const revenue = matched.reduce((a, l) => a + num(l.final_revenue), 0);
    out.push({
      platform, cost, leads: matched.length, qualified, paid, revenue,
      cpl: matched.length ? cost / matched.length : null,
      cpql: qualified ? cost / qualified : null,
      roas: cost > 0 ? revenue / cost : null,
    });
  }
  return out;
}
