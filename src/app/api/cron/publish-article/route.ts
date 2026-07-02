import { NextResponse, type NextRequest } from "next/server";
import { runArticleGeneration } from "@/lib/marketing/run-article-generation";
import { reportError } from "@/lib/errors";

// Scheduled (Vercel Cron, Tue & Fri) AI article generation.
//   cron → generate a bilingual article DRAFT → notify the owner on LINE with a
//   one-time review link → owner approves → it publishes.
// Nothing goes live automatically — the cron only creates a draft.
// Auth: fail-closed CRON_SECRET bearer (same as the other /api/cron routes).
// The generation itself is shared with the admin "generate now" button
// (see runArticleGeneration).

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, topic } = await runArticleGeneration();
    return NextResponse.json({ ok: true, id, topic });
  } catch (e) {
    reportError(e, "cron:publish-article");
    console.error("[cron:publish-article] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "generation_failed" }, { status: 500 });
  }
}
