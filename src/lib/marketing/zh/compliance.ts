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

export function findBannedPhrases(text: string): string[] {
  return ZH_BANNED_PHRASES.filter((p) => text.includes(p));
}
