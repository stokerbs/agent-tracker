"use client";

import { sendGTMEvent } from "@next/third-parties/google";
import type { ContactChannel } from "@/lib/marketing/contact-channel";

/**
 * Typed marketing analytics events (docs/china-market/12 + docs/seo-growth-audit §12.7).
 * Everything goes through GTM's dataLayer (already deferred-loaded on the
 * marketing host); GA4 / conversion tags are configured inside the GTM
 * container. Events queue on window.dataLayer before GTM initialises, so early
 * clicks are not lost.
 *
 * Never send personal data (names, WeChat IDs, emails, free text) — only enum
 * keys and the lead_ref, which is a random public identifier.
 *
 * GTM configuration (agency): mark `contact_click` (channel ∈ line/whatsapp/
 * phone/wechat), `lead_submitted` and `assistant_lead_created` as GA4
 * conversions and import them into Google Ads.
 */
export type ContactPlacement =
  | "hero" | "sticky" | "fab" | "exit" | "inline" | "contact_section" | "assistant" | "lp" | "footer" | "nav" | "form_success";

export type MarketingEvent =
  | { event: "zh_page_view"; page: string; service: string; kind: string }
  | { event: "wechat_cta_click"; placement: WeChatPlacement; page: string; service: string }
  | { event: "wechat_id_copied"; page: string }
  | { event: "contact_click"; channel: ContactChannel; page: string; placement?: ContactPlacement; lang?: string }
  | { event: "lead_submitted"; case_type?: string; locale: string; lead_ref?: string; page?: string }
  | { event: "assistant_opened"; page: string; lang: string }
  | { event: "assistant_lead_created"; page: string; lang: string }
  | { event: "zh_intake_start"; page: string; service: string }
  | { event: "zh_intake_submitted"; service: string; country: string; budget_range: string; urgency: string; lead_ref: string; page: string }
  | { event: "zh_intake_error"; reason: string; page: string }
  | { event: "partner_intake_start"; page: string }
  | { event: "partner_intake_submitted"; partner_type: string; country: string; services_count: number; page: string }
  | { event: "partner_intake_error"; reason: string; page: string };

export type WeChatPlacement = "header" | "hero" | "service" | "case_study" | "contact" | "sticky" | "footer" | "intake_success";

export function track(e: MarketingEvent): void {
  try {
    sendGTMEvent(e);
  } catch {
    // Analytics must never break the page.
  }
}

/** Current page path for event payloads (SSR-safe). */
export function currentPage(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

/** Marketing language from a pathname (/en/*, /zh/*, else th) — for event payloads. */
export function langForPath(pathname: string): "th" | "en" | "zh" {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/zh" || pathname.startsWith("/zh/")) return "zh";
  return "th";
}
