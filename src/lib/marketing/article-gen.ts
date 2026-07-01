import "server-only";

import { classifyArticle } from "@/lib/marketing/article-category";

const MODEL = process.env.MARKETING_AI_MODEL ?? "claude-haiku-4-5-20251001";

// Curated pool of Thai private-investigation SEO topics. The cron picks one not
// recently used (see the route) so articles stay varied.
export const TOPIC_POOL: string[] = [
  "สัญญาณเตือนว่าคู่รักอาจนอกใจ และควรทำอย่างไร",
  "วิธีเลือกนักสืบเอกชนที่ไว้ใจได้ ไม่โดนหลอก",
  "หลักฐานแบบไหนใช้ได้ในชั้นศาลคดีชู้สาว",
  "ขั้นตอนการสืบทรัพย์สินก่อนฟ้องหรือบังคับคดี",
  "โดนโกงออนไลน์ต้องทำอย่างไร ตามเงินคืนได้ไหม",
  "วิธีตรวจสอบประวัติบุคคลก่อนร่วมธุรกิจหรือรับเข้าทำงาน",
  "ตามหาคนหาย ญาติพลัดพราก เริ่มต้นอย่างไร",
  "นักสืบไอที: สืบข้อมูลบนโซเชียลและโลกออนไลน์ทำได้แค่ไหน",
  "ค่าจ้างนักสืบคิดอย่างไร ปัจจัยที่มีผลต่อราคา",
  "ความลับของลูกค้ากับจรรยาบรรณของนักสืบเอกชน",
  "สืบพฤติกรรมพนักงานทุจริตในองค์กรอย่างถูกต้อง",
  "ติดตามลูกหนี้ที่หลบหนี ทำอย่างไรให้ได้ผล",
  "เช็คก่อนแต่ง: ตรวจสอบว่าที่คู่ครองก่อนตัดสินใจ",
  "รวมคำถามที่พบบ่อยก่อนจ้างนักสืบเอกชน",
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

const SYSTEM = `You are an expert Thai SEO content writer for "Detective Pulse", a professional private-investigation firm in Thailand. Write a genuinely helpful, accurate blog article on the given topic, then an English version.

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

/** Generate one bilingual article from a topic via Claude. Throws on failure. */
export async function generateArticle(topic: string): Promise<GeneratedArticle> {
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
        messages: [{ role: "user", content: `หัวข้อบทความ: ${topic}` }],
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

  const coverCategory = classifyArticle(`${topic} ${input.th_title}`).key;
  return {
    topic,
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
