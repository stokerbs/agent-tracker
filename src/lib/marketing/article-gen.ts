import "server-only";

import { classifyArticle } from "@/lib/marketing/article-category";
import type { ArticleFormat } from "@/lib/marketing/topic-picker";

const MODEL = process.env.MARKETING_AI_MODEL ?? "claude-haiku-4-5-20251001";

// Keyword pool seeded from Detective Pulse's real Google Ads search-keyword
// report — the terms that actually drove clicks/conversions — then broadened
// well beyond the ad keywords (legal/evidence, corporate, scams, family,
// assets, regional, cross-border, "how the work happens") so the twice-weekly
// cron has years of genuinely different articles to write instead of circling
// the same handful of service keywords.
//
// Each entry pairs a Thai + English + Chinese target keyword with an article
// angle; the generator weaves the keyword naturally into each language version
// for SEO alignment with the ads. Ordered roughly by proven intent (highest-
// converting keywords first) — the picker takes the first unused one, but skips
// ahead when the previous articles came from the same `category`, so the blog
// doesn't publish five location pages in a row. See topic-picker.ts.
export interface KeywordTopic {
  /** Thai target keyword (also the stored `topic`, used for dedupe). */
  th: string;
  /** English target keyword for the EN version. */
  en: string;
  /** Chinese target keyword for the ZH version. */
  zh: string;
  /** Theme bucket — the picker spaces consecutive articles across categories. */
  category: TopicCategory;
  /** Short angle to steer the article. */
  angle: string;
}

/** Theme buckets used only for spacing/variety (cover art is classified separately). */
export type TopicCategory =
  | "infidelity"
  | "background"
  | "find-person"
  | "asset"
  | "cyber"
  | "scam"
  | "hire"
  | "pricing"
  | "location"
  | "legal"
  | "corporate"
  | "family"
  | "safety"
  | "cross-border"
  | "process";

