/**
 * Header / footer navigation for the Thai and English marketing site — plain
 * data safe for client components (mirrors src/lib/marketing/zh/nav.ts for
 * /zh). Services point at the six core service pages; hrefs are decoded,
 * non-trailing-slash paths so no nav click lands on a 308 redirect.
 * nav.test.ts asserts every href resolves to an existing content page.
 */
export interface NavLink { href: string; label: string }

export const TH_NAV = {
  services: [
    { href: "/นักสืบชู้สาว", label: "นักสืบชู้สาว" },
    { href: "/จ้างนักสืบตามแฟน", label: "สืบแฟน / ก่อนแต่งงาน" },
    { href: "/เช็คประวัติบุคคล", label: "เช็คประวัติบุคคล" },
    { href: "/สืบตามหาคน", label: "สืบตามหาคน" },
    { href: "/สืบทรัพย์สิน", label: "สืบทรัพย์สิน" },
    { href: "/นักสืบไอที", label: "นักสืบไอที" },
    { href: "/ติดตามพฤติกรรม", label: "ติดตามพฤติกรรม" },
    { href: "/ตรวจสอบธุรกิจและคู่ค้า", label: "ตรวจสอบธุรกิจ" },
    { href: "/ตรวจสอบประวัติพนักงาน", label: "ตรวจสอบพนักงาน" },
  ] as NavLink[],
  primary: [
    { href: "/ราคานักสืบ", label: "ราคา" },
    { href: "/นักสืบกรุงเทพ", label: "นักสืบกรุงเทพ" },
    { href: "/จ้างนักสืบ", label: "วิธีจ้างนักสืบ" },
    { href: "/เกี่ยวกับเรา", label: "เกี่ยวกับเรา" },
    { href: "/articles", label: "บทความ" },
    { href: "/careers", label: "ร่วมงาน" },
    { href: "/ติดต่อนักสืบ", label: "ติดต่อ" },
  ] as NavLink[],
  footer: [
    { href: "/ขั้นตอนการทำงาน", label: "ขั้นตอนการทำงาน" },
    { href: "/สำหรับทนายความ", label: "สำหรับทนายความ" },
    { href: "/กรณีศึกษา", label: "กรณีศึกษา" },
    { href: "/articles", label: "บทความทั้งหมด" },
    { href: "/careers", label: "ร่วมงานกับเรา" },
    { href: "/privacy", label: "นโยบายความเป็นส่วนตัว" },
  ] as NavLink[],
};

export const EN_NAV = {
  services: [
    { href: "/en/cheating-spouse-investigator", label: "Infidelity" },
    { href: "/en/background-check", label: "Background check" },
    { href: "/en/find-missing-person", label: "Find a person" },
    { href: "/en/asset-investigation", label: "Asset search" },
    { href: "/en/cyber-investigation", label: "Cyber / online" },
    { href: "/en/investigate-partner-before-marriage", label: "Partner verification" },
    { href: "/en/surveillance-thailand", label: "Surveillance" },
    { href: "/en/due-diligence-thailand", label: "Due diligence" },
    { href: "/en/romance-scam-investigation", label: "Romance scam" },
  ] as NavLink[],
  primary: [
    { href: "/en/pricing", label: "Pricing" },
    { href: "/en/private-investigator-bangkok", label: "Bangkok" },
    { href: "/en/hire-a-private-detective", label: "How to hire" },
    { href: "/en/about", label: "About" },
    { href: "/en/articles", label: "Articles" },
    { href: "/en/careers", label: "Careers" },
    { href: "/en/contact", label: "Contact" },
  ] as NavLink[],
  footer: [
    { href: "/en/how-it-works", label: "How it works" },
    { href: "/en/for-law-firms", label: "For law firms" },
    { href: "/en/case-studies", label: "Case studies" },
    { href: "/en/articles", label: "All articles" },
    { href: "/en/careers", label: "Careers" },
    { href: "/en/privacy", label: "Privacy notice" },
  ] as NavLink[],
};
