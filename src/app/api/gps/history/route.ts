import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrRefreshCredentialSession, gps903GetHistory } from "@/lib/gps903";
import { gps903DateToIso } from "@/lib/gps903/tracking";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // live GPS903 history call can be slow

const MAX_HOURS = 72;

const schema = z.object({
  deviceId: z.string().uuid(),
  hours: z.coerce.number().int().min(1).max(MAX_HOURS).optional(),
});

/** Format a Date as "YYYY-MM-DD HH:MM:SS" in Asia/Bangkok (GetDevicesHistory's TimeZone). */
function bangkokStamp(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

/**
 * GET /api/gps/history?deviceId=<uuid>&hours=<1-72>
 * Route-replay track pulled LIVE from the GPS903 server (GetDevicesHistory) —
 * the authoritative history, independent of our every-minute storage (which can
 * miss fixes when the upstream poll times out). Staff-only; device visibility is
 * checked with the user-session client so RLS scopes access; rate-limited.
 * Returns { points: [{ lat, lng, speed, t(ISO UTC) }] } oldest-first.
 */
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const rl = await checkRateLimit("gps_history", profile.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let q: z.infer<typeof schema>;
  try {
    q = schema.parse({
      deviceId: request.nextUrl.searchParams.get("deviceId"),
      hours: request.nextUrl.searchParams.get("hours") ?? undefined,
    });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Device access — RLS-scoped (404 if the caller can't see it).
  const supabase = await createClient();
  const { data: dev } = await supabase
    .from("gps_devices")
    .select("gps903_device_id")
    .eq("id", q.deviceId)
    .maybeSingle();
  if (!dev) return NextResponse.json({ error: "Device not found" }, { status: 404 });
  if (!dev.gps903_device_id) return NextResponse.json({ points: [] });

  // Credential + session via the trusted service client (login secrets stay server-side).
  const svc = createServiceClient();
  const { data: credential } = await svc
    .from("gps903_credentials")
    .select("id, imei, device_password, gps903_device_id")
    .eq("gps903_device_id", dev.gps903_device_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!credential) return NextResponse.json({ points: [], error: "no_credential" });

  const session = await getOrRefreshCredentialSession(svc, credential);
  if (!session) return NextResponse.json({ error: "GPS903 login failed" }, { status: 502 });

  const hours = q.hours ?? 24;
  const now = new Date();
  const start = bangkokStamp(new Date(now.getTime() - hours * 3_600_000));
  const end = bangkokStamp(now);

  const history = await gps903GetHistory(session, credential.gps903_device_id, start, end);
  const points = history.map((h) => ({
    lat: h.lat,
    lng: h.lng,
    speed: h.speed,
    // Normalise the device's UTC fix time to a proper ISO string for the client.
    t: gps903DateToIso(h.fixTime) ?? h.fixTime,
  }));

  return NextResponse.json({ points });
}
