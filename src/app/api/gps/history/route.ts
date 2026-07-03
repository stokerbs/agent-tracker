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
const BKK_DAY_FMT = { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" } as const;

const schema = z.object({
  deviceId: z.string().uuid(),
  hours: z.coerce.number().int().min(1).max(MAX_HOURS).optional(),
  // Optional specific Bangkok calendar day (YYYY-MM-DD). When given, the window
  // is that whole day (00:00:00–23:59:59 Asia/Bangkok) instead of the rolling
  // `hours` window — lets the user pick a past day to replay. GPS903 caps each
  // response (~575 points), so a single day stays well within one request.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
 * the authoritative source when available. When the live call returns no points
 * (device offline for the window, or upstream hiccup) it falls back to our own
 * every-minute gps_device_positions storage so replay still has a track.
 * Staff-only; device visibility is checked with the user-session client so RLS
 * scopes access; rate-limited.
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
      date: request.nextUrl.searchParams.get("date") ?? undefined,
    });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // A well-formed but impossible date passes the regex; reject it. JS Date both
  // returns NaN for gross overflow (2026-13-40) AND silently rolls over day
  // overflow (2026-02-30 → Mar 1), so round-trip through the Bangkok formatter
  // and require it to reproduce the input exactly.
  if (q.date) {
    const dt = new Date(`${q.date}T00:00:00+07:00`);
    const roundTrip = Number.isNaN(dt.getTime())
      ? null
      : new Intl.DateTimeFormat("en-CA", BKK_DAY_FMT).format(dt);
    if (roundTrip !== q.date) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
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
  if (!credential) {
    console.warn(`[gps-history] no active GPS903 credential for device ${dev.gps903_device_id}`);
    return NextResponse.json({ points: [], error: "no_credential" });
  }

  const session = await getOrRefreshCredentialSession(svc, credential);
  if (!session) {
    console.error(`[gps-history] GPS903 login failed for device ${dev.gps903_device_id}`);
    return NextResponse.json({ error: "GPS903 login failed" }, { status: 502 });
  }

  // Window: a specific Bangkok day (?date=) or the rolling last `hours`.
  // `start`/`end` are Bangkok "YYYY-MM-DD HH:MM:SS" for GPS903; `startIso`/
  // `endIso` are UTC bounds for the stored-position fallback query.
  const now = new Date();
  let start: string, end: string, startIso: string, endIso: string;
  if (q.date) {
    start = `${q.date} 00:00:00`;
    end = `${q.date} 23:59:59`;
    startIso = new Date(`${q.date}T00:00:00+07:00`).toISOString();
    endIso = new Date(`${q.date}T23:59:59+07:00`).toISOString();
  } else {
    const hours = q.hours ?? 24;
    start = bangkokStamp(new Date(now.getTime() - hours * 3_600_000));
    end = bangkokStamp(now);
    startIso = new Date(now.getTime() - hours * 3_600_000).toISOString();
    endIso = now.toISOString();
  }

  const history = await gps903GetHistory(session, credential.gps903_device_id, start, end);
  let points = history.map((h) => ({
    lat: h.lat,
    lng: h.lng,
    speed: h.speed,
    // Normalise the device's UTC fix time to a proper ISO string for the client.
    t: gps903DateToIso(h.fixTime) ?? h.fixTime,
  }));

  // Fallback to our own stored track. The live GPS903 GetDevicesHistory call
  // routinely comes back empty (device offline for the window, or an upstream
  // hiccup) — which showed the user an empty replay. We persist a fix every
  // minute in gps_device_positions, so replay that instead of showing nothing.
  // Device visibility was already RLS-checked above (the user-client `dev`
  // lookup), so reading this one device's positions via the service client is
  // scoped to a device the caller is allowed to see.
  if (points.length === 0) {
    const { data: stored } = await svc
      .from("gps_device_positions")
      .select("lat, lng, speed_kmh, recorded_at")
      .eq("gps_device_id", q.deviceId)
      .gte("recorded_at", startIso)
      .lte("recorded_at", endIso)
      .order("recorded_at", { ascending: true });
    points = (stored ?? []).map((p) => ({
      lat: p.lat as number,
      lng: p.lng as number,
      speed: (p.speed_kmh as number | null) ?? 0,
      t: p.recorded_at as string,
    }));
    console.log(
      `[gps-history] live GPS903 empty → stored fallback: ${points.length} points for device ${q.deviceId}`,
    );
  }

  return NextResponse.json({ points });
}
