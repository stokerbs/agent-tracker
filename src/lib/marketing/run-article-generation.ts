import "server-only";

import crypto from "node:crypto";
import { generateArticle, ComplianceRejectedError } from "@/lib/marketing/article-gen";
import { pickSeed } from "@/lib/marketing/article-selection";
import { getUsedTopicsAndSlugs, insertDraft, insertComplianceTombstone } from "@/lib/marketing/articles-db";
import { reportError } from "@/lib/errors";
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

  let article;
  try {
    article = await generateArticle(seed);
  } catch (e) {
    // A twice-rejected Chinese draft marks its topic as used (tombstone) so
    // the next run picks the next topic instead of stalling on this one.
    if (e instanceof ComplianceRejectedError) {
      try {
        await insertComplianceTombstone(e.topic, e.violations, "compliance-filter");
      } catch (err) {
        reportError(err, "article:tombstone");
      }
    }
    throw e;
  }

  // Avoid slug collisions with earlier AI articles — suffix from the base
  // slugs (not cumulatively), so the third attempt is "slug-3", not "slug-2-3".
  const base = { th: article.thSlug, en: article.enSlug, zh: article.zhSlug };
  let n = 1;
  while (slugs.has(article.thSlug) || slugs.has(article.enSlug) || slugs.has(article.zhSlug)) {
    n += 1;
    article.thSlug = `${base.th}-${n}`;
    article.enSlug = `${base.en}-${n}`;
    article.zhSlug = `${base.zh}-${n}`;
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
