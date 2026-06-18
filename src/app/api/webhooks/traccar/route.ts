import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

// Traccar speed is in knots; convert to km/h.
const KNOTS_TO_KMH = 1.852;

const AttributesSchema = z.object({
  batteryLevel: z.number().min(0).max(100).optional(),
  ignition: z.boolean().optional(),
  motion: z.boolean().optional(),
}).passthrough();

const PositionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).default(0),     // knots
  course: z.number().min(0).max(360).default(0),
  valid: z.boolean().default(true),
  fixTime: z.string().optional(),
  attributes: AttributesSchema.optional(),
});

const DeviceSchema = z.object({
  uniqueId: z.string(), // IMEI
  name: z.string().optional(),
});

const PayloadSchema = z.object({
  device: DeviceSchema,
  position: PositionSchema.optional(),
});

/**
 * POST /api/webhooks/traccar?secret=<TRACCAR_WEBHOOK_SECRET>
 *
 * Traccar fires this webhook on every position update.
 * We resolve the IMEI → gps_devices → agent_id, then update the agent row
 * and insert an agent_location_history entry — identical to what the mobile
 * GPS reporter does, but driven by a hardware tracker.
 *
 * Set the Traccar notification URL to:
 *   https://your-app.com/api/webhooks/traccar?secret=<secret>
 */
export async function POST(request: NextRequest) {
  // ── Auth: shared secret in query param ────────────────────────────────────
  const secret = process.env.TRACCAR_WEBHOOK_SECRET;
  if (secret) {
    const provided = request.nextUrl.searchParams.get("secret");
    if (!provided || provided !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ── Parse payload ──────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { device, position } = parsed.data;

  // Events without a position (e.g. deviceOnline status-only events) are valid
  // but nothing to persist — acknowledge and exit.
  if (!position || !position.valid) {
    return NextResponse.json({ ok: true, skipped: "no valid position" });
  }

  const imei = device.uniqueId.trim();
  if (!/^\d{15}$/.test(imei)) {
    return NextResponse.json({ error: "uniqueId must be a 15-digit IMEI" }, { status: 400 });
  }

  // ── Resolve IMEI → agent ───────────────────────────────────────────────────
  const svc = createServiceClient();

  const { data: gpsDevice } = await svc
    .from("gps_devices")
    .select("id, agent_id, case_id")
    .eq("imei", imei)
    .is("deleted_at", null)
    .maybeSingle();

  if (!gpsDevice?.agent_id) {
    // Device is registered but not linked to an agent — or not registered at all.
    // Silently accept (200) so Traccar doesn't keep retrying.
    return NextResponse.json({ ok: true, skipped: "no agent linked to IMEI" });
  }

  const agentId = gpsDevice.agent_id;
  const speedKmh = Math.round(position.speed * KNOTS_TO_KMH * 10) / 10;
  const heading = Math.round(position.course) % 360;
  const battery = position.attributes?.batteryLevel ?? null;

  // Fetch current agent status so we can apply the same moving/online logic
  // as the mobile reporter without clobbering an emergency status.
  const { data: agent } = await svc
    .from("agents")
    .select("status")
    .eq("id", agentId)
    .maybeSingle();

  const currentStatus = agent?.status ?? "offline";

  let newStatus = currentStatus;
  if (currentStatus !== "emergency") {
    if (currentStatus === "offline") {
      newStatus = speedKmh > 1 ? "moving" : "online";
    } else if (speedKmh > 1) {
      newStatus = "moving";
    } else if (currentStatus === "moving") {
      newStatus = "online";
    }
  }

  const agentUpdate: Record<string, unknown> = {
    current_lat: position.latitude,
    current_lng: position.longitude,
    last_active: position.fixTime ?? new Date().toISOString(),
    speed_kmh: speedKmh,
    heading,
    status: newStatus,
  };
  if (battery !== null) agentUpdate.battery_pct = battery;

  await svc.from("agents").update(agentUpdate).eq("id", agentId);

  // ── Append to location history (trail) ────────────────────────────────────
  await svc.from("agent_location_history").insert({
    agent_id: agentId,
    lat: position.latitude,
    lng: position.longitude,
    speed_kmh: speedKmh,
    heading,
  });

  return NextResponse.json({ ok: true });
}
