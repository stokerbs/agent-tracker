/**
 * GET /api/debug/gps903
 * Returns the GPS903 integration status — credential count, session health, no secrets exposed.
 *
 * Protected by CRON_SECRET bearer token when configured.
 * Example: curl -H "Authorization: Bearer <CRON_SECRET>" https://your-app.app/api/debug/gps903
 *
 * Add ?test=<credential_id> to trigger a live login probe for a specific credential.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gps903Login } from "@/lib/gps903";

export const maxDuration = 30;
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

  // Credential summary (no passwords returned)
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

  // Optional live login probe — pass ?test=<credential_id>
  const testId = request.nextUrl.searchParams.get("test");
  let loginTestResult = "skipped — pass ?test=<credential_id> to probe a specific device";

  if (testId) {
    const { data: cred } = await svc
      .from("gps903_credentials")
      .select("imei, device_password, gps903_device_id")
      .eq("id", testId)
      .maybeSingle();

    if (!cred) {
      loginTestResult = `credential ${testId} not found`;
    } else {
      const cookie = await gps903Login(cred.imei, cred.device_password);
      loginTestResult = cookie
        ? `success — cookies: ${cookie.split(";").map((c) => c.split("=")[0].trim()).join(", ")}`
        : "failed — wrong IMEI or device password";
    }
  }

  return NextResponse.json({
    credentials: { total, active, lastSyncOk: ok },
    sessions:    { cached: sessions?.length ?? 0, valid: activeSessions },
    devices:     creds?.map((c) => ({
      id:              c.id,
      device_name:     c.device_name,
      imei_prefix:     c.imei.slice(0, 6) + "•••",
      gps903_device_id: c.gps903_device_id,
      is_active:       c.is_active,
      last_synced_at:  c.last_synced_at,
      last_sync_ok:    c.last_sync_ok,
    })),
    loginTestResult,
  });
}
