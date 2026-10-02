import { FACTS } from "@/lib/marketing/facts";

// Focused, conversion-optimised landing pages for Google Ads campaigns. Each
// one matches a top-converting ad keyword (message match → better Quality Score
// + conversion) and carries service-specific content (deliverables + FAQ) so the
// pages aren't thin/near-duplicate — which would hurt the Ads landing-page
// experience rating. Rendered at /lp/<slug>; noindexed so they don't compete
// with the organic pages. Point each ad group here.

export type LandingLang = "th" | "en";

export interface LandingPage {
  /** Page language: TH pages render at /lp/<slug>, EN pages at /lp/en/<slug>. */
  lang: LandingLang;
  slug: string;
  /** The target ad keyword (also the SEO title base). */
  keyword: string;
  headlineLead: string;
  headlineAccent: string;
  sub: string;
  /** Section heading for the benefits block. */
  benefitsTitle: string;
  /** 3–4 short benefit bullets. */
  benefits: string[];
  /** "What you get" — concrete deliverables for this service. */
  deliverables: string[];
  /** 2–3 service-specific Q&A (accurate; no fabricated stats / no guarantees). */
  faq: { q: string; a: string }[];
  /** Prefilled context shown above the form. */
  formIntro: string;
}

export const TH_LANDING_PAGES: LandingPage[] = [
  {
    lang: "th",
    slug: "sued-choo-sao",
    keyword: "สืบชู้สาว จับชู้",
    headlineLead: "สงสัยว่าคนรัก",
    headlineAccent: "นอกใจ?",
    sub: "นักสืบเอกชนมืออาชีพ ติดตามพฤติกรรม เก็บหลักฐานชัดเจนเพื่อใช้ในชั้นศาล — เป็นความลับ 100%",
    benefitsTitle: "บริการสืบชู้สาวที่ไว้ใจได้",
    benefits: ["ติดตามพฤติกรรมแบบมืออาชีพ ไม่ให้รู้ตัว", "หลักฐานภาพ/วิดีโอ ใช้ในชั้นศาลได้", "รับงานทั่วประเทศ กัดไม่ปล่อย", "ข้อมูลลูกค้าเก็บเป็นความลับเด็ดขาด"],
    deliverables: ["ภาพถ่าย/วิดีโอพฤติกรรมของเป้าหมาย", "ไทม์ไลน์การเคลื่อนไหวและสถานที่ที่ไป", "รายงานสรุปเพื่อประกอบการตัดสินใจ", "อัปเดตความคืบหน้าเป็นระยะ"],
    faq: [
      { q: "หลักฐานที่ได้ใช้ในชั้นศาลได้ไหม?", a: "เรารวบรวมหลักฐานอย่างเป็นระบบ ทั้งภาพ วิดีโอ และรายงาน ซึ่งสามารถใช้ประกอบการพิจารณาได้ ทั้งนี้การรับฟังพยานหลักฐานขึ้นอยู่กับดุลพินิจของศาล แนะนำให้ปรึกษาทนายควบคู่ไปด้วย" },
      { q: "เป้าหมายจะรู้ตัวไหม?", a: "เราติดตามอย่างมืออาชีพและระมัดระวัง เพื่อไม่ให้เป้าหมายรู้ตัว" },
      { q: "ใช้เวลานานแค่ไหน?", a: "ขึ้นอยู่กับพฤติกรรมและข้อมูลที่มี โดยทั่วไปเริ่มงานได้รวดเร็วและอัปเดตความคืบหน้าต่อเนื่อง" },
    ],
    formIntro: "เล่าเรื่องที่สงสัยให้เราฟัง — ปรึกษาฟรี ไม่มีค่าใช้จ่าย",
  },
  {
    lang: "th",
    slug: "tam-ha-kon",
    keyword: "ตามหาคน สืบหาคน",
    headlineLead: "ตามหา",
    headlineAccent: "คนที่ตามหา",
    sub: "ตามหาคนหาย ญาติพลัดพราก ลูกหนี้หลบหนี หรือคนโกงที่หายตัวไป — ด้วยทีมนักสืบมืออาชีพทั่วราชอาณาจักร",
    benefitsTitle: "บริการตามหาคนที่ได้ผล",
    benefits: ["ตามหาคนหาย/ญาติพลัดพราก", "ตามคนโกง คนหนีหนี้", "หาที่อยู่ปัจจุบันของบุคคล", "ทำงานเป็นระบบ อัปเดตความคืบหน้า"],
    deliverables: ["ที่อยู่/ความเคลื่อนไหวล่าสุดเท่าที่สืบได้", "ข้อมูลยืนยันตัวตนของบุคคล", "ช่องทางติดต่อ (หากพบ)", "รายงานสรุปผลการตามหา"],
    faq: [
      { q: "มีข้อมูลน้อยมาก ตามหาได้ไหม?", a: "แจ้งข้อมูลที่มีทั้งหมด เช่น ชื่อ-นามสกุล รูป เบอร์เดิม จังหวัด แล้วทีมงานจะประเมินความเป็นไปได้ให้ก่อน" },
      { q: "ตามคนโกงหรือลูกหนี้ที่หนีได้ไหม?", a: "ได้ เรารับงานตามหาคนโกงและลูกหนี้ที่หลบหนี เพื่อประกอบการดำเนินการทางกฎหมายต่อไป" },
      { q: "รับประกันว่าเจอไหม?", a: "เราไม่รับประกันผล แต่ทำงานอย่างเต็มที่ เป็นระบบ และอัปเดตความคืบหน้าให้ทราบตลอด" },
    ],
    formIntro: "บอกข้อมูลที่มีของคนที่ตามหา — เราจะประเมินให้ฟรี",
  },
  {
    lang: "th",
    slug: "check-prawat",
    keyword: "เช็คประวัติบุคคล",
    headlineLead: "ตรวจสอบก่อน",
    headlineAccent: "ไว้ใจใคร",
    sub: "เช็คประวัติและความน่าเชื่อถือของบุคคล ก่อนร่วมงาน คบหา หรือทำธุรกิจ — แม่นยำ เป็นความลับ",
    benefitsTitle: "บริการเช็คประวัติที่แม่นยำ",
    benefits: ["เช็คประวัติก่อนร่วมธุรกิจ/รับเข้าทำงาน", "ตรวจสอบว่าที่คู่ครองก่อนตัดสินใจ", "ข้อมูลแม่นยำ ตรวจสอบได้", "รักษาความลับของผู้ว่าจ้าง"],
    deliverables: ["ข้อมูลประวัติและความน่าเชื่อถือของบุคคล", "ตรวจสอบความสอดคล้องของข้อมูลที่ให้มา", "ข้อมูลเชิงพฤติกรรมเท่าที่สืบได้", "รายงานสรุปเพื่อประกอบการตัดสินใจ"],
    faq: [
      { q: "ตรวจสอบด้านไหนได้บ้าง?", a: "เช่น ประวัติการทำงาน ความน่าเชื่อถือ และพฤติกรรม ก่อนร่วมธุรกิจ คบหา หรือรับเข้าทำงาน แจ้งวัตถุประสงค์เพื่อให้เราประเมินแนวทางได้ตรงจุด" },
      { q: "เช็คว่าที่คู่ครองก่อนแต่งได้ไหม?", a: "ได้ เป็นบริการที่ได้รับความนิยม เพื่อความมั่นใจก่อนตัดสินใจใช้ชีวิตร่วมกัน" },
      { q: "ข้อมูลเป็นความลับไหม?", a: "ข้อมูลของผู้ว่าจ้างและผลการตรวจสอบเก็บเป็นความลับอย่างเคร่งครัด" },
    ],
    formIntro: "บอกว่าต้องการตรวจสอบใครและด้านไหน — ปรึกษาฟรี",
  },
  {
    lang: "th",
    slug: "detective-bangkok",
    keyword: "นักสืบกรุงเทพ นักสืบเอกชน",
    headlineLead: "นักสืบเอกชน",
    headlineAccent: "มืออาชีพ",
    sub: "รับงานสืบทุกประเภทในกรุงเทพฯ และทั่วประเทศ — สืบชู้สาว สืบทรัพย์ ตามหาคน เช็คประวัติ นักสืบไอที",
    benefitsTitle: "ทำไมต้องนักสืบ Detective Pulse",
    benefits: ["ทีมนักสืบประสบการณ์สูง ทำงานเป็นระบบ", "รับงานทุกประเภท ครบวงจร", `ปิดกว่า ${FACTS.confirmed.closedCases.toLocaleString("en-US")} เคส คะแนน ${FACTS.confirmed.reviews.rating}/5`, "ปรึกษาฟรี เป็นความลับ"],
    deliverables: ["ประเมินแนวทางการสืบตามลักษณะงาน", "ทีมนักสืบลงพื้นที่จริง", "หลักฐาน/ข้อมูลตามประเภทงาน", "รายงานสรุปพร้อมหลักฐาน"],
    faq: [
      { q: "รับงานประเภทไหนบ้าง?", a: "สืบชู้สาว สืบทรัพย์สิน ตามหาคน เช็คประวัติบุคคล นักสืบไอที และงานสืบเอกชนอื่น ๆ" },
      { q: "รับเฉพาะกรุงเทพไหม?", a: "รับงานทั่วราชอาณาจักร ทั้งกรุงเทพฯ และต่างจังหวัด" },
      { q: "ค่าบริการเท่าไหร่?", a: "ขึ้นอยู่กับประเภทและความซับซ้อนของงาน ปรึกษาฟรีเพื่อประเมินราคาที่เหมาะสม" },
    ],
    formIntro: "เล่าเรื่องที่ต้องการให้สืบ — ทีมงานจะติดต่อกลับ",
  },
  {
    lang: "th",
    slug: "sued-sap-sin",
    keyword: "สืบทรัพย์สิน",
    headlineLead: "สืบทรัพย์สิน",
    headlineAccent: "ก่อนฟ้อง",
    sub: "ตรวจสอบทรัพย์สินลูกหนี้ — บ้าน ที่ดิน รถ กิจการ จากแหล่งข้อมูลที่เข้าถึงได้ตามกฎหมาย ก่อนฟ้องหรือบังคับคดี อย่างเป็นระบบ",
    benefitsTitle: "บริการสืบทรัพย์สินอย่างมืออาชีพ",
    benefits: ["ตรวจสอบทรัพย์สินก่อนฟ้อง/บังคับคดี", "หาบ้าน ที่ดิน รถ และกิจการของลูกหนี้", "รายงานเป็นระบบ พร้อมหลักฐาน", "เป็นความลับ มืออาชีพ"],
    deliverables: ["ข้อมูลทรัพย์สินของเป้าหมายเท่าที่สืบได้", "ตรวจสอบความเป็นเจ้าของ/ภาระผูกพันเท่าที่เข้าถึงได้ตามกฎหมาย", "รายงานเป็นระบบพร้อมหลักฐาน", "ข้อมูลประกอบการฟ้อง/บังคับคดี"],
    faq: [
      { q: "ใช้ก่อนฟ้องหรือบังคับคดีได้ไหม?", a: "ได้ ข้อมูลทรัพย์สินช่วยประกอบการวางแผนฟ้องหรือบังคับคดี แนะนำให้ปรึกษาทนายควบคู่ไปด้วย" },
      { q: "หาบัญชีธนาคารได้ไหม?", a: "ไม่ได้ — ข้อมูลบัญชีธนาคารได้รับความคุ้มครองตามกฎหมาย เข้าถึงได้เฉพาะผ่านกระบวนการศาลหรือการบังคับคดีเท่านั้น เราสืบเบาะแสทรัพย์สินที่เข้าถึงได้ตามกฎหมาย (บ้าน ที่ดิน รถ กิจการ) และประสานงานกับทนายความของคุณในขั้นตอนทางศาล" },
      { q: "ข้อมูลแม่นยำแค่ไหน?", a: "เราตรวจสอบอย่างเป็นระบบและรายงานตามข้อเท็จจริงที่สืบได้จริง" },
    ],
    formIntro: "บอกข้อมูลลูกหนี้ที่มี — เราจะประเมินแนวทางให้",
  },
  {
    lang: "th",
    slug: "detective-it",
    keyword: "นักสืบไอที สืบออนไลน์",
    headlineLead: "สืบข้อมูล",
    headlineAccent: "บนโลกออนไลน์",
    sub: "สืบพฤติกรรมบนโซเชียล ตามหาคนโกงออนไลน์ ตรวจสอบตัวตนบนโลกดิจิทัล — ถูกต้องตามกฎหมาย",
    benefitsTitle: "บริการนักสืบไอทีที่เชื่อถือได้",
    benefits: ["สืบพฤติกรรมบนโซเชียลมีเดีย", "ตามหาคนโกงออนไลน์", "ตรวจสอบตัวตน/บัญชีปลอม", "ทำงานภายใต้กรอบกฎหมาย"],
    deliverables: ["ข้อมูลพฤติกรรมบนโซเชียล/ออนไลน์เท่าที่สืบได้", "ตรวจสอบตัวตนและบัญชีที่เกี่ยวข้อง", "หลักฐานประกอบ เช่น ภาพหน้าจอ/ลิงก์", "รายงานสรุปผล"],
    faq: [
      { q: "สืบเฟซบุ๊ก/ไลน์/ออนไลน์ได้แค่ไหน?", a: "เราสืบข้อมูลที่เปิดเผยและเข้าถึงได้ภายใต้กรอบกฎหมาย ไม่เจาะระบบและไม่กระทำการผิดกฎหมาย" },
      { q: "ตามหาคนโกงออนไลน์ได้ไหม?", a: "ได้ เรารับสืบข้อมูลผู้ที่โกงออนไลน์ เพื่อประกอบการดำเนินการต่อ" },
      { q: "ถูกต้องตามกฎหมายไหม?", a: "เราทำงานภายใต้กรอบกฎหมายเสมอ ไม่แฮก ไม่ละเมิดข้อมูลโดยมิชอบ" },
    ],
    formIntro: "เล่าเรื่องออนไลน์ที่สงสัย — ปรึกษาฟรี เป็นความลับ",
  },
];

