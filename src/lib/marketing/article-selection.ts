import { KEYWORD_TOPICS, type KeywordTopic } from "@/lib/marketing/article-gen";
import { ZH_PLAN_ORDERED } from "@/lib/marketing/zh/topics";
import { CONTENT_CALENDAR } from "@/lib/marketing/content-calendar";

/**
 * Which topic the next article run should target. During the China push the
 * 30-topic Chinese plan gets two of every three runs (the cron fires Tue/Fri,
 * so ≈10 Chinese articles in 7–8 weeks; the admin "generate now" button can
 * accelerate), the Thai keyword list the third. Either list falls back to the
 * other once exhausted; when everything has been covered, a random topic keeps
 * the back-catalogue growing. Pure, so the policy is unit-tested.
 */
export function pickSeed(usedTopics: Set<string>, totalUsed: number, random: () => number = Math.random): KeywordTopic {
  const zhFresh = ZH_PLAN_ORDERED.filter((t) => !usedTopics.has(t.th));
  // Thai slot: the months 1–3 content calendar (audit Days 31–90) runs first.
  const thFresh = [...CONTENT_CALENDAR, ...KEYWORD_TOPICS].filter((t) => !usedTopics.has(t.th));
  const preferZh = totalUsed % 3 !== 2;
  const pick = preferZh ? (zhFresh[0] ?? thFresh[0]) : (thFresh[0] ?? zhFresh[0]);
  if (pick) return pick;
  const all = [...ZH_PLAN_ORDERED, ...CONTENT_CALENDAR, ...KEYWORD_TOPICS];
  return all[Math.floor(random() * all.length)]!;
}
