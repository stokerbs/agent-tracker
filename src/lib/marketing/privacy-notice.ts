import { CONTACT } from "@/lib/marketing/contact";
import { FACTS } from "@/lib/marketing/facts";

/**
 * Privacy notice for the public marketing site (detectivepulse.com) in TH / EN
 * / ZH — what the website, lead form, AI intake assistant and analytics
 * collect, under Thailand's PDPA. Distinct from /privacy on the app host,
 * which covers the Field Agent app.
 *
 * Content lives here (not in JSX) so the three languages stay in step and the
 * copy is unit-tested (same sections, no restricted-data claims).
 *
 * Owner / counsel: review before relying on it; set FACTS.pending.legalName so
 * the controller is named.
 */
export type PrivacyLang = "th" | "en" | "zh";

export interface PrivacySection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export interface PrivacyNotice {
  lang: PrivacyLang;
  path: string;
  title: string;
  description: string;
  h1: string;
  updatedLabel: string;
  intro: string;
  sections: PrivacySection[];
  contactLabel: string;
}

/** ISO date of the last substantive change. */
export const PRIVACY_UPDATED = "2026-10-02";

export const PRIVACY_PATH: Record<PrivacyLang, string> = { th: "/privacy", en: "/en/privacy", zh: "/zh/privacy" };

const controller = (lang: PrivacyLang) => {
  const legal = FACTS.pending.legalName;
  if (legal) return `${legal} (${CONTACT.brand})`;
  return CONTACT.brand;
};

const EMAIL = CONTACT.email;

