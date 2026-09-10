import { NextResponse, type NextRequest } from "next/server";
import { syncSocialPosts } from "@/lib/studio/publish/publish";
import { pushLineNotify } from "@/lib/line/notify";
import { reportError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";

// Every 30 min: reconcile queued/scheduled social posts with the aggregator
// (Ayrshare) — mark published (post url) / failed, flip masters to published,
// and ping the owner when a platform rejected a post.
// Auth: fail-closed CRON_SECRET bearer (same as the other /api/cron routes).

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.AYRSHARE_API_KEY) {
    // Feature not enabled yet — nothing to sync, and no error to alert on.
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }

  try {
    const result = await syncSocialPosts();
    if (result.checked > 0) {
      await logAudit({ actorId: null, action: "STUDIO_SOCIAL_SYNC", entity: "studio_social_posts", metadata: { trigger: "cron", ...result, errors: result.errors.length } });
    }
    if (result.failed > 0) {
      await pushLineNotify(`⚠️ Creative Studio: โพสต์โซเชียลล้มเหลว ${result.failed} รายการ\nดูรายละเอียดในหน้าคอนเทนต์ → ส่วน "โพสต์โซเชียล"\nhttps://detectivepulse.app/studio/content`);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    reportError(e, "cron:studio-social-sync");
    console.error("[cron:studio-social-sync] threw:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 500 });
  }
}
