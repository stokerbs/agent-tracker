import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BKK_DAY_FMT = { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" } as const;

const schema = z.object({
  airTagId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * GET /api/air-tags/history?airTagId=<uuid>&date=<YYYY-MM-DD>
 *
 * Returns the manually/CSV-entered AirTag position history for one Bangkok
 * calendar day, oldest-first. Staff-only; tracker visibility is checked with
 * the user-session client so RLS scopes access (404, not 403, when the
 * tracker isn't visible — never leaks existence to an unauthorized caller);
 * rate-limited. Mirrors the structure of /api/gps/history, but there is no
 * live external device to poll — this table is entirely human-entered, so
 * the whole route is just an RLS-scoped read.
 *
 * Response contract: { points: [{ lat, lng, t, accuracyM, note }] }
 * oldest-first, `t` = ISO 8601 UTC.
 *
 * IMPORTANT — this contract deliberately has NO `speed`/`heading` fields,
 * unlike /api/gps/history's `{ lat, lng, speed, t }`. AirTag pings are
 * discrete manual sightings (form entry or CSV import), not continuous
 * polled telemetry, so there is nothing to compute speed/heading from.
 * Map/replay UI built against this endpoint must not assume the GPS903
 * history shape.
 */
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const rl = await checkRateLimit("air_tag_history", profile.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let q: z.infer<typeof schema>;
  try {
    q = schema.parse({
      airTagId: request.nextUrl.searchParams.get("airTagId"),
      date: request.nextUrl.searchParams.get("date"),
    });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // A well-formed but impossible date (e.g. 2026-02-30) passes the regex;
  // reject it by requiring a round-trip through the Bangkok formatter to
  // reproduce the input exactly (mirrors /api/gps/history).
  const probe = new Date(`${q.date}T00:00:00+07:00`);
  const roundTrip = Number.isNaN(probe.getTime())
    ? null
    : new Intl.DateTimeFormat("en-CA", BKK_DAY_FMT).format(probe);
  if (roundTrip !== q.date) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  // Tracker access — RLS-scoped via the user-session client (404 if the
  // caller can't see it; excludes soft-deleted trackers explicitly, matching
  // the agent RLS policy and defense-in-depth for supervisors/admins who can
  // otherwise still see deleted rows).
  const supabase = await createClient();
  const { data: tracker } = await supabase
    .from("air_tag_trackers")
    .select("id")
    .eq("id", q.airTagId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!tracker) return NextResponse.json({ error: "Tracker not found" }, { status: 404 });

  const startIso = new Date(`${q.date}T00:00:00+07:00`).toISOString();
  const endIso = new Date(`${q.date}T23:59:59+07:00`).toISOString();

  const { data: rows, error } = await supabase
    .from("air_tag_positions")
    .select("lat, lng, recorded_at, accuracy_m, note")
    .eq("air_tag_id", q.airTagId)
    .gte("recorded_at", startIso)
    .lte("recorded_at", endIso)
    .order("recorded_at", { ascending: true });

  if (error) {
    console.error(`[air-tag-history] query failed airTagId=${q.airTagId}`, error);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }

  const points = (rows ?? []).map((p) => ({
    lat: p.lat as number,
    lng: p.lng as number,
    t: p.recorded_at as string,
    accuracyM: (p.accuracy_m as number | null) ?? null,
    note: (p.note as string | null) ?? null,
  }));

  return NextResponse.json({ points });
}
