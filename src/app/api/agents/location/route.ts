import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleDbError } from "@/lib/errors";
import { notifyRole, notificationLinks } from "@/lib/notifications";
import { BREADCRUMB_MIN_M, distanceM } from "@/lib/geo/cadence";
import { isInsideGeofence } from "@/lib/geo/geofence";

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
  // Set by the native layer when flushing fixes captured offline: record this
  // fix in history at its true time, without touching the agent's live position.
  recorded_at: z.string().datetime().optional(),
});

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
  // Step 1: resolve the acting user — cookie session, or a background GPS bearer
  // token (native background reporting, where WebView cookies aren't available).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let userId = user?.id ?? null;

  if (!userId) {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (token) {
      const svcAuth = createServiceClient();
      const { data: tokenRow } = await svcAuth
        .from("gps_tokens")
        .select("profile_id, revoked_at")
        .eq("token", token)
        .maybeSingle();
      if (tokenRow && !tokenRow.revoked_at) {
        userId = tokenRow.profile_id as string;
        void svcAuth
          .from("gps_tokens")
          .update({ last_used_at: new Date().toISOString() })
          .eq("token", token);
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkRateLimit("gps", userId);
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
    .select("id, full_name, status, current_lat, current_lng")
    .eq("profile_id", userId)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json(
      { error: "No agent profile linked to this user" },
      { status: 404 },
    );
  }

  // Backfill: a fix captured while offline, flushed later. Record it in history
  // at its real timestamp; do NOT overwrite the agent's current position/status
  // (a newer live fix may already have superseded it). No geofence eval — the
  // agent has long since moved on from this point.
  if (parsed.recorded_at) {
    after(async () => {
      await svc.from("agent_location_history").insert({
        agent_id: agent.id,
        lat: parsed.lat,
        lng: parsed.lng,
        speed_kmh: parsed.speed_kmh ?? null,
        heading: parsed.heading ?? null,
        recorded_at: parsed.recorded_at,
      });
    });
    return NextResponse.json({ ok: true, backfilled: true });
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
    // Explicit status from client always wins.
    update.status = parsed.status;
  } else if (agent.status === "emergency") {
    // Never auto-clear an emergency — only the agent or ops can resolve it.
  } else {
    const speed = parsed.speed_kmh ?? 0;
    if (agent.status === "offline") {
      // First ping after going offline — agent is clearly connected.
      update.status = speed > 1 ? "moving" : "online";
    } else if (speed > 1) {
      // Moving — auto-promote regardless of current state.
      update.status = "moving";
    } else if (agent.status === "moving") {
      // Was moving, now stopped — snap back to online.
      update.status = "online";
    }
    // idle / online stay as-is when stationary.
  }

  const { error } = await svc
    .from("agents")
    .update(update)
    .eq("id", agent.id)
    .eq("profile_id", userId); // redundant safety filter

  if (error) {
    return NextResponse.json(
      { error: handleDbError(error, "gps:update") },
      { status: 500 },
    );
  }

  // ── Post-update: history + geofence checks (non-fatal) ──
  // `after()` keeps the function alive until this completes. Unlike Server
  // Actions, after() DOES flush in Route Handlers on Vercel (verified), so the
  // geofence notification's push isn't dropped when the GPS response returns.
  after(async () => {

    // 1. Insert location history entry for trail feature.
    //    Skip near-stationary fixes: the faster moving cadence (~9 s) would
    //    otherwise flood the trail with GPS jitter and grow the table fast.
    //    Real movement (> ~5 m) is always recorded; live position on `agents`
    //    was already updated above regardless of this guard.
    const prevLat = agent.current_lat;
    const prevLng = agent.current_lng;
    const movedEnough =
      prevLat === null ||
      prevLng === null ||
      distanceM({ lat: prevLat, lng: prevLng }, { lat: parsed.lat, lng: parsed.lng }) >
        BREADCRUMB_MIN_M;
    if (movedEnough) {
      await svc.from("agent_location_history").insert({
        agent_id: agent.id,
        lat: parsed.lat,
        lng: parsed.lng,
        speed_kmh: parsed.speed_kmh ?? null,
        heading: parsed.heading ?? null,
      });
    }

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
      .select("id, name, coordinates")
      .eq("active", true)
      .is("deleted_at", null);

    if (!fences?.length) return;

    const hasPrev = prevLat !== null && prevLng !== null;

    for (const fence of fences) {
      const coords = fence.coordinates as Array<{ lat: number; lng: number }>;
      if (!Array.isArray(coords) || coords.length < 3) continue;

      const nowInside = isInsideGeofence(parsed.lat, parsed.lng, coords);
      const wasInside = hasPrev
        ? isInsideGeofence(prevLat!, prevLng!, coords)
        : false;

      if (nowInside !== wasInside) {
        const eventType = nowInside ? "enter" : "exit";
        await svc.from("geofence_events").insert({
          geofence_id: fence.id,
          agent_id: agent.id,
          event_type: eventType,
          lat: parsed.lat,
          lng: parsed.lng,
        });
        // Alert supervisors/admins of the boundary crossing through the one pipeline.
        await notifyRole(["admin", "supervisor"], {
          type: "system",
          title: "Geofence alert",
          body: `${agent.full_name ?? "An agent"} ${eventType === "enter" ? "entered" : "left"} ${fence.name}.`,
          url: notificationLinks.map(),
          entityId: fence.id,
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
