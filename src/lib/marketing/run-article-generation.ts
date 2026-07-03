import "server-only";

import crypto from "node:crypto";
import { generateArticle, KEYWORD_TOPICS } from "@/lib/marketing/article-gen";
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
  // Pick the highest-priority keyword topic not generated before. KEYWORD_TOPICS
  // is ordered by proven intent (real Google Search Console winners first), so
  // take the first unused rather than a random one — that way the near-page-1
  // keywords get their article next. Fall back to random only once every topic
  // has been covered, to keep the back-catalogue varied.
  const { topics, slugs } = await getUsedTopicsAndSlugs();
  const fresh = KEYWORD_TOPICS.filter((t) => !topics.has(t.th));
  const seed = fresh.length
    ? fresh[0]!
    : KEYWORD_TOPICS[Math.floor(Math.random() * KEYWORD_TOPICS.length)]!;

  const article = await generateArticle(seed);

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

  return { id: draft?.id ?? "", reviewUrl, title: article.thTitle, topic: seed.th };
}
