import "server-only";

import crypto from "node:crypto";
import { generateArticle } from "@/lib/marketing/article-gen";
import { pickSeed } from "@/lib/marketing/article-selection";
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
  // Topic policy lives in article-selection.ts: the Chinese 30-topic plan gets
  // two of every three runs during the China push, the proven Thai keyword
  // list the third, each falling back to the other when exhausted.
  const { topics, slugs } = await getUsedTopicsAndSlugs();
  const seed = pickSeed(topics, topics.size);

  const article = await generateArticle(seed);

  // Avoid slug collisions with earlier AI articles.
  let n = 1;
  while (slugs.has(article.thSlug) || slugs.has(article.enSlug) || slugs.has(article.zhSlug)) {
    n += 1;
    article.thSlug = `${article.thSlug}-${n}`;
    article.enSlug = `${article.enSlug}-${n}`;
    article.zhSlug = `${article.zhSlug}-${n}`;
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

  return { id: draft?.id ?? "", reviewUrl, title: article.thTitle, topic: seed.th };
}
