import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * GET /api/cron/cleanup-positions
 * Vercel Cron (daily) — bounds the growth of the two high-write position tables
 * by deleting rows older than the retention window:
 *   - gps_device_positions   (GPS903 tracker polling, ~1/min/device)
 *   - agent_location_history (agent phone pings)
 *
 * Reads are already time-windowed; this prevents unbounded TABLE growth
 * (index bloat, vacuum pressure, storage cost). Retention is configurable via
 * POSITION_RETENTION_DAYS (default 90).
 *
 * Auth: fail-closed CRON_SECRET bearer, same as the other crons.
 *
 * Note: a very large first run could exceed maxDuration; the daily cadence will
 * catch up over subsequent runs. If volume warrants, switch to batched deletes
 * or a pg_cron job.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retentionDays = Number(process.env.POSITION_RETENTION_DAYS ?? 90);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const svc = createServiceClient();

  const [devicePos, agentHist] = await Promise.all([
    svc
      .from("gps_device_positions")
      .delete({ count: "exact" })
      .lt("recorded_at", cutoff),
    svc
      .from("agent_location_history")
      .delete({ count: "exact" })
      .lt("recorded_at", cutoff),
  ]);

  const errors = [devicePos.error, agentHist.error].filter(Boolean);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: errors.map((e) => e!.message).join("; "), cutoff },
      { status: 500 },
    );
  }

  const result = {
    ok: true,
    cutoff,
    retentionDays,
    deleted: {
      gps_device_positions: devicePos.count ?? 0,
      agent_location_history: agentHist.count ?? 0,
    },
  };
  console.log("[cleanup-positions]", result);
  return NextResponse.json(result);
}
