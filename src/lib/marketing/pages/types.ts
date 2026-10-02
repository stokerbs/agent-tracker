import type { QA } from "@/lib/marketing/faq";

/**
 * Thai / English service-page registry — the TH/EN counterpart of the Chinese
 * `ZhPage` (src/lib/marketing/zh/types.ts). Everything a money page needs to
 * render AND to emit its SEO metadata lives in one typed entry, so copy,
 * structure, schema and CTAs are reviewed in one place (docs/seo-growth-audit
 * Parts 6–7, roadmap days 8–30).
 *
 * Invariants (enforced by pages/index.test.ts):
 * - no claim of access to restricted data (bank, credit bureau, telecom,
 *   immigration, civil registry) — every service page carries `notOffered`;
 * - no invented numbers: figures come from src/lib/marketing/facts.ts;
 * - slugs are decoded, single-segment, and (for existing pages) identical to
 *   the WordPress-era slug so URLs do not change.
 */
export type PageLang = "th" | "en";

export interface PageSection {
  heading: string;
  /** Paragraphs. */
  body: string[];
  bullets?: string[];
}

export interface ProcessStep {
  step: string;
  desc: string;
}

export interface MarketingServicePage {
  lang: PageLang;
  /** Decoded slug: TH "นักสืบชู้สาว" (served at /นักสืบชู้สาว), EN "background-check" (served at /en/background-check). */
  slug: string;
  kind: "service" | "info" | "location";
  /** Analytics / lead-form key: infidelity | partner | background | find_person | asset | cyber | hire | pricing | about | location | contact. */
  service: string;
  /** <title> without the brand suffix (the layout template appends it). ≤ 60 chars where possible. */
  title: string;
  /** Meta description, ≤ 155 chars. */
  description: string;
  h1: string;
  /** Mono eyebrow above the H1, e.g. "Case File · สืบชู้สาว". */
  eyebrow: string;
  /** Lead paragraph under the H1 (2–3 sentences). */
  intro: string;
  sections: PageSection[];
  /** "สิ่งที่คุณจะได้รับ" / "What you receive". */
  deliverables?: string[];
  /** "สิ่งที่เราไม่ทำ" / "What we never do" — required on service pages. */
  notOffered?: string[];
  /** Optional per-page process (defaults to the firm's 5-step process when omitted). */
  process?: ProcessStep[];
  /** 3–6 Q&A; also emitted as FAQPage JSON-LD. */
  faq: QA[];
  /** Slugs of related pages in the same language (service pages or content pages). */
  related: string[];
  /** Lead-form case type preselected on this page (must match LeadForm caseOptions for the language). */
  caseType?: string;
  /** Short pricing note shown in the CTA card (model only; no invented numbers). */
  priceNote?: string;
  /** Counterpart slugs for hreflang + language switcher. */
  counterpart?: { th?: string; en?: string; zh?: string };
}
