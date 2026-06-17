import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleDbError } from "@/lib/errors";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  battery: z.number().min(0).max(100).optional(),
  charging: z.boolean().optional(),
  speed_kmh: z.number().min(0).optional(),
  heading: z.number().min(0).max(359).optional(),
  status: z
    .enum(["online", "moving", "idle", "offline", "emergency"])
    .optional(),
});

/** Ray-casting point-in-polygon test (works for simple polygons). */
function isInsideGeofence(
  lat: number,
  lng: number,
  polygon: Array<{ lat: number; lng: number }>,
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = polygon[i], b = polygon[j];
    if (
      a.lng > lng !== b.lng > lng &&
      lat < ((b.lat - a.lat) * (lng - a.lng)) / (b.lng - a.lng) + a.lat
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * POST /api/agents/location
 * Field devices report their GPS position, speed, heading, and battery here every ~55 s.
 *
 * Auth flow:
 *   1. Verify session via the user-session client (cookie-based JWT).
 *   2. All subsequent DB operations use the service role key to avoid
 *      RLS auth-context issues in Route Handlers — security is enforced
 *      at the application layer by filtering on the verified user.id.
 */
export async function POST(request: NextRequest) {
  // Step 1: verify session — user-session client only for auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit("gps", user.id);
  if (!limit.allowed) {
    const retryAfter = Math.ceil(limit.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let parsed;
  try {
    parsed = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Step 2: all DB work via service client — profile_id = user.id enforced here
  const svc = createServiceClient();

  const { data: agent } = await svc
    .from("agents")
    .select("id, status, current_lat, current_lng")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json(
      { error: "No agent profile linked to this user" },
      { status: 404 },
    );
  }

  const update: Record<string, unknown> = {
    current_lat: parsed.lat,
    current_lng: parsed.lng,
    last_active: new Date().toISOString(),
    speed_kmh: parsed.speed_kmh ?? 0,
    heading: parsed.heading ?? 0,
  };
  if (parsed.battery !== undefined) update.battery_pct = parsed.battery;
  if (parsed.charging !== undefined) update.is_charging = parsed.charging;
  if (parsed.status) {
    update.status = parsed.status;
  } else if (agent.status === "offline") {
    // Auto-promote to online on first GPS ping — agent is clearly connected.
    update.status = "online";
  }

  const { error } = await svc
    .from("agents")
    .update(update)
    .eq("id", agent.id)
    .eq("profile_id", user.id); // redundant safety filter

  if (error) {
    return NextResponse.json(
      { error: handleDbError(error, "gps:update") },
      { status: 500 },
    );
  }

  // ── Post-update: history + geofence checks (non-fatal) ──
  void (async () => {

    // 1. Insert location history entry for trail feature
    await svc.from("agent_location_history").insert({
      agent_id: agent.id,
      lat: parsed.lat,
      lng: parsed.lng,
      speed_kmh: parsed.speed_kmh ?? null,
      heading: parsed.heading ?? null,
    });

    // 2. Clean up history older than 7 days (analytics retention window)
    await svc
      .from("agent_location_history")
      .delete()
      .eq("agent_id", agent.id)
      .lt(
        "recorded_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      );

    // 3. Geofence enter/exit detection
    const { data: fences } = await svc
      .from("geofences")
      .select("id, coordinates")
      .eq("active", true)
      .is("deleted_at", null);

    if (!fences?.length) return;

    const prevLat = agent.current_lat;
    const prevLng = agent.current_lng;
    const hasPrev = prevLat !== null && prevLng !== null;

    for (const fence of fences) {
      const coords = fence.coordinates as Array<{ lat: number; lng: number }>;
      if (!Array.isArray(coords) || coords.length < 3) continue;

      const nowInside = isInsideGeofence(parsed.lat, parsed.lng, coords);
      const wasInside = hasPrev
        ? isInsideGeofence(prevLat!, prevLng!, coords)
        : false;

      if (nowInside !== wasInside) {
        await svc.from("geofence_events").insert({
          geofence_id: fence.id,
          agent_id: agent.id,
          event_type: nowInside ? "enter" : "exit",
          lat: parsed.lat,
          lng: parsed.lng,
        });
      }
    }
  })();

  return NextResponse.json({ ok: true });
}
