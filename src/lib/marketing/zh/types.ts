import type { QA } from "@/lib/marketing/faq";

/** Customer segment from the China-market brief (docs/china-market/02). */
export type ZhSegment = "A" | "B" | "C" | "D" | "E";

export interface ZhSection {
  heading: string;
  /** Paragraphs. */
  body: string[];
  bullets?: string[];
}

/**
 * One Chinese marketing page (`/zh/<slug>`). Everything a page needs to render
 * and to emit its SEO metadata lives here, so copy, structure and metadata are
 * reviewed in one place (docs/china-market/06 + 07 mirror this file).
 *
 * Compliance invariants (enforced by registry.test.ts): no claim of access to
 * restricted/private databases, phone records, or location tracking of phones.
 */
export interface ZhPage {
  slug: string;
  kind: "service" | "info" | "location";
  segment?: ZhSegment;
  /** <title> without the brand suffix. */
  title: string;
  description: string;
  h1: string;
  /** Mono eyebrow above the H1, e.g. "Case File · 感情调查". */
  eyebrow: string;
  intro: string;
  sections: ZhSection[];
  /** "您将收到" — concrete deliverables. */
  deliverables?: string[];
  /** "我们不做什么" — explicit lawful-scope boundary. */
  notOffered?: string[];
  faq: QA[];
  /** Slugs of related /zh pages (internal links). */
  related: string[];
  /** Which CTA leads: WeChat (consumer) or the structured intake (B2B). */
  primaryCta: "wechat" | "intake";
  /** English counterpart slug under /en/, if one exists (hreflang + lang switch). */
  en?: string;
  /** Thai counterpart slug (decoded) at /<slug>/, if one exists. */
  th?: string;
  /** Keep out of the index (e.g. case-studies while empty). */
  noindex?: boolean;
  /** Analytics service key sent with page_view / CTA events. */
  service: string;
}
