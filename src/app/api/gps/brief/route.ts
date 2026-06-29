import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { summarizeTrack, buildSurveillanceBrief, type TrackPoint } from "@/lib/gps903/brief";

export const dynamic = "force-dynamic";

const schema = z.object({
  deviceId: z.string().uuid(),
  hours: z.number().int().min(1).max(168).optional(),
});

/**
 * POST /api/gps/brief
 * Generates an AI surveillance brief for a GPS device over the last N hours.
 * Reads position history with the user-session client, so RLS enforces that the
 * caller may only brief devices they can access.
 */
export async function POST(request: NextRequest) {
  await requireProfile();

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const hours = body.hours ?? 24;

  const supabase = await createClient();

  // Device label (RLS-scoped). 404 if the caller can't see it.
  const { data: device } = await supabase
    .from("gps_devices")
    .select("id, notes, gps903_device_id, cases(case_number)")
    .eq("id", body.deviceId)
    .maybeSingle();
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }
  const deviceLabel = device.notes ?? `GPS903-${device.gps903_device_id ?? "?"}`;

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data: rows } = await supabase
    .from("gps_device_positions")
    .select("lat,lng,speed_kmh,recorded_at")
    .eq("gps_device_id", body.deviceId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true })
    .limit(2000);

  const points: TrackPoint[] = (rows ?? []).map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lng),
    speed: Number(r.speed_kmh ?? 0),
    t: r.recorded_at as string,
  }));

  const summary = summarizeTrack(points);
  const { brief, ai } = await buildSurveillanceBrief(deviceLabel, summary, hours);

  return NextResponse.json({ deviceLabel, hours, summary, brief, ai });
}