export const KEYWORD_TOPICS: KeywordTopic[] = [
  // ── Proven organic winners (Google Search Console, 3-month) ───────────────
  // Already earning impressions just off page 1, so they stay at the top and
  // get their article first.
  { th: "เช็คประวัติบุคคลจากชื่อนามสกุล", en: "background check by name", zh: "凭姓名背景调查", category: "background", angle: "เช็คประวัติบุคคลจากแค่ชื่อ-นามสกุล ตรวจอะไรได้บ้าง เริ่มอย่างไร และขอบเขตทางกฎหมาย" },
  { th: "จ้างนักสืบออนไลน์", en: "hire a private investigator online", zh: "网上聘请私家侦探", category: "hire", angle: "จ้างนักสืบผ่านออนไลน์ ขั้นตอน ราคา และวิธีเลือกให้ปลอดภัยไม่โดนหลอก" },
  { th: "ตามหาคนจากชื่อ", en: "find someone by name", zh: "凭姓名寻人", category: "find-person", angle: "ตามหาคนจากแค่ชื่อ-นามสกุล ทำได้แค่ไหน ต้องมีข้อมูลอะไรบ้าง" },
  { th: "นักสืบไอที", en: "cyber private investigator", zh: "网络侦探调查", category: "cyber", angle: "สืบข้อมูลบนโซเชียล/ออนไลน์/ดิจิทัล ทำได้แค่ไหนอย่างถูกกฎหมาย" },
  { th: "จ้างนักสืบตามหาคน", en: "find a missing person investigator", zh: "泰国寻人调查", category: "find-person", angle: "ตามหาคนหาย ญาติพลัดพราก ลูกหนี้หลบหนี ตามหาคนโกง" },
  { th: "รับสืบประวัติ", en: "background check investigator", zh: "背景调查服务", category: "background", angle: "ตรวจสอบประวัติบุคคลก่อนร่วมงาน คบหา หรือทำธุรกิจ" },
  { th: "นักสืบชู้สาว", en: "infidelity private investigator", zh: "婚外情调查", category: "infidelity", angle: "จับผิดคู่รัก เก็บหลักฐานเพื่อใช้ในชั้นศาล" },
  { th: "จ้างนักสืบตามแฟน", en: "track a cheating partner", zh: "跟踪伴侣调查", category: "infidelity", angle: "ติดตามพฤติกรรมแฟนหรือคู่สมรสที่สงสัย" },
  { th: "นักสืบกรุงเทพ", en: "private detective bangkok", zh: "曼谷私家侦探", category: "location", angle: "บริการนักสืบเอกชนในกรุงเทพฯ" },
  { th: "นักสืบพัทยา", en: "private detective pattaya", zh: "芭提雅私家侦探", category: "location", angle: "บริการนักสืบเอกชนในพัทยา" },
  { th: "นักสืบเชียงใหม่", en: "private investigator chiang mai", zh: "清迈私家侦探", category: "location", angle: "บริการนักสืบเอกชนในเชียงใหม่" },
  { th: "สืบทรัพย์สิน", en: "asset search investigator", zh: "财产调查", category: "asset", angle: "ตรวจสอบทรัพย์สินลูกหนี้ก่อนฟ้องหรือบังคับคดี" },
  { th: "บริการนักสืบ", en: "private investigation services", zh: "私家侦探服务", category: "hire", angle: "งานสืบเอกชนครบวงจร มีบริการอะไรบ้าง" },
  { th: "บริษัทนักสืบ", en: "private detective agency", zh: "侦探公司", category: "hire", angle: "วิธีเลือกบริษัทนักสืบที่น่าเชื่อถือ" },
  { th: "นักสืบติดตามบุคคล", en: "personal surveillance investigator", zh: "人员跟踪调查", category: "process", angle: "การติดตามและเฝ้าสังเกตบุคคลเป้าหมาย" },
  { th: "ค่าจ้างนักสืบ", en: "private investigator cost", zh: "私家侦探费用", category: "pricing", angle: "ปัจจัยที่มีผลต่อราคางานสืบ และการชำระเงิน" },
  { th: "หานักสืบมืออาชีพ", en: "how to hire a private investigator", zh: "如何聘请私家侦探", category: "hire", angle: "วิธีเลือกนักสืบที่ไว้ใจได้ ไม่โดนหลอก" },
  { th: "ตามหาคนโกงออนไลน์", en: "online scam / fraud investigator", zh: "网络诈骗调查", category: "scam", angle: "โดนโกงออนไลน์ ตามหาคนโกง มีโอกาสตามเงินคืนไหม" },
  { th: "นักสืบเอกชนทั่วไทย", en: "private investigator thailand", zh: "泰国私家侦探", category: "location", angle: "บริการสืบทั่วราชอาณาจักร ครอบคลุมพื้นที่ใดบ้าง" },
  { th: "สำนักงานนักสืบ", en: "private investigator office", zh: "私家侦探事务所", category: "hire", angle: "นักสืบเอกชนทำงานอย่างไร (ฟรีแลนซ์ ไม่มีสำนักงานประจำ)" },
  { th: "เช็คประวัติก่อนแต่งงาน", en: "pre-marriage background check", zh: "婚前背景调查", category: "family", angle: "ตรวจสอบว่าที่คู่ครองก่อนตัดสินใจแต่งงาน" },

  // ── Legal & evidence ─────────────────────────────────────────────────────
  // Informational intent: people searching these are mid-problem and convert
  // once they understand what evidence they actually need.
  { th: "หลักฐานฟ้องหย่า", en: "evidence for a divorce case", zh: "离婚诉讼证据", category: "legal", angle: "หลักฐานประเภทใดที่มักใช้ประกอบการฟ้องหย่า และวิธีเก็บให้เป็นระบบ (ย้ำให้ปรึกษาทนายควบคู่)" },
  { th: "ฟ้องชู้เรียกค่าทดแทน", en: "suing a third party for damages", zh: "起诉第三者索赔", category: "legal", angle: "ภาพรวมการเรียกค่าทดแทนจากผู้ที่เข้ามาแทรกกลางความสัมพันธ์ และหลักฐานที่มักต้องใช้" },
  { th: "ติด GPS รถผิดกฎหมายไหม", en: "is GPS tracking someone legal", zh: "私自安装GPS是否违法", category: "legal", angle: "ขอบเขตกฎหมายของการติดตามด้วย GPS สิ่งที่ทำได้และทำไม่ได้ ทำไมนักสืบมืออาชีพเลี่ยงวิธีผิดกฎหมาย" },
  { th: "แอบอัดเสียงใช้เป็นหลักฐานได้ไหม", en: "are secret recordings valid evidence", zh: "私自录音能否作为证据", category: "legal", angle: "การบันทึกเสียง/ภาพกับการรับฟังเป็นพยานหลักฐาน ข้อควรระวังและความเสี่ยง" },
  { th: "PDPA กับการสืบข้อมูลส่วนบุคคล", en: "PDPA and private investigations", zh: "个人资料保护法与调查", category: "legal", angle: "กฎหมายคุ้มครองข้อมูลส่วนบุคคลกระทบงานสืบอย่างไร ข้อมูลแบบไหนที่ขอไม่ได้" },
  { th: "เก็บหลักฐานแชทไม่ให้ถูกลบ", en: "how to preserve chat evidence", zh: "如何保存聊天记录证据", category: "legal", angle: "วิธีสำรองแชท ภาพ และสลิป ให้ยังน่าเชื่อถือ ไม่ถูกอ้างว่าตัดต่อ" },
  { th: "แจ้งความคนหาย", en: "reporting a missing person in thailand", zh: "泰国失踪人口报案", category: "legal", angle: "ขั้นตอนแจ้งความคนหาย ต้องเตรียมอะไร และเมื่อไรที่นักสืบเอกชนช่วยเสริมได้" },
  { th: "หาพยานในคดี", en: "locating witnesses for a case", zh: "案件证人查找", category: "legal", angle: "ตามหาพยานที่ย้ายที่อยู่หรือติดต่อไม่ได้ เพื่อประกอบการดำเนินคดี" },

  // ── Corporate / business ─────────────────────────────────────────────────
  // B2B intent — bigger budgets, longer engagements.
  { th: "ตรวจสอบประวัติพนักงานก่อนรับเข้าทำงาน", en: "pre-employment background screening", zh: "入职背景调查", category: "corporate", angle: "องค์กรควรตรวจอะไรก่อนรับคนเข้าทำงาน และทำอย่างไรให้ถูกกฎหมาย/ขอความยินยอม" },
  { th: "สืบพนักงานทุจริต", en: "employee fraud investigation", zh: "员工舞弊调查", category: "corporate", angle: "สัญญาณการทุจริตภายในองค์กร และวิธีรวบรวมหลักฐานอย่างเป็นระบบ" },
  { th: "ตรวจสอบคู่ค้าก่อนร่วมทุน", en: "business partner due diligence", zh: "合作伙伴尽职调查", category: "corporate", angle: "เช็คตัวตน ประวัติธุรกิจ และความน่าเชื่อถือของคู่ค้าก่อนลงเงิน" },
  { th: "สืบสินค้าปลอมละเมิดเครื่องหมายการค้า", en: "counterfeit and trademark investigation", zh: "假货与商标侵权调查", category: "corporate", angle: "ตามหาแหล่งผลิต/ผู้ขายสินค้าปลอม เพื่อประกอบการดำเนินคดีของเจ้าของแบรนด์" },
  { th: "สืบข้อมูลคู่แข่งอย่างถูกกฎหมาย", en: "legal competitive intelligence", zh: "合法商业情报调查", category: "corporate", angle: "เส้นแบ่งระหว่างการเก็บข้อมูลตลาดที่ทำได้ กับการล้วงความลับที่ผิดกฎหมาย" },
  { th: "ตรวจสอบพนักงานลาป่วยเท็จ", en: "sick leave abuse surveillance", zh: "虚假病假调查", category: "corporate", angle: "เมื่อองค์กรสงสัยการลาป่วยเท็จ ควรตรวจสอบอย่างไรให้เป็นธรรมและไม่ละเมิดสิทธิ" },
  { th: "สืบความลับทางการค้ารั่วไหล", en: "trade secret leak investigation", zh: "商业机密泄露调查", category: "corporate", angle: "ข้อมูลภายในรั่วไปหาคู่แข่ง ตั้งต้นสืบอย่างไร และเก็บหลักฐานดิจิทัลแบบไหน" },
  { th: "ตรวจสอบแฟรนไชส์ก่อนลงทุน", en: "franchise and investment vetting", zh: "加盟投资前调查", category: "corporate", angle: "ก่อนซื้อแฟรนไชส์หรือลงทุนร่วม ควรตรวจสอบอะไรบ้างเพื่อลดความเสี่ยงถูกหลอก" },
  { th: "ตรวจสอบวุฒิการศึกษาปลอม", en: "verifying fake degrees and work history", zh: "学历与工作经历核实", category: "corporate", angle: "ตรวจวุฒิและประวัติการทำงานที่น่าสงสัย ทำได้ในกรอบไหน" },
  { th: "สืบเคลมประกันทุจริต", en: "insurance fraud investigation", zh: "保险欺诈调查", category: "corporate", angle: "งานตรวจสอบการเคลมที่น่าสงสัยให้บริษัทประกันและผู้เสียหาย" },

  // ── Scams, fraud & digital harm ──────────────────────────────────────────
  { th: "สืบแก๊งคอลเซ็นเตอร์", en: "call center scam investigation", zh: "电信诈骗调查", category: "scam", angle: "โดนแก๊งคอลเซ็นเตอร์หลอก ควรทำอะไรทันที และนักสืบช่วยตรงไหนได้บ้าง" },
  { th: "โดนหลอกลงทุนคริปโต", en: "crypto investment scam investigation", zh: "加密货币投资诈骗调查", category: "scam", angle: "หลอกลงทุนคริปโต/เทรดปลอม ตามรอยเส้นทางเงินและตัวตนคนชวนได้แค่ไหน" },
  { th: "โดนหลอกให้รักออนไลน์", en: "romance scam investigation", zh: "网络情感诈骗调查", category: "scam", angle: "โรแมนซ์สแกม รูปแบบที่พบบ่อย วิธีตรวจสอบตัวตน และสิ่งที่ควรทำเมื่อเสียเงินไปแล้ว" },
  { th: "ตรวจสอบตัวตนคนคุยในแอปหาคู่", en: "dating app identity verification", zh: "交友软件身份核实", category: "scam", angle: "ก่อนไปเจอหรือโอนเงินให้ใครที่รู้จักออนไลน์ ควรยืนยันตัวตนอย่างไร" },
  { th: "สืบบัญชีม้า", en: "mule bank account tracing", zh: "洗钱账户追查", category: "scam", angle: "บัญชีม้าคืออะไร ตามรอยได้แค่ไหน และต้องประสานกับตำรวจ/ธนาคารอย่างไร" },
  { th: "โดนแบล็กเมล์ภาพหลุด", en: "sextortion and blackmail investigation", zh: "裸照勒索调查", category: "safety", angle: "ถูกขู่แพร่ภาพส่วนตัว ทำอย่างไรให้ปลอดภัยที่สุด เก็บหลักฐานอะไร และอย่าจ่ายทันที" },
  { th: "สืบคนปลอมโปรไฟล์", en: "fake profile and catfish investigation", zh: "假冒身份调查", category: "cyber", angle: "โปรไฟล์ปลอม แอบอ้างชื่อ ใช้รูปคนอื่น ตรวจสอบและรวบรวมหลักฐานอย่างไร" },
  { th: "โดนโกงซื้อขายออนไลน์", en: "online shopping fraud investigation", zh: "网购诈骗调查", category: "scam", angle: "โอนแล้วไม่ได้ของ ร้านปิดหนี ตามหาผู้ขายและเตรียมเรื่องแจ้งความ" },
  { th: "ถูกสตอล์กเกอร์คุกคาม", en: "stalking and harassment investigation", zh: "跟踪骚扰调查", category: "safety", angle: "ถูกตามรังควาน ทั้งออนไลน์และในชีวิตจริง เก็บหลักฐานและวางแผนความปลอดภัยอย่างไร" },

  // ── Family & relationships ───────────────────────────────────────────────
  { th: "สัญญาณว่าคู่รักนอกใจ", en: "signs your partner is cheating", zh: "伴侣出轨的迹象", category: "infidelity", angle: "สัญญาณที่คนมักสังเกตเห็น ข้อควรระวังเรื่องการด่วนสรุป และควรทำอะไรก่อนตัดสินใจ" },
  { th: "สืบพฤติกรรมลูกวัยรุ่น", en: "teen behaviour investigation", zh: "青少年行为调查", category: "family", angle: "พ่อแม่ที่กังวลเรื่องลูกวัยรุ่น ควรคุยก่อนหรือสืบก่อน และขอบเขตที่เหมาะสม" },
  { th: "ตรวจสอบว่าที่ลูกเขยลูกสะใภ้", en: "vetting a future son or daughter in law", zh: "未来女婿儿媳背景调查", category: "family", angle: "ครอบครัวอยากมั่นใจก่อนงานแต่ง ตรวจอะไรได้บ้างโดยไม่ล้ำเส้น" },
  { th: "หลักฐานสิทธิเลี้ยงดูบุตร", en: "child custody investigation", zh: "子女抚养权调查", category: "family", angle: "ข้อมูลด้านความเป็นอยู่และความปลอดภัยของเด็กที่มักใช้ประกอบคดีสิทธิเลี้ยงดู" },
  { th: "ตามหาญาติที่พลัดพราก", en: "reuniting with lost family", zh: "寻找失散亲人", category: "find-person", angle: "ตามหาพ่อแม่ พี่น้อง หรือญาติที่ขาดการติดต่อมานาน ต้องเริ่มจากข้อมูลอะไร" },
  { th: "ตรวจสอบประวัติพี่เลี้ยงเด็ก", en: "nanny and housekeeper background check", zh: "保姆背景调查", category: "family", angle: "ก่อนให้ใครดูแลลูกหรืออยู่ในบ้าน ควรตรวจสอบอะไร และขอความยินยอมอย่างไร" },
  { th: "ตรวจสอบคนดูแลผู้สูงอายุ", en: "elder care caregiver check", zh: "老人看护背景调查", category: "family", angle: "ป้องกันการละเลย ทำร้าย หรือฉ้อโกงทรัพย์สินผู้สูงอายุในบ้าน" },

  // ── Assets & debt ────────────────────────────────────────────────────────
  { th: "สืบบัญชีธนาคารลูกหนี้", en: "debtor bank account tracing", zh: "追查债务人账户", category: "asset", angle: "สืบข้อมูลทางการเงินของลูกหนี้ทำได้แค่ไหน อะไรที่ต้องผ่านหมายศาลเท่านั้น" },
  { th: "สืบที่ดินก่อนฟ้อง", en: "land and property search before filing", zh: "诉讼前财产调查", category: "asset", angle: "ตรวจทรัพย์ก่อนฟ้อง เพื่อรู้ว่าฟ้องแล้วมีอะไรให้บังคับคดีจริงหรือไม่" },
  { th: "ตามหาลูกหนี้หนีหนี้", en: "skip tracing a runaway debtor", zh: "追查逃债人", category: "find-person", angle: "ลูกหนี้ย้ายที่อยู่ ปิดเบอร์ ปิดโซเชียล ยังตามได้ไหม เริ่มอย่างไร" },
  { th: "ตรวจสอบทรัพย์สินก่อนหย่า", en: "marital asset investigation before divorce", zh: "离婚前财产调查", category: "asset", angle: "สงสัยว่ามีการโยกย้ายทรัพย์สินก่อนหย่า ตรวจสอบอย่างไรให้เป็นระบบ" },

  // ── Regional coverage (long-tail local SEO) ──────────────────────────────
  { th: "นักสืบภูเก็ต", en: "private detective phuket", zh: "普吉私家侦探", category: "location", angle: "บริการนักสืบเอกชนในภูเก็ตและอันดามัน พร้อมงานที่พบบ่อยในพื้นที่ท่องเที่ยว" },
  { th: "นักสืบชลบุรี ศรีราชา", en: "private investigator chonburi sriracha", zh: "春武里私家侦探", category: "location", angle: "บริการนักสืบในชลบุรี ศรีราชา และพื้นที่นิคมอุตสาหกรรม" },
  { th: "นักสืบขอนแก่น", en: "private investigator khon kaen", zh: "孔敬私家侦探", category: "location", angle: "บริการนักสืบเอกชนในขอนแก่นและภาคอีสานตอนกลาง" },
  { th: "นักสืบหาดใหญ่ สงขลา", en: "private investigator hat yai songkhla", zh: "合艾私家侦探", category: "location", angle: "บริการนักสืบเอกชนในหาดใหญ่ สงขลา และภาคใต้ตอนล่าง" },
  { th: "นักสืบนครราชสีมา", en: "private investigator korat", zh: "呵叻私家侦探", category: "location", angle: "บริการนักสืบเอกชนในโคราชและภาคอีสานตอนล่าง" },
  { th: "นักสืบอุดรธานี", en: "private investigator udon thani", zh: "乌隆他尼私家侦探", category: "location", angle: "บริการนักสืบเอกชนในอุดรธานีและจังหวัดใกล้เคียง" },
  { th: "นักสืบเชียงราย", en: "private investigator chiang rai", zh: "清莱私家侦探", category: "location", angle: "บริการนักสืบเอกชนในเชียงรายและภาคเหนือตอนบน" },
  { th: "จ้างนักสืบต่างจังหวัด", en: "upcountry investigation and travel costs", zh: "外府调查差旅费用", category: "pricing", angle: "งานสืบต่างจังหวัดคิดค่าเดินทางอย่างไร และวางแผนงบอย่างไรให้คุ้ม" },

  // ── Cross-border / foreign clients ───────────────────────────────────────
  { th: "นักสืบสำหรับชาวต่างชาติในไทย", en: "private investigator for foreigners in thailand", zh: "在泰外籍人士侦探服务", category: "cross-border", angle: "ชาวต่างชาติในไทยใช้บริการนักสืบอย่างไร เรื่องภาษา เอกสาร และความคาดหวัง" },
  { th: "ตรวจสอบแฟนต่างชาติ", en: "verifying an overseas partner", zh: "核实外籍伴侣身份", category: "cross-border", angle: "คบกับคนต่างชาติที่ยังไม่เคยเจอตัว ควรตรวจสอบอะไรก่อนโอนเงินหรือเดินทางไปหา" },
  { th: "สืบคนไทยในต่างประเทศ", en: "tracing thai nationals overseas", zh: "追查海外泰籍人士", category: "cross-border", angle: "ตามหาคนไทยที่ไปทำงาน/หายตัวในต่างประเทศ ข้อจำกัดและช่องทางที่ใช้ได้" },
  { th: "ตรวจสอบก่อนจดทะเบียนสมรสกับชาวต่างชาติ", en: "marriage fraud background check", zh: "婚姻签证欺诈调查", category: "cross-border", angle: "ก่อนจดทะเบียนสมรสข้ามชาติ ควรตรวจสถานะสมรสและประวัติอย่างไร" },

  // ── How the work actually happens (trust builders) ───────────────────────
  { th: "ขั้นตอนการจ้างนักสืบ", en: "the investigation process step by step", zh: "委托调查的完整流程", category: "process", angle: "ตั้งแต่ปรึกษาครั้งแรก ประเมินงาน เริ่มสืบ รายงานผล จนปิดงาน" },
  { th: "ข้อมูลที่ต้องเตรียมก่อนคุยกับนักสืบ", en: "what to prepare before your first consultation", zh: "咨询前需准备的资料", category: "process", angle: "เตรียมข้อมูลอะไรไปคุย จะประเมินงานได้เร็วและแม่นขึ้น" },
  { th: "รายงานผลการสืบมีอะไรบ้าง", en: "what is inside an investigation report", zh: "调查报告包含什么", category: "process", angle: "องค์ประกอบของรายงาน ภาพ ไทม์ไลน์ และวิธีอ่านรายงานให้เข้าใจ" },
  { th: "นักสืบเก็บความลับลูกค้าอย่างไร", en: "client confidentiality in investigations", zh: "客户保密机制", category: "process", angle: "การรักษาความลับของลูกค้า การเก็บข้อมูล และสิ่งที่ลูกค้าควรถามก่อนจ้าง" },
  { th: "การทำงานหนึ่งวันของนักสืบ", en: "a day in the life of a surveillance team", zh: "侦探跟踪工作的一天", category: "process", angle: "เล่าภาพรวมงานเฝ้าติดตามหนึ่งวัน ทำไมบางงานต้องใช้เวลาหลายวัน" },
  { th: "เทคโนโลยีที่นักสืบใช้", en: "tools and technology investigators use", zh: "侦探使用的技术工具", category: "process", angle: "เครื่องมือที่ใช้จริงในงานสืบยุคนี้ และเส้นแบ่งกับเครื่องมือที่ผิดกฎหมาย" },
  { th: "นักสืบเอกชนกับตำรวจต่างกันอย่างไร", en: "private investigator vs police", zh: "私家侦探与警察的区别", category: "process", angle: "อำนาจ ขอบเขต และเวลาที่ควรใช้แต่ละทาง รวมถึงการทำงานคู่กัน" },
  { th: "ความเชื่อผิด ๆ เกี่ยวกับนักสืบ", en: "private investigator myths", zh: "关于私家侦探的误解", category: "process", angle: "ความเข้าใจผิดจากหนัง/ละคร เทียบกับงานสืบจริงในไทย" },
  { th: "ระวังนักสืบปลอม", en: "avoiding fake detective scams", zh: "识别假冒侦探骗局", category: "safety", angle: "สัญญาณของนักสืบปลอมที่รับเงินแล้วหาย และวิธีตรวจสอบก่อนโอน" },
  { th: "จ้างนักสืบด่วน", en: "urgent same day investigation", zh: "紧急当日调查", category: "process", angle: "งานเร่งด่วนทำได้แค่ไหน ต้องเตรียมอะไร และมีข้อจำกัดอะไร" },
  { th: "งบน้อยจ้างนักสืบได้ไหม", en: "investigating on a small budget", zh: "预算有限如何委托调查", category: "pricing", angle: "จัดลำดับความสำคัญของงานเมื่อมีงบจำกัด และสิ่งที่ทำเองได้ก่อน" },
  { th: "สืบข้อมูลจากทะเบียนรถ", en: "vehicle and license plate tracing", zh: "车牌车辆信息调查", category: "cyber", angle: "ข้อมูลจากทะเบียนรถสืบได้แค่ไหน อะไรที่ต้องผ่านช่องทางราชการเท่านั้น" },
  { th: "เช็คว่าถูกติดตามอยู่หรือไม่", en: "counter surveillance check", zh: "反跟踪检测", category: "safety", angle: "สัญญาณว่ากำลังถูกติดตาม และวิธีตรวจสอบอย่างปลอดภัย" },
  { th: "ตรวจหากล้องแอบถ่ายในที่พัก", en: "hidden camera detection", zh: "隐藏摄像头检测", category: "safety", angle: "ตรวจกล้องแอบถ่ายในโรงแรม/ห้องเช่า ด้วยตัวเองเบื้องต้นและเมื่อไรควรเรียกมืออาชีพ" },
  { th: "ตรวจสอบประวัติผู้เช่าบ้าน", en: "tenant screening background check", zh: "租客背景调查", category: "background", angle: "ก่อนปล่อยเช่าบ้าน/คอนโด ตรวจสอบผู้เช่าอย่างไรให้ถูกกฎหมายและลดความเสี่ยง" },
];

