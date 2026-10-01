"use client";

import { sendGTMEvent } from "@next/third-parties/google";

/**
 * Typed marketing analytics events (docs/china-market/12). Everything goes
 * through GTM's dataLayer (already deferred-loaded on the marketing host);
 * GA4 / conversion tags are configured inside the GTM container. Events queue
 * on window.dataLayer before GTM initialises, so early clicks are not lost.
 *
 * Never send personal data (names, WeChat IDs, emails, free text) — only enum
 * keys and the lead_ref, which is a random public identifier.
 */
export type MarketingEvent =
  | { event: "zh_page_view"; page: string; service: string; kind: string }
  | { event: "wechat_cta_click"; placement: WeChatPlacement; page: string; service: string }
  | { event: "wechat_id_copied"; page: string }
  | { event: "contact_click"; channel: "line" | "whatsapp" | "email" | "phone"; page: string }
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
