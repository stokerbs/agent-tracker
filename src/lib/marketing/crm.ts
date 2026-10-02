/**
 * CRM vocabulary for marketing leads (migration 0128): lead quality, lost
 * reason and the acquisition channel derived from first-touch attribution.
 * Pure; the check constraints in the migration mirror these lists.
 */
export const LEAD_QUALITIES = ["unrated", "spam", "unqualified", "qualified", "high_value"] as const;
export type LeadQuality = (typeof LEAD_QUALITIES)[number];

export const LEAD_QUALITY_LABELS: Record<LeadQuality, { th: string; en: string }> = {
  unrated:     { th: "ยังไม่ประเมิน", en: "Unrated" },
  spam:        { th: "สแปม / ไม่ใช่ลูกค้า", en: "Spam" },
  unqualified: { th: "ไม่ผ่านคัดกรอง", en: "Unqualified" },
  qualified:   { th: "ผ่านคัดกรอง", en: "Qualified" },
  high_value:  { th: "มูลค่าสูง", en: "High value" },
};

/** Qualities that count as a real prospect (→ Ads offline conversion "Qualified lead"). */
export const QUALIFIED_QUALITIES: readonly LeadQuality[] = ["qualified", "high_value"];

export const LOST_REASONS = ["price", "out_of_scope", "unlawful_request", "no_response", "chose_competitor", "timing", "not_feasible", "other"] as const;
export type LostReason = (typeof LOST_REASONS)[number];

export const LOST_REASON_LABELS: Record<LostReason, { th: string; en: string }> = {
  price:            { th: "ราคา", en: "Price" },
  out_of_scope:     { th: "นอกขอบเขตบริการ", en: "Out of scope" },
  unlawful_request: { th: "ขอสิ่งที่ผิดกฎหมาย", en: "Unlawful request" },
  no_response:      { th: "ติดต่อกลับไม่ได้", en: "No response" },
  chose_competitor: { th: "เลือกเจ้าอื่น", en: "Chose competitor" },
  timing:           { th: "ยังไม่ถึงเวลา", en: "Timing" },
  not_feasible:     { th: "ทำไม่ได้ / ข้อมูลไม่พอ", en: "Not feasible" },
  other:            { th: "อื่น ๆ", en: "Other" },
};

export const CHANNELS = ["paid_search", "paid_social", "organic_search", "social", "referral", "partner", "direct", "unknown"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, { th: string; en: string }> = {
  paid_search:    { th: "โฆษณาค้นหา (Google Ads)", en: "Paid search" },
  paid_social:    { th: "โฆษณาโซเชียล", en: "Paid social" },
  organic_search: { th: "ค้นหาธรรมชาติ (SEO)", en: "Organic search" },
  social:         { th: "โซเชียล", en: "Social" },
  referral:       { th: "เว็บอ้างอิง", en: "Referral" },
  partner:        { th: "พาร์ตเนอร์", en: "Partner" },
  direct:         { th: "ตรง / ไม่ทราบที่มา", en: "Direct" },
  unknown:        { th: "ไม่ทราบ", en: "Unknown" },
};

export function isLeadQuality(v: unknown): v is LeadQuality {
  return typeof v === "string" && (LEAD_QUALITIES as readonly string[]).includes(v);
}
export function isLostReason(v: unknown): v is LostReason {
  return typeof v === "string" && (LOST_REASONS as readonly string[]).includes(v);
}
export function isChannel(v: unknown): v is Channel {
  return typeof v === "string" && (CHANNELS as readonly string[]).includes(v);
}

export interface ChannelInput {
  utm_source?: string | null;
  utm_medium?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  referrer?: string | null;
  landing_page?: string | null;
}

const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paid_search"]);
const PAID_SOURCES = new Set(["google_ads", "googleads", "adwords"]);
const PAID_SOCIAL_MEDIUMS = new Set(["paid_social", "social_paid"]);
const SOCIAL_MEDIUMS = new Set(["social", "sm"]);
const ORGANIC_MEDIUMS = new Set(["organic", "seo"]);
const SOCIAL_HOSTS = /(facebook|instagram|tiktok|line\.me|lin\.ee|youtube|x\.com|twitter|weixin|wechat)/i;
const SEARCH_HOSTS = /(google\.|bing\.|yahoo\.|duckduckgo\.|baidu\.|yandex\.)/i;
const OWN_HOST = /detectivepulse\.com/i;

/**
 * Acquisition channel from first-touch attribution. Mirrors the SQL backfill
 * in migration 0128 — change both together.
 */
export function channelFor(a: ChannelInput): Channel {
  const medium = (a.utm_medium ?? "").trim().toLowerCase();
  const source = (a.utm_source ?? "").trim();
  const ref = a.referrer ?? "";
  if (a.gclid || PAID_MEDIUMS.has(medium) || PAID_SOURCES.has(source.toLowerCase())) return "paid_search";
  if (a.fbclid || PAID_SOCIAL_MEDIUMS.has(medium)) return "paid_social";
  if (source.startsWith("partner-")) return "partner";
  if (SOCIAL_MEDIUMS.has(medium) || SOCIAL_HOSTS.test(ref)) return "social";
  if (SEARCH_HOSTS.test(ref) || ORGANIC_MEDIUMS.has(medium)) return "organic_search";
  if (ref && !OWN_HOST.test(ref)) return "referral";
  if (a.landing_page) return "direct";
  return "unknown";
}