export interface GeneratedArticle {
  topic: string;
  thTitle: string;
  thDescription: string;
  thBody: string;
  enTitle: string;
  enDescription: string;
  enBody: string;
  zhTitle: string;
  zhDescription: string;
  zhBody: string;
  thSlug: string;
  enSlug: string;
  zhSlug: string;
  coverCategory: string;
  model: string;
}

const SYSTEM = `You are an expert multilingual SEO content writer for "Detective Pulse", a professional private-investigation firm in Thailand. You are given a TARGET KEYWORD (Thai + English + Chinese) that the firm actually advertises on, plus an angle. Write a genuinely helpful, accurate blog article that ranks for it — a Thai version, an English version, AND a Simplified Chinese version.

You are also given an ARTICLE FORMAT. Two articles about neighbouring keywords must not read like the same article — the format decides the shape.

ARTICLE FORMAT — follow it literally:
- Build the outline the format asks for (its own H2s), not a generic "ความสำคัญ / บริการของเรา / สรุป" template.
- Open in the way that format implies. Never open with a rhetorical question, "ในยุคปัจจุบัน", "ในปัจจุบัน", "หลายคนสงสัยว่า", "In today's world", or "在当今" — start on the reader's concrete situation instead.
- The three language versions share the format and the facts, but each must read as if written natively — not as a word-for-word translation.

FRESHNESS:
- A list of RECENT ARTICLE TITLES may be given. Those angles are taken: pick a different entry point, different sub-questions, and different examples. Do not restate their content.
- Vary sentence rhythm and headings between articles. No boilerplate paragraph you would reuse for any topic.

SEO KEYWORD TARGETING:
- Weave the THAI keyword naturally into the Thai title, the first paragraph, at least one H2 heading, and the Thai meta description.
- Weave the ENGLISH keyword the same way into the English title, first paragraph, an H2, and the English meta description.
- Weave the CHINESE keyword the same way into the Chinese title, first paragraph, an H2, and the Chinese meta description.
- Natural placement only — NO keyword stuffing, no awkward repetition.

RULES:
- Natural, warm, professional Thai (and natural English + natural Simplified Chinese for the other versions) — write for real prospective clients, not keyword stuffing.
- 500–800 words each. Use Markdown with H2 (##) / H3 (###) headings, short paragraphs, and a bullet list where useful.
- End with a short, soft call-to-action to consult Detective Pulse (LINE @detectivepluse / phone 096-846-1406) — one line, not pushy.
- Do NOT invent statistics, case numbers, prices, or legal citations. For legal questions, suggest consulting a lawyer.
- Do NOT guarantee investigation outcomes, and do NOT describe illegal or unethical methods (hacking, illegal tracking, impersonation). Keep everything within the law.
- The meta description must be a single plain sentence, 120–155 characters, no Markdown.
- Titles: compelling but honest, ≤60 characters, include "| Detective Pulse" is NOT needed (the template adds branding).
- Provide URL slugs: en_slug in lowercase kebab-case (a–z, 0–9, hyphens); th_slug a short Thai slug and zh_slug a short Chinese slug (concise, no spaces — use hyphens between words if needed).

Call the save_article tool exactly once with the finished content.`;

