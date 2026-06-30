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
};

export const TH_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_TH).map(([en, th]) => [th, en]),
);

/** Thai path (decoded, slash-wrapped) for a Thai slug. */
export const thPath = (thSlug: string) => `/${thSlug}/`;
/** English path for an English slug. */
export const enPath = (enSlug: string) => `/en/${enSlug}`;
