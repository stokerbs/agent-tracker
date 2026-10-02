import type { KeywordTopic } from "@/lib/marketing/article-gen";

/**
 * Content calendar, months 1–3 (audit Part 13, Days 31–90: "12 articles via
 * the re-pointed AI pipeline + human paragraph"). Four articles a month, each
 * supporting one of the new TH/EN service pages and carrying the target
 * keyword cluster. Every article here REQUIRES a human paragraph before it
 * publishes: the owner adds first-hand experience on the review page and the
 * approve action refuses to publish without it (E-E-A-T, not AI filler).
 *
 * `th` doubles as the dedupe key stored in marketing_articles.topic, so it
 * must be unique here and distinct from KEYWORD_TOPICS and ZH_PLAN_TOPICS.
 */
export interface CalendarTopic extends KeywordTopic {
  month: 1 | 2 | 3;
  /** Registry slugs the article must link to (decoded). */
  targetPage: { th: string; en: string };
  humanParagraph: true;
}

export const CONTENT_CALENDAR: CalendarTopic[] = [
  // ── Month 1: the funnel pages (how it works, pricing, partner verification) ──
  { month: 1, service: "how_it_works", humanParagraph: true, targetPage: { th: "ขั้นตอนการทำงาน", en: "how-it-works" },
    th: "จ้างนักสืบครั้งแรกต้องเตรียมอะไร", en: "hiring a private investigator for the first time", zh: "第一次委托侦探需要准备什么",
    angle: "Walk a first-time client through what to prepare, what happens after the first message, what the quote contains and what the report looks like; link to the how-it-works page; no prices." },
  { month: 1, service: "pricing", humanParagraph: true, targetPage: { th: "ราคานักสืบ", en: "pricing" },
    th: "ทำไมราคานักสืบถึงต่างกันมาก", en: "why private investigator prices vary so much", zh: "为什么侦探收费差别这么大",
    angle: "Explain the cost drivers (days, team, night/weekend, province, complexity) and why a very low price is a warning sign; no figures; link to the pricing page." },
  { month: 1, service: "partner", humanParagraph: true, targetPage: { th: "จ้างนักสืบตามแฟน", en: "investigate-partner-before-marriage" },
    th: "เช็คแฟนต่างชาติหรือแฟนที่รู้จักออนไลน์ก่อนจริงจัง", en: "verifying a partner you met online before getting serious", zh: "认真交往前如何核实网恋对象",
    angle: "What can lawfully be verified about an online partner (identity consistency, where they live and work, public footprint), what cannot (government records), and when to walk away." },
  { month: 1, service: "surveillance", humanParagraph: true, targetPage: { th: "ติดตามพฤติกรรม", en: "surveillance-thailand" },
    th: "ติดตามพฤติกรรมถูกกฎหมายแค่ไหน", en: "is surveillance legal in Thailand", zh: "在泰国跟踪调查合法吗",
    angle: "Where lawful observation ends: public places vs private premises, trackers, recording, approaching the subject; why unlawful evidence is useless; link to the surveillance page." },
  // ── Month 2: B2B and verification ──
  { month: 2, service: "due_diligence", humanParagraph: true, targetPage: { th: "ตรวจสอบธุรกิจและคู่ค้า", en: "due-diligence-thailand" },
    th: "ตรวจสอบบริษัทคู่ค้าก่อนเซ็นสัญญา", en: "how to verify a Thai company before signing a contract", zh: "签约前如何核实泰国公司",
    angle: "Step by step from the public registry to a site visit: what DBD shows, red flags (virtual office, new company with long claims), what a site visit adds; link to the due-diligence page." },
  { month: 2, service: "employment_screening", humanParagraph: true, targetPage: { th: "ตรวจสอบประวัติพนักงาน", en: "background-check" },
    th: "ตรวจสอบประวัติพนักงานก่อนรับเข้าทำงานอย่างไรให้ถูก PDPA", en: "pre-employment background checks in Thailand under PDPA", zh: "泰国雇前背景调查与个人数据保护法",
    angle: "Consent, relevance to the role, what HR can and cannot check, criminal-record certificates requested by the candidate; practical checklist for SMEs." },
  { month: 2, service: "law_firms", humanParagraph: true, targetPage: { th: "สำหรับทนายความ", en: "for-law-firms" },
    th: "ทนายความใช้นักสืบช่วยคดีอย่างไร", en: "how lawyers use private investigators in Thailand", zh: "泰国律师如何借助侦探支持案件",
    angle: "Asset tracing for enforcement, locating defendants for service, surveillance in family and labour cases, witness background; how a court-ready report is structured; link to the law-firm page." },
  { month: 2, service: "asset", humanParagraph: true, targetPage: { th: "สืบทรัพย์สิน", en: "asset-investigation" },
    th: "ชนะคดีแล้วบังคับคดีไม่ได้ เพราะไม่รู้ว่าลูกหนี้มีอะไร", en: "winning a judgment but failing to enforce it in Thailand", zh: "胜诉却无法执行：泰国资产调查的作用",
    angle: "Why asset tracing before suing changes the decision; what leads are lawful (property, vehicles, companies, income) and what needs the court; link to the asset page." },
  // ── Month 3: scams, remote clients, Bangkok ──
  { month: 3, service: "romance_scam", humanParagraph: true, targetPage: { th: "นักสืบไอที", en: "romance-scam-investigation" },
    th: "สัญญาณโรแมนซ์สแกมและสิ่งที่ต้องทำก่อนโอนเงินอีกครั้ง", en: "romance scam warning signs and what to do before sending more money", zh: "网恋诈骗的信号及再转账前该做什么",
    angle: "The pattern (money requests, no video calls, shifting story), what can be verified lawfully, the 1441 hotline and bank steps, honest view of recovery chances." },
  { month: 3, service: "find_person", humanParagraph: true, targetPage: { th: "สืบตามหาคน", en: "find-missing-person" },
    th: "แฟนคนไทยหายเงียบ ติดต่อไม่ได้ ควรทำอย่างไร", en: "my Thai partner stopped replying — how to find out they are safe", zh: "泰国伴侣失联怎么办",
    angle: "For the remote client: welfare check vs locating, what helps (last province, employer, friends), police and embassy first in emergencies, lawful contact afterwards." },
  { month: 3, service: "location", humanParagraph: true, targetPage: { th: "นักสืบกรุงเทพ", en: "private-investigator-bangkok" },
    th: "จ้างนักสืบในกรุงเทพฯ ต่างจากต่างจังหวัดอย่างไร", en: "hiring a private investigator in Bangkok vs the provinces", zh: "在曼谷与外府委托侦探有何不同",
    angle: "Why Bangkok starts faster (resident team, districts, traffic planning), how condo and gated communities are handled lawfully, travel costs upcountry; link to the Bangkok page." },
  { month: 3, service: "hire", humanParagraph: true, targetPage: { th: "จ้างนักสืบ", en: "hire-a-private-detective" },
    th: "นักสืบปลอมหลอกโอนเงิน รู้ทันได้อย่างไร", en: "fake private detectives and how to avoid being scammed by one", zh: "如何识别假侦探避免被骗",
    angle: "The six warning signs (promises of bank/phone data, full prepayment, no verifiable presence, guaranteed results, impossible prices, unlawful methods) and how to verify an agency; link to the hiring page." },
];

export const CONTENT_CALENDAR_KEYS = new Set(CONTENT_CALENDAR.map((t) => t.th));

export function isCalendarTopic(topicKey: string): boolean {
  return CONTENT_CALENDAR_KEYS.has(topicKey);
}
