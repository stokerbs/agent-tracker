/**
 * GET /api/debug/gps903
 * GPS903 integration status + optional discovery diagnostic.
 *
 * Protected by CRON_SECRET bearer token when configured.
 *
 * Usage:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://your-app.app/api/debug/gps903
 *   curl -H "..." .../api/debug/gps903?test=<credential_id>
 *   curl -H "..." .../api/debug/gps903?discover=<credential_id>
 *
 * ?test=<id>     — basic login probe (returns cookie names only)
 * ?discover=<id> — full Device ID discovery run (returns all diagnostic entries,
 *                  raw response previews, and candidate IDs for every probe)
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gps903Login, gps903GetTracking, runGps903Discovery } from "@/lib/gps903";

export const maxDuration = 60;
export const dynamic     = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const svc = createServiceClient();

  // Credential summary (no passwords)
  const { data: creds } = await svc
    .from("gps903_credentials")
    .select("id, device_name, imei, gps903_device_id, is_active, last_synced_at, last_sync_ok");

  const total  = creds?.length ?? 0;
  const active = creds?.filter((c) => c.is_active).length ?? 0;
  const ok     = creds?.filter((c) => c.last_sync_ok).length ?? 0;

  // Session cache summary
  const { data: sessions } = await svc
    .from("gps903_credential_sessions")
    .select("credential_id, expires_at");

  const activeSessions = (sessions ?? []).filter(
    (s) => new Date(s.expires_at) > new Date(),
  ).length;

  const searchParams = request.nextUrl.searchParams;
  const testId       = searchParams.get("test");
  const discoverId   = searchParams.get("discover");

  // ── Basic login probe (?test=<id>) ─────────────────────────────────────────
  let loginTestResult: string | Record<string, unknown> =
    "skipped — pass ?test=<id> or ?discover=<id>";

  if (testId || discoverId) {
    const credId = testId ?? discoverId!;
    const { data: cred } = await svc
      .from("gps903_credentials")
      .select("imei, device_password, gps903_device_id")
      .eq("id", credId)
      .maybeSingle();

    if (!cred) {
      loginTestResult = `credential ${credId} not found`;
    } else if (testId && !discoverId) {
      // Basic test: login + GetTracking to see raw locate mode fields
      const cookie = await gps903Login(cred.imei, cred.device_password);
      if (!cookie) {
        loginTestResult = { ok: false, error: "Login failed — wrong IMEI or device password" };
      } else if (!cred.gps903_device_id) {
        loginTestResult = {
          ok: true,
          cookies: cookie.split(";").map((c) => c.split("=")[0].trim()),
          note: "No device_id stored — cannot call GetTracking. Use ?discover= to detect it.",
        };
      } else {
        const pos = await gps903GetTracking(cookie, cred.gps903_device_id);
        loginTestResult = pos
          ? {
              ok:          true,
              lat:         pos.lat,
              lng:         pos.lng,
              speed:       pos.speed,
              battery:     pos.battery,
              locateMode:  pos.locateMode,
              fixTime:     pos.fixTime,
              note:        "Check server logs for raw field dump from GPS903 response",
            }
          : { ok: false, error: "Login OK but GetTracking returned null — check server logs" };
      }
    } else if (discoverId) {
      // Full discovery run
      const cookie = await gps903Login(cred.imei, cred.device_password);
      if (!cookie) {
        loginTestResult = { ok: false, stage: "login", error: "Login failed" };
      } else {
        console.log(`[GPS903 debug] Starting full discovery for credential ${credId.slice(0, 8)}…`);
        const result = await runGps903Discovery(cookie, cred.imei);
        loginTestResult = {
          existingDeviceId: cred.gps903_device_id,
          discoveredId:     result.deviceId,
          foundVia:         result.method,
          probeCount:       result.diagnostics.length,
          diagnostics:      result.diagnostics.map((d) => ({
            source:       d.source,
            status:       d.status,
            candidateIds: d.candidateIds,
            note:         d.note,
            error:        d.error,
            rawPreview:   d.rawPreview,
          })),
        };
      }
    }
  }

  return NextResponse.json({
    credentials: { total, active, lastSyncOk: ok },
    sessions:    { cached: sessions?.length ?? 0, valid: activeSessions },
    devices: creds?.map((c) => ({
      id:               c.id,
      device_name:      c.device_name,
      imei_prefix:      c.imei.slice(0, 6) + "•••",
      gps903_device_id: c.gps903_device_id,
      is_active:        c.is_active,
      last_synced_at:   c.last_synced_at,
      last_sync_ok:     c.last_sync_ok,
    })),
    probe: loginTestResult,
  });
}
