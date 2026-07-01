import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { generateArticle, TOPIC_POOL } from "@/lib/marketing/article-gen";
import { getUsedTopicsAndSlugs, insertDraft } from "@/lib/marketing/articles-db";
import { pushLineNotify } from "@/lib/line/notify";
import { notifyRole } from "@/lib/notifications";
import { reportError } from "@/lib/errors";

// Scheduled (Vercel Cron, Tue & Fri) AI article generation.
//   cron → generate a bilingual article DRAFT → notify the owner on LINE with a
//   one-time review link → owner approves → it publishes.
// Nothing goes live automatically — the cron only creates a draft.
// Auth: fail-closed CRON_SECRET bearer (same as the other /api/cron routes).

export const maxDuration = 120;

const SITE = "https://detectivepulse.com";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Pick a topic we haven't generated before (fall back to a random one if the
    // pool is exhausted, so the schedule never stalls).
    const { topics, slugs } = await getUsedTopicsAndSlugs();
    const fresh = TOPIC_POOL.filter((t) => !topics.has(t));
    const topic = (fresh.length ? fresh : TOPIC_POOL)[Math.floor(Math.random() * (fresh.length || TOPIC_POOL.length))]!;

    const article = await generateArticle(topic);

    // Guard against slug collisions with earlier AI articles (append a suffix).
    let n = 1;
    while (slugs.has(article.thSlug) || slugs.has(article.enSlug)) {
      n += 1;
      article.thSlug = `${article.thSlug}-${n}`;
      article.enSlug = `${article.enSlug}-${n}`;
    }

    const token = crypto.randomBytes(24).toString("base64url");
    const draft = await insertDraft(article, token);

    const reviewUrl = `${SITE}/review/${token}`;
    // Ping the owner (LINE + in-app) to review the new draft.
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

    return NextResponse.json({ ok: true, id: draft?.id, topic, thSlug: article.thSlug });
  } catch (e) {
    reportError(e, "cron:publish-article");
    console.error("[cron:publish-article] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "generation_failed" }, { status: 500 });
  }
}
