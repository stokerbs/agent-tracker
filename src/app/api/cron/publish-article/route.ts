import { NextResponse, type NextRequest } from "next/server";

// Retired: article drafts now come from the owner's scheduled Codex task,
// using the ChatGPT plan and connected Supabase app. Keep this endpoint
// authenticated so stale cron invocations cannot call a paid provider.
// See docs/marketing/codex-article-drafts.md.

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "article_generation_moved",
      message: "Draft generation has moved to the owner's scheduled Codex task. Review saved drafts at /marketing-articles.",
    },
    { status: 410 },
  );
}
