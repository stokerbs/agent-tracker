import { NextResponse, type NextRequest } from "next/server";
import { publishPendingAutopilotRuns } from "@/lib/studio/autopilot/publish-pending";
import { reportError } from "@/lib/errors";

// Every 15 minutes: post the autopilot pieces that were finished but ran out of function time before publishing
// (docs §16). Auth: fail-closed CRON_SECRET bearer, same as the other /api/cron routes.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await publishPendingAutopilotRuns();
    if (res.checked) console.info(`[cron:studio-autopilot-publish] checked=${res.checked} published=${res.published} skipped=${res.skipped} failed=${res.failed}`);
    return NextResponse.json({ ok: res.failed === 0 && res.errors.length === 0, ...res });
  } catch (e) {
    reportError(e, "cron:studio-autopilot-publish");
    console.error("[cron:studio-autopilot-publish] threw:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "autopilot_publish_failed" }, { status: 500 });
  }
}