// English campaign pages for the international funnel (audit Days 8–30).
// WhatsApp-first CTAs, remote-briefing copy, lawful scope only. Stats come
// from FACTS; no figures are invented here.
export const EN_LANDING_PAGES: LandingPage[] = [
  {
    lang: "en",
    slug: "private-investigator-thailand",
    keyword: "Private Investigator Thailand",
    headlineLead: "Private investigator",
    headlineAccent: "in Thailand",
    sub: "Infidelity, partner verification, background checks, locating people and asset tracing — lawful, discreet, briefed from anywhere on WhatsApp.",
    benefitsTitle: "Why clients abroad choose us",
    benefits: ["Brief us on WhatsApp or email, in English, from any time zone", "Lawful methods only: public observation, open sources, field visits", "Written quote before anything starts; 50 % deposit, balance on delivery", "Report with photos, video and a timeline, delivered electronically"],
    deliverables: ["A feasibility assessment and written quote", "Field work by a Bangkok-based team, nationwide coverage", "Photos, video and timestamps from public places where relevant", "A factual report your lawyer can use"],
    faq: [
      { q: "I'm not in Thailand. Can you still take the case?", a: "Yes. Most of our clients are abroad. You brief us on WhatsApp or email, pay by international transfer and receive updates and the report electronically." },
      { q: "What can't you do?", a: "We never access another person's phone, bank, immigration or government data, never plant trackers and never approach the subject. Anyone offering those things is breaking Thai law." },
      { q: "How quickly can you start?", a: "Research-based work starts as soon as the quote is agreed; field assignments in Bangkok are usually staffed within 1–2 working days." },
    ],
    formIntro: "Tell us what you need to know — free, confidential assessment.",
  },
  {
    lang: "en",
    slug: "private-investigator-bangkok",
    keyword: "Private Investigator Bangkok",
    headlineLead: "Private investigator",
    headlineAccent: "in Bangkok",
    sub: "A resident Bangkok team for infidelity cases, background checks, locating people and company verification — discreet and fast to deploy.",
    benefitsTitle: "A team that knows the city",
    benefits: ["Resident investigators across every Bangkok district and the suburbs", "Observation planned around real routes and rush-hour traffic", "Meet in person in Bangkok, or brief us remotely on WhatsApp", "Lawful methods only; report with photos, video and timeline"],
    deliverables: ["Assignment plan sized for the district and routine", "Field work starting within 1–2 working days in most cases", "Timestamped photos and video from public places", "Written report, formatted for a lawyer when needed"],
    faq: [
      { q: "The subject lives in a guarded condo. Can you still work?", a: "Yes, from public areas around the building and its access routes. We never enter private premises." },
      { q: "Do you cover outside Bangkok?", a: "Yes, nationwide. Travel and accommodation outside Bangkok are itemised in the quote." },
      { q: "Can we meet before I decide?", a: "Yes, in Bangkok at a place convenient to you, or on a video call." },
    ],
    formIntro: "Describe the situation — we'll assess it free and reply confidentially.",
  },
  {
    lang: "en",
    slug: "infidelity",
    keyword: "Infidelity Investigator Thailand",
    headlineLead: "Suspect your partner",
    headlineAccent: "is cheating?",
    sub: "Discreet observation in public places, timestamped photo and video, and a written report — in Thailand or briefed from abroad.",
    benefitsTitle: "Facts instead of suspicion",
    benefits: ["Discreet observation by a team sized for the area — the subject is never approached", "Photos, video and a dated, timed, located timeline", "Updates on your schedule, in your time zone", "Reports formatted for Thai or foreign lawyers"],
    deliverables: ["Photos and video of the subject's movements in public places", "A timeline with dates, times and locations", "A written factual report", "A short recommendation on next steps"],
    faq: [
      { q: "Will my partner know?", a: "We work discreetly in public places and never make contact. No assignment is entirely risk-free, and we tell you where the risks are before we start." },
      { q: "Can the evidence be used in a divorce?", a: "Lawfully obtained evidence from public places can support a case in Thailand or elsewhere; admissibility is for the court. Involve a lawyer early — we format reports accordingly." },
      { q: "How long does it take?", a: "Typically 3–7 days of observation, planned around the subject's routine and your objective." },
    ],
    formIntro: "Tell us what you've noticed — free, confidential assessment.",
  },
  {
    lang: "en",
    slug: "partner-verification",
    keyword: "Thai Partner Verification",
    headlineLead: "Know who you're",
    headlineAccent: "committing to",
    sub: "Verify a Thai partner's identity, relationship status, work and lifestyle before marriage, property or money — lawfully, from public sources and observation.",
    benefitsTitle: "Before you commit",
    benefits: ["Identity and story checked against what is visible on the ground", "Relationship status and living situation as actually observed", "Workplace and address confirmed by visiting", "No contact with your partner or their family"],
    deliverables: ["Written report separating confirmed facts from indications", "Photos and timeline from any observation", "Consistency check of what you were told", "Plain recommendation on next steps"],
    faq: [
      { q: "Can you check whether they are already married?", a: "Marriage records are government data we do not access. We establish relationship status from how they actually live and from public sources, and explain which official checks you may request yourself." },
      { q: "I only have a name and a profile. Enough?", a: "It's a start. A workplace, neighbourhood or recent photos make the check faster and more precise. Send what you have and we assess for free." },
      { q: "Will they find out?", a: "We work in public places and never make contact. We tell you honestly where any risk lies before starting." },
    ],
    formIntro: "Share what you know — we'll tell you honestly what can be verified.",
  },
  {
    lang: "en",
    slug: "background-check",
    keyword: "Background Check Thailand",
    headlineLead: "Verify before",
    headlineAccent: "you trust",
    sub: "Background checks in Thailand on people and companies: identity, employment, litigation, directorships — from public sources and field verification.",
    benefitsTitle: "Lawful, verifiable checks",
    benefits: ["Identity, employment and address verified on the ground", "Public court records and the public business registry", "Pre-employment screening with consent, under Thailand's PDPA", "Clear separation of confirmed facts from indications"],
    deliverables: ["Written factual report with sources listed", "Consistency assessment of the information provided", "Photos from field verification where relevant", "Recommendation on next steps"],
    faq: [
      { q: "Can you check criminal records?", a: "We search publicly available court records. Official criminal-record certificates must be requested by the person concerned or through lawful procedures; we explain the steps." },
      { q: "Can you check a Thai company?", a: "Yes: registration, directors, shareholders and whether the registered address actually operates." },
      { q: "What can't you provide?", a: "Civil registry, social-security, bank, credit, travel or telephone data on other people. Those are protected by law and anyone selling them is committing an offence." },
    ],
    formIntro: "Tell us who and why — free, confidential assessment.",
  },
  {
    lang: "en",
    slug: "find-a-person",
    keyword: "Find a Person in Thailand",
    headlineLead: "Find someone",
    headlineAccent: "in Thailand",
    sub: "Lost relatives, a Thai partner who went silent, debtors or the person behind an online scam — located methodically from open sources, local networks and field work.",
    benefitsTitle: "A methodical search, honestly assessed",
    benefits: ["Honest feasibility assessment before you spend anything", "Open sources, local networks and field visits in the target province", "Any address confirmed by observation before we report", "We locate; your lawyer acts — we never collect debts or confront"],
    deliverables: ["Most recent address or whereabouts we can establish", "Confirmation the person found is the person sought", "A report of the steps taken and the outcome", "Advice on next steps: contact, lawyer or police report"],
    faq: [
      { q: "Can you find someone from just a name?", a: "Sometimes. We assess first, at no charge, whether the leads are enough to start." },
      { q: "Do you guarantee a result?", a: "No. We work methodically, report every step and stop as soon as continuing is not worth your money." },
      { q: "Someone may be in danger. What first?", a: "Report to the police immediately — there is no waiting period — and, for foreign nationals, the embassy. Our work complements an official search but never replaces it." },
    ],
    formIntro: "Share every lead you have — we'll assess it free.",
  },
];

export const LANDING_PAGES: Record<LandingLang, LandingPage[]> = { th: TH_LANDING_PAGES, en: EN_LANDING_PAGES };

export function getLandingPage(slug: string, lang: LandingLang = "th"): LandingPage | undefined {
  return LANDING_PAGES[lang].find((p) => p.slug === slug);
}
