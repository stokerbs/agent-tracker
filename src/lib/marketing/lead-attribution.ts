import { z } from "zod";
import { ATTRIBUTION_LIMITS } from "@/lib/marketing/attribution";

/**
 * Server-side contract for the first-touch attribution object that the
 * marketing lead form and the AI assistant post alongside a lead
 * (src/lib/marketing/attribution.ts builds it client-side). Bounded here —
 * the API is the authority — and mapped onto marketing_leads columns.
 * Informational only; never used for authorisation or routing.
 */
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const attributionSchema = z
  .object({
    landing_page: optionalText(ATTRIBUTION_LIMITS.landing_page),
    referrer: optionalText(ATTRIBUTION_LIMITS.referrer),
    utm_source: optionalText(ATTRIBUTION_LIMITS.utm_source),
    utm_medium: optionalText(ATTRIBUTION_LIMITS.utm_medium),
    utm_campaign: optionalText(ATTRIBUTION_LIMITS.utm_campaign),
    utm_term: optionalText(ATTRIBUTION_LIMITS.utm_term),
    utm_content: optionalText(ATTRIBUTION_LIMITS.utm_content),
    gclid: optionalText(ATTRIBUTION_LIMITS.gclid),
    fbclid: optionalText(ATTRIBUTION_LIMITS.fbclid),
  })
  .partial()
  .optional();

export type AttributionInput = z.infer<typeof attributionSchema>;

/** Map the validated attribution object onto marketing_leads columns (empty → null). */
export function attributionColumns(a: AttributionInput) {
  const v = (s?: string) => (s && s.length > 0 ? s : null);
  return {
    landing_page: v(a?.landing_page),
    referrer: v(a?.referrer),
    utm_source: v(a?.utm_source),
    utm_medium: v(a?.utm_medium),
    utm_campaign: v(a?.utm_campaign),
    utm_term: v(a?.utm_term),
    utm_content: v(a?.utm_content),
    gclid: v(a?.gclid),
    fbclid: v(a?.fbclid),
  };
}
