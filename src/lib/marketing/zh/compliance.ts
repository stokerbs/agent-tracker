/**
 * Chinese-copy compliance guard. Phrases that would promise or imply unlawful
 * access to restricted data (phone/hotel/bank/immigration records, phone
 * tracking, hacking). Used by the registry test (static copy) and by the AI
 * article generator (generated copy) — a draft containing any of these is
 * rewritten once and otherwise rejected, so nothing reaches the review queue.
 */
export const ZH_BANNED_PHRASES = [
  "开房记录",
  "通话记录",
  "手机定位",
  "银行流水",
  "查身份证",
  "监听",
  "黑客",
  "出入境记录查询",
  "数据库查询",
  "查酒店记录",
  "定位他人",
  "窃听",
] as const;

/** Traditional-script spellings of the same phrases (matched after normalisation). */
const TRADITIONAL_VARIANTS: Record<string, string> = {
  "開房記錄": "开房记录", "通話記錄": "通话记录", "銀行流水": "银行流水", "查身份證": "查身份证",
  "監聽": "监听", "黑客": "黑客", "出入境記錄查詢": "出入境记录查询", "數據庫查詢": "数据库查询",
  "查酒店記錄": "查酒店记录", "竊聽": "窃听",
};

/** Strip whitespace and punctuation so "开 房 · 记录" still matches. */
const normalise = (t: string) => t.replace(/[\s\p{P}\p{S}]/gu, "");

/**
 * A phrase inside a refusal is lawful copy ("我们不提供开房记录", "任何机构都无法获取通话记录").
 * We look back a short window for a negation / prohibition marker; only an
 * un-negated mention counts. The window is 12 normalised characters — enough
 * for "没有任何合法机构能够查" without reaching back into a previous clause.
 */
const NEGATION = /(不|无法|无|没有|没法|不能|不会|不提供|不做|不可能|非法|违法|禁止|拒绝|无权|并非|绝不|严禁|杜绝)/;
const LOOKBACK = 12;

function unNegatedMention(normalised: string, phrase: string): boolean {
  let from = 0;
  while (true) {
    const i = normalised.indexOf(phrase, from);
    if (i === -1) return false;
    const before = normalised.slice(Math.max(0, i - LOOKBACK), i);
    if (!NEGATION.test(before)) return true;
    from = i + phrase.length;
  }
}

export function findBannedPhrases(text: string): string[] {
  const n = normalise(text);
  const hits = new Set<string>();
  for (const p of ZH_BANNED_PHRASES) if (unNegatedMention(n, p)) hits.add(p);
  for (const [trad, simp] of Object.entries(TRADITIONAL_VARIANTS)) if (unNegatedMention(n, trad)) hits.add(simp);
  return ZH_BANNED_PHRASES.filter((p) => hits.has(p));
}
