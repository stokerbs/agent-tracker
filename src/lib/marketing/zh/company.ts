/**
 * Company facts shown on the Chinese site — ONE place, so a single confirmation
 * updates every page. Every value here was taken from the existing site code
 * (marketing-home*.tsx, json-ld.tsx, contact-fab.tsx) and is listed in
 * docs/china-market/16-facts-requiring-confirmation.md. Do not add figures
 * that cannot be verified by Detective Pulse.
 */
export const ZH_COMPANY = {
  name: "Detective Pulse",
  /** Year the site has displayed as "Est." / "Since". */
  since: 2016,
  /** WeChat ID shown next to the QR. Overridable per deployment. */
  wechatId: process.env.NEXT_PUBLIC_WECHAT_ID || "DetectivePulse",
  /** WeChat QR image (public path). The existing asset is a WeChat QR. */
  wechatQr: process.env.NEXT_PUBLIC_WECHAT_QR || "/marketing/btn-wechat.jpg",
  email: "detectivepluse@gmail.com",
  /** Firm's main number — WhatsApp links were unified on it in PR #268. */
  whatsapp: "+66968461406",
  whatsappHref: "https://api.whatsapp.com/send?phone=+66968461406",
  lineHref: "https://lin.ee/SSqk98x",
  /** Review figures displayed on the existing homepages (Fastwork). */
  reviews: { rating: "4.8", count: 63, source: "Fastwork" },
  /** Closed-case figure displayed on the existing homepages. */
  closedCases: 1953,
  provinces: 77,
  /** Deposit rule from the existing FAQ / process copy. */
  depositPercent: 50,
} as const;
