/**
 * TH ↔ EN slug map for the marketing site. English pages live at /en/<en-slug>;
 * their Thai counterparts at /<thai-slug>/. Used for the language switcher and
 * hreflang alternates. Only pages that have an English translation appear here.
 */
export const EN_TO_TH: Record<string, string> = {
  "cheating-spouse-investigator": "นักสืบชู้สาว",
  "asset-investigation": "สืบทรัพย์สิน",
  "background-check": "เช็คประวัติบุคคล",
  "find-missing-person": "สืบตามหาคน",
  "cyber-investigation": "นักสืบไอที",
  "hire-a-private-detective": "จ้างนักสืบ",
  "contact": "ติดต่อนักสืบ",
  // Batch 1 — translated Thai articles
  "private-investigator": "private-investigator",
  "hire-a-detective-online": "จ้างนักสืบออนไลน์",
  "trace-assets-before-lawsuit": "วิธีสืบทรัพย์ก่อนฟ้อง-เ",
  "catch-a-cheating-partner": "นักสืบคดีชู้สาว-รับสืบค",
  "personal-background-check-service": "บริการตรวจสอบประวัติบุ",
  // Batch 2
  "asset-background-check": "บริการสืบประวัติบุคคลด",
  "how-to-find-a-good-detective": "การหานักสืบเชี่ยวชาญ-คำ",
  "trusted-detective-agency": "บริษัทนักสืบมืออาชีพที",
  "leading-detective-services": "บริการนักสืบชั้นนำเพื่",
  "evidence-for-adultery-lawsuit": "สิ่งที่ควรรู้ก่อนการจ้",
  // Batch 3
  "private-detective-pricing": "วิธีการคิดราคาจ้างนักส",
  "social-media-investigation": "บริการสืบค้นข้อมูลไอที",
  "phone-usage-investigation": "บริการตรวจสอบการใช้โทร",
  "trace-people-and-debtors": "จ้างนักสืบตามหาคน",
  "investigate-partner-before-marriage": "จ้างนักสืบตามแฟน",
  // Batch 4 — remaining articles (all 27 Thai pages now have an EN version)
  "affordable-private-detective": "จ้างนักสืบ-ราคาถูก",
  "what-is-a-detective-agency": "บริษัทนักสืบ",
  "online-fraud-investigation": "การฉ้อโกงออนไลน์และบทบ",
  "qualities-of-a-good-detective": "นักสืบ",
  "detective-services-overview": "บริการนักสืบ",
};

export const TH_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_TH).map(([en, th]) => [th, en]),
);

/** Thai path (decoded, slash-wrapped) for a Thai slug. */
export const thPath = (thSlug: string) => `/${thSlug}/`;
/** English path for an English slug. */
export const enPath = (enSlug: string) => `/en/${enSlug}`;
