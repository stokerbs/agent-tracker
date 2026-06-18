import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getOrRefreshSession,
  gps903Login,
  cacheSession,
  gps903GetTracking,
  applyPositionToAgent,
} from "@/lib/gps903";

export const maxDuration = 30;

// ── Cron handler ──────────────────────────────────────────────────────────────

/**
 * GET /api/cron/gps903-sync
 * Vercel Cron calls this every minute with Authorization: Bearer <CRON_SECRET>.
 * All devices are polled in parallel (Promise.allSettled).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const imei           = process.env.GPS903_IMEI;
  const devicePassword = process.env.GPS903_DEVICE_PASSWORD;
  if (!imei || !devicePassword) {
    return NextResponse.json(
      { error: "GPS903_IMEI / GPS903_DEVICE_PASSWORD not configured" },
      { status: 500 },
    );
  }

  const svc = createServiceClient();

  const { data: devices, error: devErr } = await svc
    .from("gps_devices")
    .select("id, gps903_device_id, agent_id")
    .not("gps903_device_id", "is", null)
    .not("agent_id", "is", null)
    .is("deleted_at", null);

  if (devErr) return NextResponse.json({ error: devErr.message }, { status: 500 });
  if (!devices?.length) return NextResponse.json({ ok: true, skipped: "no configured devices" });

  let session = await getOrRefreshSession(svc);
  if (!session) {
    return NextResponse.json({ error: "GPS903 login failed — check IMEI credentials" }, { status: 502 });
  }

  const settled = await Promise.allSettled(
    devices.map(async (device) => {
      const gps903Id = device.gps903_device_id as number;
      const agentId  = device.agent_id as string;
      const deviceId = device.id as string;

      let pos = await gps903GetTracking(session!, gps903Id);
      let freshSession: string | undefined;

      if (!pos) {
        const fresh = await gps903Login(imei, devicePassword);
        if (fresh) {
          freshSession = fresh;
          pos = await gps903GetTracking(fresh, gps903Id);
        }
      }

      const pollOk = pos !== null;

      // Write poll status regardless of position result
      void svc.from("gps_devices").update({
        last_polled_at: new Date().toISOString(),
        last_poll_ok:   pollOk,
      }).eq("id", deviceId);

      if (pos) await applyPositionToAgent(svc, agentId, pos);

      return { deviceId: gps903Id, ok: pollOk, freshSession };
    }),
  );

  // Persist the most recently obtained fresh session if any
  const freshSessions = settled
    .filter((r) => r.status === "fulfilled" && !!(r as PromiseFulfilledResult<{ freshSession?: string }>).value.freshSession)
    .map((r) => (r as PromiseFulfilledResult<{ freshSession: string }>).value.freshSession);

  if (freshSessions.length > 0) {
    await cacheSession(svc, freshSessions[freshSessions.length - 1]);
  }

  const results = settled.map((r) =>
    r.status === "fulfilled"
      ? { deviceId: r.value.deviceId, ok: r.value.ok }
      : { ok: false, error: (r.reason as Error)?.message ?? "unknown" },
  );

  return NextResponse.json({ ok: true, polled: results.length, results });
}
