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
  /** Short angle to steer the article. */
  angle: string;
}

export const KEYWORD_TOPICS: KeywordTopic[] = [
  { th: "นักสืบไอที", en: "cyber private investigator", angle: "สืบข้อมูลบนโซเชียล/ออนไลน์/ดิจิทัล ทำได้แค่ไหนอย่างถูกกฎหมาย" },
  { th: "จ้างนักสืบตามหาคน", en: "find a missing person investigator", angle: "ตามหาคนหาย ญาติพลัดพราก ลูกหนี้หลบหนี ตามหาคนโกง" },
  { th: "รับสืบประวัติ", en: "background check investigator", angle: "ตรวจสอบประวัติบุคคลก่อนร่วมงาน คบหา หรือทำธุรกิจ" },
  { th: "นักสืบชู้สาว", en: "infidelity private investigator", angle: "จับผิดคู่รัก เก็บหลักฐานเพื่อใช้ในชั้นศาล" },
  { th: "จ้างนักสืบตามแฟน", en: "track a cheating partner", angle: "ติดตามพฤติกรรมแฟนหรือคู่สมรสที่สงสัย" },
  { th: "นักสืบกรุงเทพ", en: "private detective bangkok", angle: "บริการนักสืบเอกชนในกรุงเทพฯ" },
  { th: "นักสืบพัทยา", en: "private detective pattaya", angle: "บริการนักสืบเอกชนในพัทยา" },
  { th: "นักสืบเชียงใหม่", en: "private investigator chiang mai", angle: "บริการนักสืบเอกชนในเชียงใหม่" },
  { th: "สืบทรัพย์สิน", en: "asset search investigator", angle: "ตรวจสอบทรัพย์สินลูกหนี้ก่อนฟ้องหรือบังคับคดี" },
  { th: "บริการนักสืบ", en: "private investigation services", angle: "งานสืบเอกชนครบวงจร มีบริการอะไรบ้าง" },
  { th: "บริษัทนักสืบ", en: "private detective agency", angle: "วิธีเลือกบริษัทนักสืบที่น่าเชื่อถือ" },
  { th: "นักสืบติดตามบุคคล", en: "personal surveillance investigator", angle: "การติดตามและเฝ้าสังเกตบุคคลเป้าหมาย" },
  { th: "ค่าจ้างนักสืบ", en: "private investigator cost", angle: "ปัจจัยที่มีผลต่อราคางานสืบ และการชำระเงิน" },
  { th: "หานักสืบมืออาชีพ", en: "how to hire a private investigator", angle: "วิธีเลือกนักสืบที่ไว้ใจได้ ไม่โดนหลอก" },
  { th: "ตามหาคนโกงออนไลน์", en: "online scam / fraud investigator", angle: "โดนโกงออนไลน์ ตามหาคนโกง มีโอกาสตามเงินคืนไหม" },
  { th: "นักสืบเอกชนทั่วไทย", en: "private investigator thailand", angle: "บริการสืบทั่วราชอาณาจักร ครอบคลุมพื้นที่ใดบ้าง" },
  { th: "สำนักงานนักสืบ", en: "private investigator office", angle: "นักสืบเอกชนทำงานอย่างไร (ฟรีแลนซ์ ไม่มีสำนักงานประจำ)" },
  { th: "เช็คประวัติก่อนแต่งงาน", en: "pre-marriage background check", angle: "ตรวจสอบว่าที่คู่ครองก่อนตัดสินใจแต่งงาน" },
];

export interface GeneratedArticle {
  topic: string;
  thTitle: string;
  thDescription: string;
  thBody: string;
  enTitle: string;
  enDescription: string;
  enBody: string;
  thSlug: string;
  enSlug: string;
  coverCategory: string;
  model: string;
}

const SYSTEM = `You are an expert Thai SEO content writer for "Detective Pulse", a professional private-investigation firm in Thailand. You are given a TARGET KEYWORD (Thai + English) that the firm actually advertises on, plus an angle. Write a genuinely helpful, accurate blog article that ranks for it — a Thai version and an English version.

SEO KEYWORD TARGETING:
- Weave the THAI keyword naturally into the Thai title, the first paragraph, at least one H2 heading, and the Thai meta description.
- Weave the ENGLISH keyword the same way into the English title, first paragraph, an H2, and the English meta description.
- Natural placement only — NO keyword stuffing, no awkward repetition.

RULES:
- Natural, warm, professional Thai (and natural English for the EN version) — write for real prospective clients, not keyword stuffing.
- 500–800 words each. Use Markdown with H2 (##) / H3 (###) headings, short paragraphs, and a bullet list where useful.
- End with a short, soft call-to-action to consult Detective Pulse (LINE @detectivepluse / phone 096-846-1406) — one line, not pushy.
- Do NOT invent statistics, case numbers, prices, or legal citations. For legal questions, suggest consulting a lawyer.
- Do NOT guarantee investigation outcomes, and do NOT describe illegal or unethical methods (hacking, illegal tracking, impersonation). Keep everything within the law.
- The meta description must be a single plain sentence, 120–155 characters, no Markdown.
- Titles: compelling but honest, ≤60 characters, include "| Detective Pulse" is NOT needed (the template adds branding).
- Provide URL slugs: en_slug in lowercase kebab-case (a–z, 0–9, hyphens); th_slug a short Thai slug (concise, no spaces — use hyphens between words if needed).

Call the save_article tool exactly once with the finished content.`;

const ARTICLE_TOOL = {
  name: "save_article",
  description: "บันทึกบทความที่เขียนเสร็จ (ทั้งภาษาไทยและอังกฤษ) เรียกครั้งเดียว",
  input_schema: {
    type: "object" as const,
    properties: {
      th_title: { type: "string" },
      th_description: { type: "string" },
      th_body: { type: "string", description: "เนื้อหาบทความภาษาไทย (Markdown)" },
      en_title: { type: "string" },
      en_description: { type: "string" },
      en_body: { type: "string", description: "English article body (Markdown)" },
      th_slug: { type: "string" },
      en_slug: { type: "string" },
    },
    required: ["th_title", "th_description", "th_body", "en_title", "en_description", "en_body", "th_slug", "en_slug"],
  },
};

/** Kebab-case a Latin slug; keep Thai as-is (Thai slugs are valid in URLs). */
export function sanitizeSlug(raw: string, lang: "th" | "en"): string {
  const s = raw.trim().toLowerCase();
  if (lang === "en") {
    return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "article";
  }
  // Thai: strip whitespace/quotes/slashes, keep Thai + digits + hyphen.
  return raw.trim().replace(/\s+/g, "-").replace(/["'`/\\?#]+/g, "").slice(0, 80) || "บทความ";
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
        max_tokens: 4000,
        system: SYSTEM,
        tools: [ARTICLE_TOOL],
        tool_choice: { type: "tool", name: "save_article" },
        messages: [
          {
            role: "user",
            content:
              `TARGET KEYWORD (Thai): ${seed.th}\n` +
              `TARGET KEYWORD (English): ${seed.en}\n` +
              `ANGLE: ${seed.angle}\n\n` +
              `Write the bilingual article and call save_article.`,
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
  if (!input?.th_title || !input.th_body || !input.en_title || !input.en_body) {
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
    thSlug: sanitizeSlug(input.th_slug, "th"),
    enSlug: sanitizeSlug(input.en_slug, "en"),
    coverCategory,
    model: MODEL,
  };
}
