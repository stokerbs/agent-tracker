import "server-only";

import { classifyArticle } from "@/lib/marketing/article-category";

const MODEL = process.env.MARKETING_AI_MODEL ?? "claude-haiku-4-5-20251001";

// Keyword pool seeded from Detective Pulse's real Google Ads search-keyword
// report — the terms that actually drove clicks/conversions. Each entry pairs a
// Thai + English target keyword with an article angle; the generator weaves the
// keyword naturally into each language version for SEO alignment with the ads.
// Ordered roughly by proven intent (highest-converting keywords first). The cron
// picks one not yet used (dedup by `th` keyword) so articles stay varied.
export interface KeywordTopic {
  /** Thai target keyword (also the stored `topic`, used for dedupe). */
  th: string;
  /** English target keyword for the EN version. */
  en: string;
  /** Chinese target keyword for the ZH version. */
  zh: string;
  /** Short angle to steer the article. */
  angle: string;
}

export const KEYWORD_TOPICS: KeywordTopic[] = [
  // Proven organic winners from the live Google Search Console query report
  // (3-month). These already earn impressions and sit just off page 1, so
  // fresh keyword-aligned articles have the best shot at pushing them up —
  // kept at the very top so the generator (priority order) targets them first.
  { th: "เช็คประวัติบุคคลจากชื่อนามสกุล", en: "background check by name", zh: "凭姓名背景调查", angle: "เช็คประวัติบุคคลจากแค่ชื่อ-นามสกุล ตรวจอะไรได้บ้าง เริ่มอย่างไร และขอบเขตทางกฎหมาย" },
  { th: "จ้างนักสืบออนไลน์", en: "hire a private investigator online", zh: "网上聘请私家侦探", angle: "จ้างนักสืบผ่านออนไลน์ ขั้นตอน ราคา และวิธีเลือกให้ปลอดภัยไม่โดนหลอก" },
  { th: "ตามหาคนจากชื่อ", en: "find someone by name", zh: "凭姓名寻人", angle: "ตามหาคนจากแค่ชื่อ-นามสกุล ทำได้แค่ไหน ต้องมีข้อมูลอะไรบ้าง" },
  { th: "นักสืบไอที", en: "cyber private investigator", zh: "网络侦探调查", angle: "สืบข้อมูลบนโซเชียล/ออนไลน์/ดิจิทัล ทำได้แค่ไหนอย่างถูกกฎหมาย" },
  { th: "จ้างนักสืบตามหาคน", en: "find a missing person investigator", zh: "泰国寻人调查", angle: "ตามหาคนหาย ญาติพลัดพราก ลูกหนี้หลบหนี ตามหาคนโกง" },
  { th: "รับสืบประวัติ", en: "background check investigator", zh: "背景调查服务", angle: "ตรวจสอบประวัติบุคคลก่อนร่วมงาน คบหา หรือทำธุรกิจ" },
  { th: "นักสืบชู้สาว", en: "infidelity private investigator", zh: "婚外情调查", angle: "จับผิดคู่รัก เก็บหลักฐานเพื่อใช้ในชั้นศาล" },
  { th: "จ้างนักสืบตามแฟน", en: "track a cheating partner", zh: "跟踪伴侣调查", angle: "ติดตามพฤติกรรมแฟนหรือคู่สมรสที่สงสัย" },
  { th: "นักสืบกรุงเทพ", en: "private detective bangkok", zh: "曼谷私家侦探", angle: "บริการนักสืบเอกชนในกรุงเทพฯ" },
  { th: "นักสืบพัทยา", en: "private detective pattaya", zh: "芭提雅私家侦探", angle: "บริการนักสืบเอกชนในพัทยา" },
  { th: "นักสืบเชียงใหม่", en: "private investigator chiang mai", zh: "清迈私家侦探", angle: "บริการนักสืบเอกชนในเชียงใหม่" },
  { th: "สืบทรัพย์สิน", en: "asset search investigator", zh: "财产调查", angle: "ตรวจสอบทรัพย์สินลูกหนี้ก่อนฟ้องหรือบังคับคดี" },
  { th: "บริการนักสืบ", en: "private investigation services", zh: "私家侦探服务", angle: "งานสืบเอกชนครบวงจร มีบริการอะไรบ้าง" },
  { th: "บริษัทนักสืบ", en: "private detective agency", zh: "侦探公司", angle: "วิธีเลือกบริษัทนักสืบที่น่าเชื่อถือ" },
  { th: "นักสืบติดตามบุคคล", en: "personal surveillance investigator", zh: "人员跟踪调查", angle: "การติดตามและเฝ้าสังเกตบุคคลเป้าหมาย" },
  { th: "ค่าจ้างนักสืบ", en: "private investigator cost", zh: "私家侦探费用", angle: "ปัจจัยที่มีผลต่อราคางานสืบ และการชำระเงิน" },
  { th: "หานักสืบมืออาชีพ", en: "how to hire a private investigator", zh: "如何聘请私家侦探", angle: "วิธีเลือกนักสืบที่ไว้ใจได้ ไม่โดนหลอก" },
  { th: "ตามหาคนโกงออนไลน์", en: "online scam / fraud investigator", zh: "网络诈骗调查", angle: "โดนโกงออนไลน์ ตามหาคนโกง มีโอกาสตามเงินคืนไหม" },
  { th: "นักสืบเอกชนทั่วไทย", en: "private investigator thailand", zh: "泰国私家侦探", angle: "บริการสืบทั่วราชอาณาจักร ครอบคลุมพื้นที่ใดบ้าง" },
  { th: "สำนักงานนักสืบ", en: "private investigator office", zh: "私家侦探事务所", angle: "นักสืบเอกชนทำงานอย่างไร (ฟรีแลนซ์ ไม่มีสำนักงานประจำ)" },
  { th: "เช็คประวัติก่อนแต่งงาน", en: "pre-marriage background check", zh: "婚前背景调查", angle: "ตรวจสอบว่าที่คู่ครองก่อนตัดสินใจแต่งงาน" },
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

/** Generate one bilingual, keyword-targeted article via Claude. Throws on failure. */
export async function generateArticle(seed: KeywordTopic): Promise<GeneratedArticle> {
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
              `ANGLE: ${seed.angle}\n\n` +
              `Write the article in all three languages and call save_article.`,
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