const ARTICLE_TOOL = {
  name: "save_article",
  description: "บันทึกบทความที่เขียนเสร็จ (ไทย + อังกฤษ + จีน) เรียกครั้งเดียว",
  input_schema: {
    type: "object" as const,
    properties: {
      th_title: { type: "string" },
      th_description: { type: "string" },
      th_body: { type: "string", description: "เนื้อหาบทความภาษาไทย (Markdown)" },
      en_title: { type: "string" },
      en_description: { type: "string" },
      en_body: { type: "string", description: "English article body (Markdown)" },
      zh_title: { type: "string" },
      zh_description: { type: "string" },
      zh_body: { type: "string", description: "简体中文文章正文 (Markdown)" },
      th_slug: { type: "string" },
      en_slug: { type: "string" },
      zh_slug: { type: "string" },
    },
    required: [
      "th_title", "th_description", "th_body",
      "en_title", "en_description", "en_body",
      "zh_title", "zh_description", "zh_body",
      "th_slug", "en_slug", "zh_slug",
    ],
  },
};

/** Kebab-case a Latin slug; keep Thai/Chinese as-is (valid in URLs). */
export function sanitizeSlug(raw: string, lang: "th" | "en" | "zh"): string {
  const s = raw.trim().toLowerCase();
  if (lang === "en") {
    return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "article";
  }
  // Thai/Chinese: strip whitespace/quotes/slashes, keep script + digits + hyphen.
  return raw.trim().replace(/\s+/g, "-").replace(/["'`/\\?#]+/g, "").slice(0, 80) || (lang === "zh" ? "文章" : "บทความ");
}

export interface GenerateOptions {
  /** Shape of the article — keeps repeat visits to a keyword from reading alike. */
  format?: ArticleFormat;
  /** Titles of the most recent articles, so the model avoids covering them again. */
  recentTitles?: string[];
}

/** Generate one trilingual, keyword-targeted article via Claude. Throws on failure. */
export async function generateArticle(seed: KeywordTopic, opts: GenerateOptions = {}): Promise<GeneratedArticle> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 6000,
        system: SYSTEM,
        tools: [ARTICLE_TOOL],
        tool_choice: { type: "tool", name: "save_article" },
        messages: [
          {
            role: "user",
            content:
              `TARGET KEYWORD (Thai): ${seed.th}\n` +
              `TARGET KEYWORD (English): ${seed.en}\n` +
              `TARGET KEYWORD (Chinese): ${seed.zh}\n` +
              `ANGLE: ${seed.angle}\n` +
              (opts.format
                ? `ARTICLE FORMAT: ${opts.format.en} (${opts.format.th})\n` +
                  `FORMAT BRIEF: ${opts.format.brief}\n`
                : "") +
              (opts.recentTitles?.length
                ? `\nRECENT ARTICLE TITLES (already covered — do NOT repeat their angle, structure or examples):\n` +
                  opts.recentTitles.map((t) => `- ${t}`).join("\n") +
                  `\n`
                : "") +
              `\nWrite the article in all three languages and call save_article.`,
          },
        ],
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as { content?: Array<{ type: string; name?: string; input?: Record<string, string> }> };
  const tool = data.content?.find((b) => b.type === "tool_use" && b.name === "save_article");
  const input = tool?.input;
  if (!input?.th_title || !input.th_body || !input.en_title || !input.en_body || !input.zh_title || !input.zh_body) {
    throw new Error("model did not return a complete article");
  }

  const coverCategory = classifyArticle(`${seed.th} ${seed.en} ${input.th_title}`).key;
  return {
    topic: seed.th,
    thTitle: input.th_title.trim(),
    thDescription: input.th_description.trim(),
    thBody: input.th_body.trim(),
    enTitle: input.en_title.trim(),
    enDescription: input.en_description.trim(),
    enBody: input.en_body.trim(),
    zhTitle: input.zh_title.trim(),
    zhDescription: (input.zh_description ?? "").trim(),
    zhBody: input.zh_body.trim(),
    thSlug: sanitizeSlug(input.th_slug, "th"),
    enSlug: sanitizeSlug(input.en_slug, "en"),
    zhSlug: sanitizeSlug(input.zh_slug, "zh"),
    coverCategory,
    model: MODEL,
  };
}
