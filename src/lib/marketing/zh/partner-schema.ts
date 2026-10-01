import { z } from "zod";
import { ZH_COUNTRIES } from "./intake-schema";

/**
 * B2B partner application contract (docs/china-market/13). Shared by the
 * /zh/partners form (labels) and /api/marketing/partner (the authority).
 */
export const ZH_PARTNER_TYPES = [
  "law_firm", "chinese_company", "consultant", "accounting", "advisory", "relocation", "investment", "risk", "lawyer", "other",
] as const;

/** Services a partner can refer — the B2B positioning list. */
export const ZH_PARTNER_SERVICES = [
  "due_diligence", "company_verification", "on_site", "counterparty", "supplier", "asset", "litigation_support",
] as const;

export const ZH_PARTNER_VOLUMES = ["occasional", "monthly_1_3", "monthly_4_10", "over_10"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const zhPartnerSchema = z
  .object({
    orgName: z.string().trim().min(2).max(120),
    partnerType: z.enum(ZH_PARTNER_TYPES),
    contactName: z.string().trim().min(1).max(80),
    wechatId: optionalText(60),
    email: z.string().trim().max(120).email().optional().or(z.literal("")),
    phone: optionalText(30),
    city: optionalText(60),
    country: z.enum(ZH_COUNTRIES),
    // http(s) only — zod's .url() alone accepts javascript:/data: schemes.
    orgWebsite: z.string().trim().max(200).url().refine((u) => /^https?:\/\//i.test(u), "http(s) only").optional().or(z.literal("")),
    services: z.array(z.enum(ZH_PARTNER_SERVICES)).min(1).max(ZH_PARTNER_SERVICES.length),
    expectedVolume: z.enum(ZH_PARTNER_VOLUMES),
    message: optionalText(1500),
    consent: z.literal(true),
    // Honeypot — hidden from humans.
    website: z.string().max(200).optional(),
  })
  .refine((d) => Boolean(d.wechatId || d.email || d.phone), { message: "contact_required", path: ["wechatId"] });

export type ZhPartnerInput = z.infer<typeof zhPartnerSchema>;

/** Referral slug used as utm_source on links the partner shares. The tail is
 *  6 crypto-random symbols (31^6 ≈ 887M) so a slug cannot be guessed from the
 *  org name and used to spoof attribution. Counts stay indicative, never
 *  payable, until a lead is explicitly linked to a partner by an admin. */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const TAIL_LENGTH = 6;
function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]! / 0x1_0000_0000;
}
export function generateReferralSlug(orgName: string, random: () => number = cryptoRandom): string {
  const base = orgName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")                 // "Café" → "cafe", not "cafe-"
    .replace(/[^a-z0-9]+/g, "-")             // CJK and symbols → single hyphen
    .replace(/-+/g, "-")
    .slice(0, 24)
    .replace(/^-+|-+$/g, "");                // trim after the cut so no "--" before the tail
  let tail = "";
  for (let i = 0; i < TAIL_LENGTH; i++) tail += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `partner-${base ? `${base}-` : ""}${tail}`;
}

export const REFERRAL_SLUG_PATTERN = /^partner-(?:[a-z0-9-]{1,24}-)?[23456789abcdefghjkmnpqrstuvwxyz]{6}$/;

/** Public link a partner shares; the visit's utm_source lands on every lead from it. */
export function referralLink(slug: string): string {
  return `https://detectivepulse.com/zh?utm_source=${encodeURIComponent(slug)}&utm_medium=referral`;
}