export const PRIVACY_NOTICES: Record<PrivacyLang, PrivacyNotice> = {
  th: {
    lang: "th",
    path: PRIVACY_PATH.th,
    title: "นโยบายความเป็นส่วนตัว เว็บไซต์ Detective Pulse",
    description: "เว็บไซต์ detectivepulse.com เก็บข้อมูลอะไร ใช้เพื่ออะไร เก็บนานแค่ไหน และสิทธิของคุณตาม PDPA เมื่อติดต่อผ่านแบบฟอร์ม LINE WhatsApp หรือผู้ช่วย AI",
    h1: "นโยบายความเป็นส่วนตัว (เว็บไซต์)",
    updatedLabel: "ปรับปรุงล่าสุด",
    intro: `${controller("th")} ("เรา") เป็นผู้ควบคุมข้อมูลส่วนบุคคลสำหรับข้อมูลที่เก็บผ่านเว็บไซต์ detectivepulse.com ประกาศนี้อธิบายว่าเราเก็บข้อมูลอะไรเมื่อคุณเข้าชมเว็บไซต์ ส่งแบบฟอร์ม คุยกับผู้ช่วย AI หรือทักเราทาง LINE / WhatsApp ใช้เพื่ออะไร เก็บนานแค่ไหน และคุณมีสิทธิอะไรบ้างตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)`,
    sections: [
      {
        heading: "ข้อมูลที่เราเก็บ",
        body: [],
        bullets: [
          "แบบฟอร์มติดต่อ: ชื่อหรือชื่อเล่น เบอร์โทรหรือ LINE ID อีเมล (ถ้าให้) ประเภทงาน ข้อความที่คุณเขียน รวมถึงข้อมูลเบราว์เซอร์ (user agent) และหมายเลข IP ที่ใช้ป้องกันสแปม",
          "ผู้ช่วย AI รับเคส: ข้อความที่คุณพิมพ์ในหน้าต่างแชท และสรุปเคสที่ผู้ช่วยสร้างเมื่อคุณขอให้ติดต่อกลับ บทสนทนาดิบไม่ถูกเก็บถาวร",
          "ช่องทางแชทภายนอก: เมื่อคุณทักเราทาง LINE, WhatsApp, WeChat หรือ Facebook ข้อความนั้นอยู่ภายใต้นโยบายของผู้ให้บริการนั้นด้วย",
          "ที่มาของการติดต่อ: พารามิเตอร์แคมเปญ (utm, gclid, fbclid) หน้าที่คุณเข้าชมก่อนติดต่อ และเว็บไซต์ที่อ้างอิงมา เพื่อให้รู้ว่าช่องทางใดได้ผล",
          "ข้อมูลการใช้งานเว็บไซต์: คุกกี้และตัวระบุของ Google Tag Manager / Google Analytics / Google Ads ที่เก็บหน้าที่เข้าชม อุปกรณ์ และเหตุการณ์คลิกติดต่อ โดยไม่ระบุตัวตนคุณโดยตรง",
        ],
      },
      {
        heading: "เราใช้ข้อมูลเพื่ออะไร และฐานทางกฎหมาย",
        body: [],
        bullets: [
          "ตอบกลับคำถาม ประเมินความเป็นไปได้ และเสนอราคา — ฐานความยินยอมที่คุณให้ไว้เมื่อส่งแบบฟอร์ม และการดำเนินการตามคำขอก่อนเข้าทำสัญญา",
          "วัดผลการตลาดและปรับปรุงเว็บไซต์ — ฐานประโยชน์โดยชอบด้วยกฎหมาย โดยใช้ข้อมูลรวมและไม่ระบุตัวตนเท่าที่ทำได้",
          "ป้องกันสแปมและการใช้งานในทางที่ผิด (เช่น การจำกัดอัตราการส่ง และฟิลด์กับดักบอต) — ฐานประโยชน์โดยชอบด้วยกฎหมาย",
          "เราไม่ขายข้อมูลส่วนบุคคล และไม่ใช้ข้อมูลที่คุณส่งมาเพื่อโฆษณาไปยังบุคคลอื่น",
        ],
      },
      {
        heading: "ข้อมูลเกี่ยวกับบุคคลอื่นที่คุณให้มา",
        body: ["ข้อมูลของบุคคลที่คุณต้องการให้สืบสวนจะถูกใช้เพื่อประเมินและดำเนินงานตามข้อตกลงกับคุณเท่านั้น ภายใต้ขอบเขตที่กฎหมายอนุญาต เราไม่รับงานที่ต้องใช้ข้อมูลซึ่งได้รับความคุ้มครอง เช่น ข้อมูลธนาคาร ข้อมูลโทรศัพท์ หรือข้อมูลราชการของผู้อื่น และเราแจ้งคุณตั้งแต่ขั้นประเมินหากคำขอเกินขอบเขตนั้น"],
      },
      {
        heading: "ระยะเวลาเก็บรักษา",
        body: ["ข้อมูลการติดต่อที่ไม่ได้นำไปสู่การว่าจ้าง จะถูกทบทวนและลบตามรอบ 12 เดือนหลังปิดเรื่อง หรือเร็วกว่านั้นเมื่อคุณร้องขอ ข้อมูลของลูกค้าที่ว่าจ้างจะเก็บตามข้อตกลงและภาระหน้าที่ตามกฎหมาย ข้อมูลวิเคราะห์เว็บไซต์เก็บตามรอบมาตรฐานของ Google Analytics"],
      },
      {
        heading: "ผู้ให้บริการที่ประมวลผลข้อมูลแทนเรา",
        body: ["เราแบ่งปันข้อมูลเฉพาะกับผู้ให้บริการที่ประมวลผลตามคำสั่งของเราเท่านั้น"],
        bullets: [
          "Supabase — ฐานข้อมูลและพื้นที่จัดเก็บ",
          "Vercel — โฮสต์เว็บไซต์",
          "Upstash — จำกัดอัตราการส่งเพื่อป้องกันสแปม (ประมวลผลหมายเลข IP ชั่วคราว)",
          "Sentry — บันทึกข้อผิดพลาดของระบบเพื่อแก้ไขปัญหา",
          "Anthropic — ประมวลผลข้อความในผู้ช่วย AI รับเคส",
          "Google — Tag Manager, Analytics และ Ads สำหรับการวัดผล",
          "LINE — แจ้งเตือนทีมงานภายในเมื่อมีการติดต่อใหม่ (ชื่อและเบอร์ที่คุณให้ไว้) และเมื่อคุณเลือกทักเราทาง LINE",
          "Meta (WhatsApp / Facebook), Tencent (WeChat) — เมื่อคุณเลือกทักเราผ่านช่องทางเหล่านั้น",
        ],
      },
      {
        heading: "การส่งข้อมูลไปต่างประเทศ",
        body: ["ผู้ให้บริการบางรายข้างต้นประมวลผลข้อมูลนอกประเทศไทย เราเลือกผู้ให้บริการที่มีมาตรการคุ้มครองข้อมูลตามมาตรฐานสากล และส่งเฉพาะข้อมูลที่จำเป็นต่อวัตถุประสงค์ข้างต้น"],
      },
      {
        heading: "คุกกี้",
        body: ["เว็บไซต์ใช้คุกกี้ที่จำเป็นต่อการทำงาน และคุกกี้วิเคราะห์/โฆษณาของ Google ซึ่งโหลดหลังจากหน้าแสดงผลแล้ว คุณสามารถบล็อกคุกกี้ผ่านการตั้งค่าเบราว์เซอร์ได้ โดยเว็บไซต์ยังใช้งานได้ตามปกติ"],
      },
      {
        heading: "สิทธิของคุณ",
        body: ["คุณมีสิทธิขอเข้าถึง ขอสำเนา ขอแก้ไข ขอลบ ขอระงับการใช้ คัดค้านการประมวลผล และถอนความยินยอมได้ทุกเมื่อ โดยไม่กระทบการประมวลผลที่ทำไปก่อนหน้า ส่งคำขอมาที่อีเมลด้านล่าง เราจะตอบกลับภายใน 30 วัน และคุณมีสิทธิร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)"],
      },
      {
        heading: "ผู้เยาว์",
        body: ["บริการของเราสำหรับผู้ที่มีอายุ 18 ปีขึ้นไป เราไม่เจตนาเก็บข้อมูลจากผู้เยาว์ผ่านเว็บไซต์"],
      },
      {
        heading: "การเปลี่ยนแปลงประกาศนี้",
        body: ["เมื่อมีการเปลี่ยนแปลงที่สำคัญ เราจะปรับวันที่ \"ปรับปรุงล่าสุด\" ด้านบน และแจ้งในหน้านี้"],
      },
    ],
    contactLabel: "ติดต่อเรื่องข้อมูลส่วนบุคคล",
  },
  en: {
    lang: "en",
    path: PRIVACY_PATH.en,
    title: "Privacy Notice — Detective Pulse Website",
    description: "What detectivepulse.com collects, why, how long it is kept, and your PDPA rights when you contact us by form, LINE, WhatsApp or the AI assistant.",
    h1: "Privacy Notice (Website)",
    updatedLabel: "Last updated",
    intro: `${controller("en")} ("we") is the data controller for personal data collected through detectivepulse.com. This notice explains what we collect when you visit the site, submit a form, chat with the AI intake assistant or message us on LINE / WhatsApp, why we use it, how long we keep it, and your rights under Thailand's Personal Data Protection Act B.E. 2562 (PDPA).`,
    sections: [
      {
        heading: "What we collect",
        body: [],
        bullets: [
          "Contact form: your name or nickname, phone number or LINE ID, email (if given), the type of matter and any message you write, plus your browser user agent and IP address used for spam protection",
          "AI intake assistant: the messages you type in the chat window and the case summary the assistant produces when you ask to be contacted. The raw conversation is not stored permanently",
          "External chat channels: when you message us on LINE, WhatsApp, WeChat or Facebook, those messages are also subject to that provider's policy",
          "Attribution: campaign parameters (utm, gclid, fbclid), the page you were on before contacting us and the referring site, so we know which channels work",
          "Website usage: cookies and identifiers set by Google Tag Manager / Google Analytics / Google Ads recording pages viewed, device and contact-click events, without directly identifying you",
        ],
      },
      {
        heading: "Why we use it and on what legal basis",
        body: [],
        bullets: [
          "To answer your enquiry, assess feasibility and quote — your consent given when submitting the form, and steps taken at your request before a contract",
          "To measure marketing and improve the site — our legitimate interest, using aggregated and pseudonymous data where possible",
          "To prevent spam and abuse (rate limiting, bot-trap fields) — our legitimate interest",
          "We do not sell personal data and do not use what you send us to advertise to other people",
        ],
      },
      {
        heading: "Information about other people that you provide",
        body: ["Information about a person you ask us to investigate is used only to assess and carry out the engagement agreed with you, within what the law allows. We do not take on work that requires protected data such as another person's bank, telephone or government records, and we tell you at the assessment stage if a request goes beyond that scope."],
      },
      {
        heading: "How long we keep it",
        body: ["Enquiries that do not lead to an engagement are reviewed and deleted on a 12-month cycle after being closed, or earlier on request. Client data is kept according to the engagement and our legal obligations. Website analytics data follows Google Analytics' standard retention."],
      },
      {
        heading: "Service providers acting on our behalf",
        body: ["We share data only with providers that process it on our instructions."],
        bullets: [
          "Supabase — database and storage",
          "Vercel — website hosting",
          "Upstash — rate limiting for spam protection (IP addresses, transiently)",
          "Sentry — error logging so we can fix faults",
          "Anthropic — processing of AI intake assistant messages",
          "Google — Tag Manager, Analytics and Ads for measurement",
          "LINE — internal notification to our team of a new enquiry (the name and number you gave), and when you choose to message us on LINE",
          "Meta (WhatsApp / Facebook), Tencent (WeChat) — when you choose to message us on those channels",
        ],
      },
      {
        heading: "International transfers",
        body: ["Some providers above process data outside Thailand. We choose providers with internationally recognised data-protection safeguards and send only what the purposes above require."],
      },
      {
        heading: "Cookies",
        body: ["The site uses cookies needed for it to work and Google analytics/advertising cookies, which load after the page has rendered. You can block cookies in your browser settings; the site keeps working."],
      },
      {
        heading: "Your rights",
        body: ["You may request access, a copy, correction, deletion, restriction, object to processing, and withdraw consent at any time without affecting processing already carried out. Send requests to the email below; we respond within 30 days. You may also lodge a complaint with Thailand's Personal Data Protection Committee (PDPC)."],
      },
      {
        heading: "Children",
        body: ["Our services are for people aged 18 and over. We do not knowingly collect data from minors through this website."],
      },
      {
        heading: "Changes to this notice",
        body: ["When we make a material change we update the \"last updated\" date above and note it on this page."],
      },
    ],
    contactLabel: "Privacy contact",
  },
  zh: {
    lang: "zh",
    path: PRIVACY_PATH.zh,
    title: "隐私声明 — Detective Pulse 网站",
    description: "detectivepulse.com 收集哪些信息、用途、保存期限，以及您在泰国 PDPA 下的权利——适用于表单、LINE、WhatsApp、微信及 AI 助理咨询。",
    h1: "隐私声明（网站）",
    updatedLabel: "最后更新",
    intro: `${controller("zh")}（"我们"）是通过 detectivepulse.com 收集的个人数据的控制者。本声明说明您访问网站、提交表单、与 AI 接案助理对话或通过 LINE / WhatsApp / 微信联系我们时，我们收集哪些信息、用途、保存期限，以及您在泰国《个人数据保护法》（PDPA，B.E. 2562）下的权利。`,
    sections: [
      {
        heading: "我们收集的信息",
        body: [],
        bullets: [
          "联系表单：姓名或昵称、电话或 LINE / 微信 ID、邮箱（如提供）、事项类型及您填写的内容，以及用于防垃圾信息的浏览器 user agent 与 IP 地址",
          "AI 接案助理：您在聊天窗口输入的内容，以及您要求回访时助理生成的案件摘要。原始对话不会永久保存",
          "外部聊天渠道：您通过 LINE、WhatsApp、微信或 Facebook 联系我们时，这些消息同时受该平台隐私政策约束",
          "来源信息：推广参数（utm、gclid、fbclid）、联系前浏览的页面及来源网站，用于了解哪些渠道有效",
          "网站使用数据：Google Tag Manager / Google Analytics / Google Ads 设置的 Cookie 与标识符，记录浏览页面、设备和联系点击事件，不直接识别您的身份",
        ],
      },
      {
        heading: "用途与法律依据",
        body: [],
        bullets: [
          "回复咨询、评估可行性并报价——基于您提交表单时给予的同意，以及应您请求在签约前采取的步骤",
          "衡量推广效果并改进网站——基于我们的正当利益，尽可能使用汇总和匿名化数据",
          "防止垃圾信息与滥用（频率限制、反机器人字段）——基于我们的正当利益",
          "我们不出售个人数据，也不会将您提供的信息用于向他人投放广告",
        ],
      },
      {
        heading: "您提供的有关他人的信息",
        body: ["您委托我们调查的对象的信息，仅用于在法律允许的范围内评估和执行与您约定的委托。我们不承接需要使用受保护数据的工作，例如他人的银行、电话或政府记录；如请求超出该范围，我们会在评估阶段告知您。"],
      },
      {
        heading: "保存期限",
        body: ["未形成委托的咨询在结案后按 12 个月周期复核并删除，或应您要求提前删除。客户数据按委托约定及法律义务保存。网站分析数据遵循 Google Analytics 的标准保留期。"],
      },
      {
        heading: "代我们处理数据的服务商",
        body: ["我们仅与按照我们指示处理数据的服务商共享信息。"],
        bullets: [
          "Supabase——数据库与存储",
          "Vercel——网站托管",
          "Upstash——防垃圾信息的频率限制（临时处理 IP 地址）",
          "Sentry——系统错误日志，用于排查故障",
          "Anthropic——处理 AI 接案助理的消息",
          "Google——Tag Manager、Analytics 与 Ads，用于效果衡量",
          "LINE——新咨询的内部团队通知（您提供的姓名与电话），以及您选择通过 LINE 联系我们时",
          "Meta（WhatsApp / Facebook）、腾讯（微信）——当您选择通过这些渠道联系我们时",
        ],
      },
      {
        heading: "跨境传输",
        body: ["上述部分服务商在泰国境外处理数据。我们选择具备国际公认数据保护措施的服务商，并仅传输实现上述目的所需的信息。"],
      },
      {
        heading: "Cookie",
        body: ["网站使用运行所必需的 Cookie 以及 Google 的分析/广告 Cookie（在页面渲染后加载）。您可在浏览器设置中阻止 Cookie，网站仍可正常使用。"],
      },
      {
        heading: "您的权利",
        body: ["您可随时要求访问、获取副本、更正、删除、限制处理、反对处理及撤回同意，且不影响此前已进行的处理。请发送至下方邮箱，我们将在 30 天内答复。您也可向泰国个人数据保护委员会（PDPC）投诉。"],
      },
      {
        heading: "未成年人",
        body: ["我们的服务面向 18 岁及以上人士。我们不会有意通过本网站收集未成年人的数据。"],
      },
      {
        heading: "本声明的变更",
        body: ["发生重大变更时，我们会更新上方的\"最后更新\"日期并在本页注明。"],
      },
    ],
    contactLabel: "个人数据事宜联系",
  },
};

export function getPrivacyNotice(lang: PrivacyLang): PrivacyNotice {
  return PRIVACY_NOTICES[lang];
}

export const PRIVACY_CONTACT_EMAIL = EMAIL;
