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
    // ── Confirmed by the owner on 2026-10-02 (facts-to-confirm.md B7, B8, C11) ──
    /** Investigators and support staff. */
    teamSize: 17,
    /** Public starting-price statement — a magnitude, not a quote. */
    priceFrom: { th: "เริ่มต้นหลักพันบาท", en: "from a few thousand baht", zh: "数千泰铢起" } as Record<FactLang, string>,
    /** Typical observation block for behaviour / infidelity cases (days). */
    surveillanceDays: "3–7",
    /** Typical lead time to staff a field assignment in Bangkok (working days). */
    bangkokStartDays: "1–2",
  },
  pending: {
    /** Registered legal entity name — B1 answered 2026-10-02: the business trades as a sole proprietor (บุคคลธรรมดา), so there is no entity name or DBD number to show. Stays null by design. */
    legalName: null as string | null,
    registrationNo: null as string | null,
    legalForm: "sole_proprietor" as "sole_proprietor" | "company" | null,
    /** How/where clients can meet the team (B3, confirmed 2026-10-02). */
    officeNote: {
      th: "ทีมนักสืบของเราทำงานภาคสนามเป็นหลัก ลูกค้าสามารถนัดพูดคุยและเลือกสถานที่นัดพบได้ตามสะดวก ทั้งออนไลน์ ทางโทรศัพท์ หรือพบตัวในกรุงเทพฯ",
      en: "Our investigators work in the field. You can arrange a briefing and choose where to meet, at your convenience — online, by phone, or in person in Bangkok.",
      zh: "我们的调查团队以外勤为主。您可以预约沟通并自行选择会面方式和地点：线上、电话，或在曼谷面谈。",
    } as Localized,
    /** Response-time commitment (B4, confirmed 2026-10-02) — shown on service pages and contact. */
    responseTime: {
      th: "ตอบกลับภายใน 1 ชั่วโมง เวลา 08:00–22:00",
      en: "We reply within 1 hour, 08:00–22:00 Bangkok time",
      zh: "曼谷时间 08:00–22:00 内 1 小时内回复",
    } as Localized,
    /** Accepted payment methods (B5, confirmed 2026-10-02): bank transfer (long-standing) + PayPal for clients abroad. Receipts/tax invoices: see issuesTaxInvoice. */
    paymentMethods: ["bank_transfer", "paypal"] as ("bank_transfer" | "paypal")[],
    /** B5 (2026-10-02): the firm does NOT issue receipts or tax invoices; proof of payment is the transfer slip / PayPal confirmation. null = unknown. */
    issuesTaxInvoice: false as boolean | null,
    /** Languages the team actually serves in (B7, confirmed 2026-10-02). */
    serviceLanguages: ["th", "en", "zh"] as FactLang[],
    /** Named awards only (name, issuer, year). Empty = no award claim anywhere. */
    awards: [] as { name: string; issuer: string; year: number }[],
    /** Public first name + role of the lead investigator for About / author schema (B7, confirmed 2026-10-02). */
    leadInvestigator: { name: "Tommy", role: { th: "ผู้ก่อตั้ง", en: "Founder", zh: "创始人" } } as { name: string; role: Record<FactLang, string> } | null,
    /** Redacted sample report (C10, 2026-10-02: a template page in the app's report layout, not a real case) — shown on the how-it-works pages. */
    sampleReportUrl: { th: "/sample-report", en: "/en/sample-report", zh: "/en/sample-report" } as Localized,
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

/** Response-time line for the current language, or null when not confirmed. */
export function responseTimeNote(lang: FactLang): string | null {
  return fact(FACTS.pending.responseTime, lang);
}

const PAYMENT_LABELS: Record<"bank_transfer" | "paypal", Record<FactLang, string>> = {
  bank_transfer: { th: "โอนผ่านธนาคาร", en: "bank transfer", zh: "银行转账" },
  paypal: { th: "PayPal", en: "PayPal", zh: "PayPal" },
};

/** Accepted payment methods as a localized, comma-joined phrase ("" when none confirmed). */
export function paymentMethodsText(lang: FactLang): string {
  return FACTS.pending.paymentMethods.map((m) => PAYMENT_LABELS[m][lang]).join(lang === "th" ? " และ " : lang === "zh" ? "、" : " and ");
}

/** "Tommy, Founder" style credit for About pages / schema, or null. */
export function leadInvestigatorText(lang: FactLang): string | null {
  const li = FACTS.pending.leadInvestigator;
  return li ? `${li.name} (${li.role[lang]})` : null;
}

/** Receipt / tax-invoice statement for pricing pages, or null when unconfirmed. */
export function receiptNote(lang: FactLang): string | null {
  const v = FACTS.pending.issuesTaxInvoice;
  if (v === null) return null;
  if (v) return { th: "ออกใบเสร็จและใบกำกับภาษีได้", en: "We issue receipts and tax invoices.", zh: "可开具收据与税务发票。" }[lang];
  return {
    th: "ขณะนี้ยังไม่สามารถออกใบเสร็จหรือใบกำกับภาษีได้ หลักฐานการชำระคือสลิปโอนธนาคารหรือใบยืนยัน PayPal และใบเสนอราคาที่ตกลงกัน",
    en: "We do not currently issue receipts or tax invoices; your proof of payment is the bank-transfer slip or PayPal confirmation together with the agreed written quote.",
    zh: "目前暂不开具收据或税务发票；付款凭证为银行转账单或 PayPal 确认，以及双方确认的书面报价。",
  }[lang];
}
