/**
 * GET /api/debug/gps903
 * Returns the GPS903 integration configuration status (no secrets are exposed).
 *
 * Protected by CRON_SECRET bearer token when configured.
 * Example: curl -H "Authorization: Bearer <CRON_SECRET>" https://detectivepulse.app/api/debug/gps903
 *
 * Example response:
 * {
 *   "env": {
 *     "GPS903_IMEI": true,
 *     "GPS903_DEVICE_PASSWORD": false,
 *     "CRON_SECRET": true
 *   },
 *   "loginMode": "imei",
 *   "deviceIdConfigured": true,
 *   "loginTestResult": "skipped — call with ?test=1 to trigger a live login probe"
 * }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient }  from "@/lib/supabase/server";
import { gps903EnvCheck, gps903Login, getCachedSession } from "@/lib/gps903";

export const maxDuration = 30;
export const dynamic     = "force-dynamic";

export async function GET(request: NextRequest) {
  // Auth guard — require CRON_SECRET bearer token when configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const env = gps903EnvCheck();

  const svc        = createServiceClient();
  const cached     = await getCachedSession(svc);
  const hasSession = cached !== null;

  // Optional live login probe — opt-in only so prod logs stay clean
  const wantTest   = request.nextUrl.searchParams.get("test") === "1";
  let loginResult: string;

  if (wantTest && env.GPS903_IMEI && env.GPS903_DEVICE_PASSWORD) {
    const cookie = await gps903Login(
      process.env.GPS903_IMEI!,
      process.env.GPS903_DEVICE_PASSWORD!,
    );
    loginResult = cookie
      ? `success — ${cookie.split(";").map((c) => c.split("=")[0].trim()).join(", ")} cookies obtained`
      : "failed — wrong IMEI or device password, or login page changed";
  } else if (wantTest) {
    loginResult = "skipped — GPS903_IMEI or GPS903_DEVICE_PASSWORD not configured";
  } else {
    loginResult = 'skipped — call with ?test=1 to trigger a live login probe';
  }

  return NextResponse.json({
    env,
    loginMode:           "imei",
    imeiConfigured:      env.GPS903_IMEI,
    passwordConfigured:  env.GPS903_DEVICE_PASSWORD,
    sessionCached:       hasSession,
    loginTestResult:     loginResult,
  });
}
