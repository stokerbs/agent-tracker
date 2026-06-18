import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOrRefreshCredentialSession, gps903GetTracking, applyPositionToDevice } from "@/lib/gps903";

export const maxDuration = 30;

/**
 * GET /api/cron/gps903-sync
 * Vercel Cron calls this every minute with Authorization: Bearer <CRON_SECRET>.
 *
 * Polls ALL active credentials from gps903_credentials.
 * Each device logs in with its own IMEI/password — sessions are cached per credential.
 *
 * For each credential:
 *   1. Get or refresh ASP.NET session (per-device cache in gps903_credential_sessions)
 *   2. Call GetTracking to get current position
 *   3. If device is linked to a case (gps_devices row exists):
 *      - Write position to gps_device_positions
 *      - Update gps_devices.last_* denormalized columns
 *   4. Update gps903_devices catalog (last_seen)
 *   5. Update gps903_credentials.last_synced_at / last_sync_ok
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const svc = createServiceClient();

  const { data: credentials, error: credErr } = await svc
    .from("gps903_credentials")
    .select("id, imei, device_password, gps903_device_id, device_name")
    .eq("is_active", true)
    .not("gps903_device_id", "is", null);

  if (credErr) return NextResponse.json({ error: credErr.message }, { status: 500 });
  if (!credentials?.length) {
    return NextResponse.json({ ok: true, skipped: "no active credentials with a known device ID" });
  }

  const now = new Date().toISOString();

  const settled = await Promise.allSettled(
    credentials.map(async (cred) => {
      const session = await getOrRefreshCredentialSession(svc, cred);

      if (!session) {
        await svc.from("gps903_credentials").update({
          last_synced_at: now,
          last_sync_ok:   false,
        }).eq("id", cred.id);
        return { deviceId: cred.gps903_device_id, ok: false, error: "login failed" };
      }

      const pos = await gps903GetTracking(session, cred.gps903_device_id);

      // Find linked gps_devices row (device imported into a case)
      const { data: linked } = await svc
        .from("gps_devices")
        .select("id")
        .eq("gps903_device_id", cred.gps903_device_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (pos) {
        if (linked) {
          await applyPositionToDevice(svc, linked.id, pos);
        }

        // Keep gps903_devices catalog fresh (last_seen)
        await svc.from("gps903_devices").upsert(
          {
            gps903_device_id: cred.gps903_device_id,
            device_name:      cred.device_name,
            imei:             cred.imei,
            model:            null,
            last_seen:        pos.fixTime,
            synced_at:        now,
            updated_at:       now,
          },
          { onConflict: "gps903_device_id" },
        );

        await svc.from("gps903_credentials").update({
          last_synced_at: now,
          last_sync_ok:   true,
        }).eq("id", cred.id);
      } else {
        if (linked) {
          await svc.from("gps_devices").update({
            last_polled_at: now,
            last_poll_ok:   false,
          }).eq("id", linked.id);
        }

        await svc.from("gps903_credentials").update({
          last_synced_at: now,
          last_sync_ok:   false,
        }).eq("id", cred.id);
      }

      return { deviceId: cred.gps903_device_id, ok: pos !== null };
    }),
  );

  const results = settled.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { ok: false, error: (r.reason as Error)?.message ?? "unknown" },
  );

  return NextResponse.json({ ok: true, polled: results.length, results });
}
