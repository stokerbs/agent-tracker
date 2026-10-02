/**
 * Lightweight navigation + slug-link data for CLIENT components (header, lang
 * switcher, sticky bar). Deliberately separate from registry.ts so the full
 * Chinese page copy never ships in the client bundle. registry.test.ts asserts
 * this file stays consistent with the registry.
 */
export const ZH_NAV = {
  services: [
    { slug: "relationship-investigation", label: "感情调查" },
    { slug: "find-person-thailand", label: "寻人" },
    { slug: "background-check", label: "背景核实" },
    { slug: "business-due-diligence", label: "商业尽调" },
    { slug: "on-site-verification", label: "实地核实" },
    { slug: "asset-investigation", label: "资产调查" },
  ],
  primary: [
    { slug: "how-it-works", label: "流程" },
    { slug: "pricing", label: "收费" },
    { slug: "case-studies", label: "案例" },
    { slug: "partners", label: "合作伙伴" },
    { slug: "about", label: "关于" },
    { slug: "contact", label: "联系" },
  ],
  locations: [
    { slug: "bangkok", label: "曼谷" },
    { slug: "pattaya", label: "芭提雅" },
    { slug: "phuket", label: "普吉" },
    { slug: "chiang-mai", label: "清迈" },
    { slug: "chonburi", label: "春武里" },
    { slug: "samui", label: "苏梅岛" },
  ],
} as const;

/** zh slug ↔ EN / TH counterparts (hreflang + language switcher). */
export const ZH_SLUG_LINKS: { slug: string; en?: string; th?: string }[] = [
  { slug: "private-investigator-thailand", th: "private-investigator" },
  { slug: "relationship-investigation", en: "cheating-spouse-investigator", th: "นักสืบชู้สาว" },
  { slug: "background-check", en: "background-check", th: "เช็คประวัติบุคคล" },
  { slug: "find-person-thailand", en: "find-missing-person", th: "สืบตามหาคน" },
  { slug: "asset-investigation", en: "asset-investigation", th: "สืบทรัพย์สิน" },
  { slug: "pricing", en: "pricing", th: "ราคานักสืบ" },
  { slug: "contact", en: "contact", th: "ติดต่อนักสืบ" },
  { slug: "bangkok", en: "private-investigator-bangkok", th: "นักสืบกรุงเทพ" },
  { slug: "about", en: "about", th: "เกี่ยวกับเรา" },
];

/** Service key (ZhPage.service / article service) → /zh page path. */
export const ZH_SERVICE_PAGE: Record<string, string> = {
  relationship: "/zh/relationship-investigation",
  find_person: "/zh/find-person-thailand",
  background: "/zh/background-check",
  due_diligence: "/zh/business-due-diligence",
  on_site: "/zh/on-site-verification",
  asset: "/zh/asset-investigation",
  pricing: "/zh/pricing",
  general: "/zh/private-investigator-thailand",
};

/** Service key for an article: its stored service, else a guess from the cover category. */
export function articleServiceKey(service: string | null | undefined, coverCategory: string | null | undefined): string {
  if (service && Object.hasOwn(ZH_SERVICE_PAGE, service)) return service;
  switch (coverCategory) {
    case "infidelity": return "relationship";
    case "asset": return "asset";
    case "background": case "cyber": return "background";
    case "find-person": return "find_person";
    case "pricing": return "pricing";
    default: return "general";
  }
}

export function zhLinkFor(slug: string) {
  return ZH_SLUG_LINKS.find((l) => l.slug === slug);
}
export function zhSlugForEn(en: string): string | undefined {
  return ZH_SLUG_LINKS.find((l) => l.en === en)?.slug;
}
