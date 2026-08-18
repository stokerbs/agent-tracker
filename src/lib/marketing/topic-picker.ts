import { KEYWORD_TOPICS, type KeywordTopic, type TopicCategory } from "@/lib/marketing/article-gen";

/**
 * Picks WHAT the next AI article is about and WHAT SHAPE it takes.
 *
 * Two dials keep the blog from circling the same ground:
 *  1. Topic — the first keyword never used, but skipped ahead when the last few
 *     articles already came from that category (no five location pages in a row).
 *  2. Format — the article's structure (guide, checklist, FAQ, cost breakdown …),
 *     rotated so consecutive articles don't share an outline. Once every keyword
 *     has an article, a keyword can come back with a format it hasn't had yet,
 *     which is a genuinely different piece rather than a rewrite.
 *
 * The chosen pair is stored in `marketing_articles.topic` as the dedupe key:
 * `"<keyword>"` on the first pass, `"<keyword> · <format>"` on later ones.
 */

export interface ArticleFormat {
  /** Stable id — half of the stored dedupe key, so never rename a shipped one. */
  key: string;
  th: string;
  en: string;
  /** Structural brief handed to the model. */
  brief: string;
}

/** Article shapes, rotated in order. Append only — keys are persisted. */
export const ARTICLE_FORMATS: ArticleFormat[] = [
  {
    key: "guide",
    th: "คู่มือฉบับเข้าใจง่าย",
    en: "Practical guide",
    brief:
      "A practical walkthrough: what the situation is, what can and cannot be done about it, and the sequence to follow. H2s are stages of the process, in order.",
  },
  {
    key: "checklist",
    th: "เช็คลิสต์ก่อนตัดสินใจ",
    en: "Decision checklist",
    brief:
      "A checklist the reader can act on. Most of the body is checkable items grouped under 2–3 H2s, each item one line of what to do plus one line of why it matters.",
  },
  {
    key: "faq",
    th: "รวมคำถามที่พบบ่อย",
    en: "Q&A / FAQ",
    brief:
      "6–8 real questions a worried client asks, each as its own H2 phrased as the question, answered in 2–4 short paragraphs. No long preamble.",
  },
  {
    key: "cost",
    th: "แจกแจงค่าใช้จ่าย",
    en: "Cost breakdown",
    brief:
      "What actually drives the price of this kind of work — scope, duration, travel, number of operatives, evidence format — and how to brief the job so the quote is accurate. Explain the drivers; never invent figures or a price list.",
  },
  {
    key: "mistakes",
    th: "ข้อผิดพลาดที่พบบ่อย",
    en: "Common mistakes",
    brief:
      "The mistakes people make in this situation, one per H2, each with what goes wrong and what to do instead. Concrete, not scolding.",
  },
  {
    key: "first-steps",
    th: "ทำอะไรก่อนใน 24–48 ชั่วโมงแรก",
    en: "First 24–48 hours",
    brief:
      "An urgency-first piece: what to do immediately, what to stop doing, what evidence disappears fastest, and when to bring in a professional. Ordered by time, not by theme.",
  },
  {
    key: "legal-limits",
    th: "ขอบเขตทางกฎหมาย",
    en: "What the law allows",
    brief:
      "Where the legal line sits for this topic: what a licensed professional may do, what nobody may do, and what only a court order or the police can obtain. State clearly that this is general information and a lawyer should be consulted; cite no statute numbers.",
  },
  {
    key: "comparison",
    th: "เปรียบเทียบทางเลือก",
    en: "Options compared",
    brief:
      "Compare the realistic routes (do it yourself, go to the police, hire a professional, do nothing yet) on cost, time, risk and what evidence each produces. Balanced — say plainly when hiring an investigator is NOT the right call.",
  },
  {
    key: "scenario",
    th: "ตัวอย่างสถานการณ์",
    en: "Worked scenario",
    brief:
      "One illustrative scenario, explicitly labelled as a made-up example, followed from first worry to outcome — showing what information mattered at each step. Invent no real cases, names, or firm statistics.",
  },
  {
    key: "myths",
    th: "ความเชื่อผิด ๆ กับความจริง",
    en: "Myths vs reality",
    brief:
      "5–6 widely believed claims about this topic, each as an H2 stating the myth, then the reality in plain language. Correct the movie-detective picture with how the work is really done.",
  },
];

/** Separator between keyword and format in the stored dedupe key. */
const KEY_SEP = " · ";

/** Split a stored `topic` value back into its keyword and (optional) format. */
export function parseTopicKey(key: string): { base: string; format: string | null } {
  const i = key.indexOf(KEY_SEP);
  if (i === -1) return { base: key, format: null };
  return { base: key.slice(0, i), format: key.slice(i + KEY_SEP.length) || null };
}

