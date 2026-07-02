// Focused, conversion-optimised landing pages for Google Ads campaigns. Each
// one matches a top-converting ad keyword (message match → better Quality Score
// + conversion). Rendered at /lp/<slug> by a shared template; noindexed so they
// don't compete with the organic pages. Point each ad group here.

export interface LandingPage {
  slug: string;
  /** The target ad keyword (also the SEO title base). */
  keyword: string;
  headlineLead: string;
  headlineAccent: string;
  sub: string;
  /** 3–4 short benefit bullets. */
  benefits: string[];
  /** Prefilled context shown above the form. */
  formIntro: string;
}

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: "sued-choo-sao",
    keyword: "สืบชู้สาว จับชู้",
    headlineLead: "สงสัยว่าคนรัก",
    headlineAccent: "นอกใจ?",
    sub: "นักสืบเอกชนมืออาชีพ ติดตามพฤติกรรม เก็บหลักฐานชัดเจนเพื่อใช้ในชั้นศาล — เป็นความลับ 100%",
    benefits: ["ติดตามพฤติกรรมแบบมืออาชีพ ไม่ให้รู้ตัว", "หลักฐานภาพ/วิดีโอ ใช้ในชั้นศาลได้", "รับงานทั่วประเทศ กัดไม่ปล่อย", "ข้อมูลลูกค้าเก็บเป็นความลับเด็ดขาด"],
    formIntro: "เล่าเรื่องที่สงสัยให้เราฟัง — ปรึกษาฟรี ไม่มีค่าใช้จ่าย",
  },
  {
    slug: "tam-ha-kon",
    keyword: "ตามหาคน สืบหาคน",
    headlineLead: "ตามหา",
    headlineAccent: "คนที่ตามหา",
    sub: "ตามหาคนหาย ญาติพลัดพราก ลูกหนี้หลบหนี หรือคนโกงที่หายตัวไป — ด้วยทีมนักสืบมืออาชีพทั่วราชอาณาจักร",
    benefits: ["ตามหาคนหาย/ญาติพลัดพราก", "ตามคนโกง คนหนีหนี้", "หาที่อยู่ปัจจุบันของบุคคล", "ทำงานเป็นระบบ อัปเดตความคืบหน้า"],
    formIntro: "บอกข้อมูลที่มีของคนที่ตามหา — เราจะประเมินให้ฟรี",
  },
  {
    slug: "check-prawat",
    keyword: "เช็คประวัติบุคคล",
    headlineLead: "ตรวจสอบก่อน",
    headlineAccent: "ไว้ใจใคร",
    sub: "เช็คประวัติและความน่าเชื่อถือของบุคคล ก่อนร่วมงาน คบหา หรือทำธุรกิจ — แม่นยำ เป็นความลับ",
    benefits: ["เช็คประวัติก่อนร่วมธุรกิจ/รับเข้าทำงาน", "ตรวจสอบว่าที่คู่ครองก่อนตัดสินใจ", "ข้อมูลแม่นยำ ตรวจสอบได้", "รักษาความลับของผู้ว่าจ้าง"],
    formIntro: "บอกว่าต้องการตรวจสอบใครและด้านไหน — ปรึกษาฟรี",
  },
  {
    slug: "detective-bangkok",
    keyword: "นักสืบกรุงเทพ นักสืบเอกชน",
    headlineLead: "นักสืบเอกชน",
    headlineAccent: "มืออาชีพ",
    sub: "รับงานสืบทุกประเภทในกรุงเทพฯ และทั่วประเทศ — สืบชู้สาว สืบทรัพย์ ตามหาคน เช็คประวัติ นักสืบไอที",
    benefits: ["ทีมนักสืบประสบการณ์สูง การันตีผลงาน", "รับงานทุกประเภท ครบวงจร", "ปิดกว่า 1,900 เคส คะแนน 4.8/5", "ปรึกษาฟรี เป็นความลับ"],
    formIntro: "เล่าเรื่องที่ต้องการให้สืบ — ทีมงานจะติดต่อกลับ",
  },
  {
    slug: "sued-sap-sin",
    keyword: "สืบทรัพย์สิน",
    headlineLead: "สืบทรัพย์สิน",
    headlineAccent: "ก่อนฟ้อง",
    sub: "ตรวจสอบทรัพย์สินลูกหนี้ — บ้าน ที่ดิน รถ บัญชีธนาคาร ก่อนฟ้องหรือบังคับคดี อย่างเป็นระบบ",
    benefits: ["ตรวจสอบทรัพย์สินก่อนฟ้อง/บังคับคดี", "หาบ้าน ที่ดิน รถ บัญชีธนาคาร", "รายงานเป็นระบบ พร้อมหลักฐาน", "เป็นความลับ มืออาชีพ"],
    formIntro: "บอกข้อมูลลูกหนี้ที่มี — เราจะประเมินแนวทางให้",
  },
  {
    slug: "detective-it",
    keyword: "นักสืบไอที สืบออนไลน์",
    headlineLead: "สืบข้อมูล",
    headlineAccent: "บนโลกออนไลน์",
    sub: "สืบพฤติกรรมบนโซเชียล ตามหาคนโกงออนไลน์ ตรวจสอบตัวตนบนโลกดิจิทัล — ถูกต้องตามกฎหมาย",
    benefits: ["สืบพฤติกรรมบนโซเชียลมีเดีย", "ตามหาคนโกงออนไลน์", "ตรวจสอบตัวตน/บัญชีปลอม", "ทำงานภายใต้กรอบกฎหมาย"],
    formIntro: "เล่าเรื่องออนไลน์ที่สงสัย — ปรึกษาฟรี เป็นความลับ",
  },
];

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}
