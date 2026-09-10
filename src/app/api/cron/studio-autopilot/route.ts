import { NextResponse, type NextRequest } from "next/server";
import { runAutopilot } from "@/lib/studio/autopilot/run";
import { reportError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";

// Daily (02:10 Asia/Bangkok): produce one finished post end-to-end when the
// autopilot is enabled and today is one of its days — idea → script → plan →
// images → template video → privacy check → approve → publish (docs §16).
// Auth: fail-closed CRON_SECRET bearer (same as the other /api/cron routes).

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAutopilot({ userId: null, trigger: "cron" });
    // A skip that means "a previous run is stuck" must be visible; routine skips (off-day, cap) are not audited.
    if (result.status !== "skipped" || result.stopReason === "already_running") {
      await logAudit({
        actorId: null,
        action: "STUDIO_AUTOPILOT_RUN",
        entity: "studio_autopilot_runs",
        entityId: result.runId,
        metadata: { status: result.status, master_id: result.masterId ?? null, stop_reason: result.stopReason ?? null, posts: result.posts ?? 0 },
      });
    }
    return NextResponse.json(result, { status: result.ok || result.status === "review" ? 200 : 500 });
  } catch (e) {
    reportError(e, "cron:studio-autopilot");
    console.error("[cron:studio-autopilot] threw:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "autopilot_failed" }, { status: 500 });
  }
}
