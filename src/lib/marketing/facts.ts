import { CONTACT } from "@/lib/marketing/contact";

/**
 * Verifiable business facts shown on the marketing site — ONE registry
 * (docs/seo-growth-audit §13 roadmap item 9, Appendix D; docs/seo-growth-audit/facts-to-confirm.md).
 *
 * Rule: the site shows a claim only when the owner has confirmed it here.
 * `confirmed` holds figures that were already displayed on the live site
 * before the audit (carried over unchanged; the owner still signs them off).
 * `pending` fields are null / empty until confirmed — every component that
 * reads them must omit the claim when the value is missing, never invent one.
 * The old copy that could not be verified ("many awards", "freelance, no
 * office") has been removed from the templates and only comes back through
 * these fields.
 */
export type FactLang = "th" | "en" | "zh";
export type Localized = Record<FactLang, string | null>;

export const FACTS = {
  confirmed: {
    foundingYear: CONTACT.foundingYear,
    /** Closed cases, as displayed on the homepage stat band before the audit. Owner: confirm or remove. */
    closedCases: 1953,
    /** Provinces covered, as displayed before the audit. */
    provinces: 77,
    /** Fastwork profile rating/count as displayed before the audit; `url` links the badge once supplied. */
    reviews: { rating: "4.8", count: 63, source: "Fastwork", url: null as string | null },
    /** Deposit rule from the long-standing process copy. */
    depositPercent: 50,
  },
  pending: {
    /** Registered legal entity name (Thai) — appears in About, footer and schema `legalName`. */
    legalName: null as string | null,
    /** DBD registration number — appears next to legalName. */
    registrationNo: null as string | null,
    /** How/where clients can meet the team — replaces the "freelance, no office" FAQ answer. */
    officeNote: { th: null, en: null, zh: null } as Localized,
    /** Response-time commitment, e.g. "ตอบกลับภายใน 1 ชั่วโมง (08:00–22:00)" — shown in trust bar + contact. */
    responseTime: { th: null, en: null, zh: null } as Localized,
    /** Accepted payment methods for the pricing/how-it-works pages. */
    paymentMethods: [] as string[],
    /** Named awards only (name, issuer, year). Empty = no award claim anywhere. */
    awards: [] as { name: string; issuer: string; year: number }[],
    /** Public first name + role of the lead investigator for About / author schema. */
    leadInvestigator: null as { name: string; role: string } | null,
  },
} as const;

/** True when a localized pending fact has a value for this language. */
export function fact(l: Localized | undefined, lang: FactLang): string | null {
  return l?.[lang] ?? null;
}

/** FAQ answer for "where is your office?" — owner-supplied note, else an honest neutral statement. */
export function officeAnswer(lang: FactLang): string {
  const note = fact(FACTS.pending.officeNote, lang);
  if (note) return note;
  return {
    th: "ทีมนักสืบของเราทำงานภาคสนามเป็นหลัก การพูดคุยรายละเอียดงานนัดได้ตามความสะดวกของลูกค้า ทั้งออนไลน์ ทางโทรศัพท์ หรือนัดพบตัวในกรุงเทพฯ",
    en: "Our investigators work in the field; case briefings are arranged to suit you — online, by phone, or in person in Bangkok.",
    zh: "我们的调查团队以外勤为主，案件沟通可按您的方便安排：线上、电话，或在曼谷面谈。",
  }[lang];
}
