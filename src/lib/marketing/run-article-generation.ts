import "server-only";

import crypto from "node:crypto";
import { generateArticle } from "@/lib/marketing/article-gen";
import { pickTopic } from "@/lib/marketing/topic-picker";
import { getUsedTopicsAndSlugs, insertDraft } from "@/lib/marketing/articles-db";
import { pushLineNotify } from "@/lib/line/notify";
import { notifyRole } from "@/lib/notifications";

const SITE = "https://detectivepulse.com";

export interface GenerationResult {
  id: string;
  reviewUrl: string;
  title: string;
  topic: string;
}

/**
 * Generate one bilingual, keyword-targeted article DRAFT and notify the owner
 * (LINE + in-app) with a review link. Shared by the twice-weekly cron and the
 * admin "generate now" button. Never publishes — approval happens in /review.
 */
export async function runArticleGeneration(): Promise<GenerationResult> {
  // Pick the next keyword AND the shape of the article (see topic-picker):
  // highest-priority unused keyword, skipping ahead when the last few articles
  // came from the same category, with a rotating format so nothing reads like
  // the previous piece. The newest titles go into the prompt as "already
  // covered" so the model doesn't re-tell them.
  const { topics, slugs, recent = [] } = await getUsedTopicsAndSlugs();
  const { seed, format, topicKey, isRevisit } = pickTopic(
    topics,
    recent.map((r) => r.topic),
  );
  console.info(
    `[article-gen] seed="${seed.th}" category=${seed.category} format=${format.key} revisit=${isRevisit}`,
  );

  const article = await generateArticle(seed, {
    format,
    recentTitles: recent.map((r) => r.title),
  });
  // Store the picker's key (keyword, or "keyword · format" on a revisit) — it
  // is what dedupes future picks.
  article.topic = topicKey;

  // Avoid slug collisions with earlier AI articles.
  let n = 1;
  while (slugs.has(article.thSlug) || slugs.has(article.enSlug)) {
    n += 1;
    article.thSlug = `${article.thSlug}-${n}`;
    article.enSlug = `${article.enSlug}-${n}`;
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const draft = await insertDraft(article, token);
  const reviewUrl = `${SITE}/review/${token}`;

  await pushLineNotify(
    `📝 บทความใหม่ (ร่างโดย AI) รออนุมัติ\n\n${article.thTitle}\n\nกดรีวิว/อนุมัติ:\n${reviewUrl}`,
  );
  await notifyRole(["admin"], {
    type: "system",
    title: "บทความใหม่รออนุมัติ",
    body: article.thTitle,
    url: `/review/${token}`,
    priority: "normal",
  });

  return { id: draft?.id ?? "", reviewUrl, title: article.thTitle, topic: topicKey };
}
