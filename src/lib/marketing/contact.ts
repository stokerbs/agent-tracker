/**
 * Canonical brand + contact facts (NAP) for the public marketing site.
 *
 * ONE source of truth so every page, CTA, schema block and notification shows
 * the same name, number, LINE link and email (docs/seo-growth-audit §3 H4,
 * §9.3). Content files reference the same URLs; keep them in sync with
 * `scripts`/grep when any value changes. The Chinese section re-exports the
 * relevant values through `src/lib/marketing/zh/company.ts`.
 *
 * Owner-confirmed values only — nothing here may be invented. The LINE link is
 * the Official Account add-friend URL used by every component; the legacy
 * `lin.ee/49Hessi` and `page.line.me/detectivepluse` links in old content were
 * normalised to it (confirm with the owner that it is the current OA).
 */
export const CONTACT = {
  brand: "Detective Pulse",
  siteUrl: "https://detectivepulse.com",
  foundingYear: 2016,
  lineId: "@detectivepluse",
  lineUrl: "https://lin.ee/SSqk98x",
  phoneE164: "+66968461406",
  phoneDisplay: "096 846 1406",
  phoneTel: "tel:+66968461406",
  whatsappUrl: "https://api.whatsapp.com/send?phone=+66968461406",
  email: "detectivepluse@gmail.com",
  mailto: "mailto:detectivepluse@gmail.com",
  facebookUrl: "https://www.facebook.com/Detectivepluse.th",
  youtubeUrl: "https://www.youtube.com/watch?v=-sYx6i8OBF0",
  /** City used for the schema.org address / local entity (no street address is published). */
  city: "Bangkok",
  countryCode: "TH",
} as const;

/** schema.org `sameAs` — profiles that unambiguously belong to the firm. */
export const SAME_AS: readonly string[] = [CONTACT.facebookUrl, CONTACT.youtubeUrl, CONTACT.lineUrl];
