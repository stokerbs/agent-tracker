import { NextResponse, type NextRequest } from "next/server";
import { finishPendingHookMotions } from "@/lib/studio/media/motion";
import { reportError } from "@/lib/errors";

// Every 5 minutes: finish the motion-hook clips Veo has rendered (docs §17). Generation takes minutes, which is
// longer than a function may run, so the action that starts it only stores the operation name — this sweep
// downloads the result and flips the asset to ready.
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
    const res = await finishPendingHookMotions();
    if (res.checked) console.info(`[cron:studio-motion-hook] checked=${res.checked} ready=${res.ready} failed=${res.failed} pending=${res.pending}`);
    return NextResponse.json({ ok: res.errors.length === 0, ...res });
  } catch (e) {
    reportError(e, "cron:studio-motion-hook");
    console.error("[cron:studio-motion-hook] threw:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "motion_hook_sweep_failed" }, { status: 500 });
  }
}