/** Build the stored `topic` value for a keyword + format pair. */
export function buildTopicKey(keyword: string, formatKey?: string): string {
  return formatKey ? `${keyword}${KEY_SEP}${formatKey}` : keyword;
}

export interface TopicSelection {
  seed: KeywordTopic;
  format: ArticleFormat;
  /** Value to store in `marketing_articles.topic` — the dedupe key. */
  topicKey: string;
  /** True once every keyword has an article and we're revisiting with a new format. */
  isRevisit: boolean;
}

/** How many recent articles count as "too recent to repeat a category/format". */
const RECENT_WINDOW = 4;

/** Pick the format furthest from the recent ones, starting at a rotating offset. */
function pickFormat(offset: number, recentFormats: Set<string>): ArticleFormat {
  const n = ARTICLE_FORMATS.length;
  const start = ((offset % n) + n) % n;
  for (let i = 0; i < n; i += 1) {
    const f = ARTICLE_FORMATS[(start + i) % n]!;
    if (!recentFormats.has(f.key)) return f;
  }
  return ARTICLE_FORMATS[start]!;
}

/**
 * Choose the next article's keyword + format.
 *
 * @param usedKeys  every `topic` value already in the table (any status).
 * @param recentKeys the same values for the most recent articles, newest first.
 */
export function pickTopic(usedKeys: Iterable<string>, recentKeys: string[] = []): TopicSelection {
  const used = new Set(usedKeys);
  const parsed = [...used].map(parseTopicKey);
  const usedBases = new Set(parsed.map((p) => p.base));

  const byKeyword = new Map(KEYWORD_TOPICS.map((t) => [t.th, t]));
  const recent = recentKeys.slice(0, RECENT_WINDOW).map(parseTopicKey);
  const recentCategories = new Set(
    recent.map((r) => byKeyword.get(r.base)?.category).filter((c): c is TopicCategory => Boolean(c)),
  );
  const recentFormats = new Set(recent.map((r) => r.format).filter((f): f is string => Boolean(f)));

  const format = pickFormat(used.size, recentFormats);

  // First pass — every keyword gets its own article before any repeats.
  const fresh = KEYWORD_TOPICS.filter((t) => !usedBases.has(t.th));
  if (fresh.length > 0) {
    // Priority order still rules; we only skip ahead to dodge a category the
    // last few articles already used, and fall back to the top of the list.
    const seed = fresh.find((t) => !recentCategories.has(t.category)) ?? fresh[0]!;
    return { seed, format, topicKey: seed.th, isRevisit: false };
  }

  // Second pass — the whole pool is covered, so revisit keywords with a format
  // they have not had. Least-covered keyword first, then least recently written.
  const counts = new Map<string, number>();
  for (const p of parsed) counts.set(p.base, (counts.get(p.base) ?? 0) + 1);
  const lastSeen = new Map<string, number>();
  recentKeys.forEach((k, i) => {
    const { base } = parseTopicKey(k);
    if (!lastSeen.has(base)) lastSeen.set(base, i); // 0 = most recent
  });

  const candidates = [...KEYWORD_TOPICS].sort((a, b) => {
    const byCount = (counts.get(a.th) ?? 0) - (counts.get(b.th) ?? 0);
    if (byCount !== 0) return byCount;
    // Never written recently (undefined) sorts ahead of anything that was.
    return (lastSeen.get(b.th) ?? Number.MAX_SAFE_INTEGER) - (lastSeen.get(a.th) ?? Number.MAX_SAFE_INTEGER);
  });

  const start = ARTICLE_FORMATS.indexOf(format);
  for (const seed of candidates) {
    if (recentCategories.has(seed.category)) continue;
    for (let i = 0; i < ARTICLE_FORMATS.length; i += 1) {
      const f = ARTICLE_FORMATS[(start + i) % ARTICLE_FORMATS.length]!;
      const key = buildTopicKey(seed.th, f.key);
      if (!used.has(key)) return { seed, format: f, topicKey: key, isRevisit: true };
    }
  }
  // Category spacing left nothing — drop that constraint before giving up.
  for (const seed of candidates) {
    for (let i = 0; i < ARTICLE_FORMATS.length; i += 1) {
      const f = ARTICLE_FORMATS[(start + i) % ARTICLE_FORMATS.length]!;
      const key = buildTopicKey(seed.th, f.key);
      if (!used.has(key)) return { seed, format: f, topicKey: key, isRevisit: true };
    }
  }

  // Every keyword × format pair exists (86 × 10 articles in). Suffix a round
  // number so the key stays unique and generation never hard-fails.
  const seed = candidates[0]!;
  let round = 2;
  while (used.has(buildTopicKey(seed.th, `${format.key}-${round}`))) round += 1;
  return { seed, format, topicKey: buildTopicKey(seed.th, `${format.key}-${round}`), isRevisit: true };
}
