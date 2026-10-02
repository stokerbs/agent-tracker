import { z } from "zod";
import { ATTRIBUTION_LIMITS } from "@/lib/marketing/attribution";
import { channelFor } from "@/lib/marketing/crm";

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

const LANDING_PATH = /^\/[^\s]*$/;
const HTTP_URL = /^https?:\/\/[^\s]+$/i;

/** Map the validated attribution object onto marketing_leads columns (empty → null).
 *  landing_page must be a site-relative path and referrer an http(s) URL; anything
 *  else (e.g. `javascript:`) is dropped to null rather than failing the lead. */
export function attributionColumns(a: AttributionInput) {
  const v = (s?: string) => (s && s.length > 0 ? s : null);
  const path = (s?: string) => (s && LANDING_PATH.test(s) ? s : null);
  const url = (s?: string) => (s && HTTP_URL.test(s) ? s : null);
  const cols = {
    landing_page: path(a?.landing_page),
    referrer: url(a?.referrer),
    utm_source: v(a?.utm_source),
    utm_medium: v(a?.utm_medium),
    utm_campaign: v(a?.utm_campaign),
    utm_term: v(a?.utm_term),
    utm_content: v(a?.utm_content),
    gclid: v(a?.gclid),
    fbclid: v(a?.fbclid),
  };
  // Acquisition channel (migration 0128) derived once at insert.
  return { ...cols, channel: channelFor(cols) };
}
