import { z } from "zod";

/**
 * Chinese intake form contract — shared by the client form (for field lists /
 * labels) and the API route (the authority; client validation is UX only).
 * Option VALUES are stable ASCII keys stored in the DB; labels live in the form.
 */
export const ZH_SERVICES = [
  "relationship",
  "find_person",
  "background",
  "due_diligence",
  "on_site",
  "asset",
  "other",
] as const;

/** Client's own country/region — enum so nothing free-text reaches analytics. */
export const ZH_COUNTRIES = ["china", "hong_kong", "macau", "taiwan", "singapore", "malaysia", "thailand", "other"] as const;
export const ZH_LOCATIONS = ["bangkok", "pattaya", "phuket", "chiang-mai", "samui", "hua-hin", "chonburi", "other", "unknown"] as const;
export const ZH_DURATIONS = ["1-3_days", "4-7_days", "1-2_weeks", "2-4_weeks", "over_1_month", "unknown"] as const;
export const ZH_URGENCY = ["normal", "urgent", "critical"] as const;
export const ZH_BUDGETS = ["under_20k", "20k-50k", "50k-100k", "100k-300k", "over_300k", "undecided"] as const; // THB

export const ZH_INTAKE_MAX_FILES = 5;
// Vercel serverless functions reject request bodies over 4.5 MB at the edge,
// so the whole multipart upload (all files + fields) must stay under that.
export const ZH_INTAKE_MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB each
export const ZH_INTAKE_MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 4 MB per submission
/** Hard cap for the raw request body (files + ~64 KB of fields/boundaries). */
export const ZH_INTAKE_MAX_BODY_BYTES = ZH_INTAKE_MAX_TOTAL_BYTES + 64 * 1024;
export const ZH_INTAKE_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const zhIntakeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  wechatId: z.string().trim().min(2).max(60),
  email: z.string().trim().max(120).email().optional().or(z.literal("")),
  country: z.enum(ZH_COUNTRIES),
  targetLocation: z.enum(ZH_LOCATIONS),
  service: z.enum(ZH_SERVICES),
  knownInfo: z.string().trim().min(10).max(3000),
  objective: z.string().trim().min(5).max(1500),
  // ISO calendar date (yyyy-mm-dd) or empty — the form uses <input type=date>.
  // Must be a real date: the column is `date`, so 2026-02-31 would 500 later.
  preferredStart: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => {
      const t = new Date(`${d}T00:00:00Z`);
      return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
    }, "invalid calendar date")
    .optional()
    .or(z.literal("")),
  estimatedDuration: z.enum(ZH_DURATIONS),
  urgency: z.enum(ZH_URGENCY),
  budgetRange: z.enum(ZH_BUDGETS),
  // PDPA / PIPL: explicit consent is required — must be exactly true.
  consent: z.literal(true),
  // Attribution (client-supplied, bounded, informational only).
  landingPage: optionalText(300),
  referrer: optionalText(300),
  utmSource: optionalText(100),
  utmMedium: optionalText(100),
  utmCampaign: optionalText(150),
  utmTerm: optionalText(150),
  // Honeypot — bots fill it; humans never see it.
  website: z.string().max(200).optional(),
});

export type ZhIntakeInput = z.infer<typeof zhIntakeSchema>;

/** Coerce FormData (multipart) into the object the schema expects. */
export function intakeFromFormData(fd: FormData): Record<string, unknown> {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return {
    name: s("name"),
    wechatId: s("wechatId"),
    email: s("email"),
    country: s("country"),
    targetLocation: s("targetLocation"),
    service: s("service"),
    knownInfo: s("knownInfo"),
    objective: s("objective"),
    preferredStart: s("preferredStart"),
    estimatedDuration: s("estimatedDuration"),
    urgency: s("urgency"),
    budgetRange: s("budgetRange"),
    consent: s("consent") === "true" ? true : s("consent"),
    landingPage: s("landingPage"),
    referrer: s("referrer"),
    utmSource: s("utmSource"),
    utmMedium: s("utmMedium"),
    utmCampaign: s("utmCampaign"),
    utmTerm: s("utmTerm"),
    website: s("website"),
  };
}
