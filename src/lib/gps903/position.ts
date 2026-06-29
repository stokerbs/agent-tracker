import { type SvcClient } from "./client";
import { type TrackingResult, gps903DateToIso } from "./tracking";
import { isInsideGeofence, buildGeofenceAlert, type LatLng } from "@/lib/geo/geofence";
import { notifyRole, notificationLinks } from "@/lib/notifications";

/**
 * Write a GPS tracking result to the device position history and update
 * the denormalized last-known position on gps_devices.
 *
 * GPS devices are independent entities — this does NOT update the agents table.
 * Agent locations come from the agent's own mobile GPS reporter.
 */
export async function applyPositionToDevice(
  svc: SvcClient,
  gpsDeviceId: string,
  pos: TrackingResult,
  deviceLabel = "อุปกรณ์ GPS",
): Promise<void> {
  const heading = Math.round(pos.course) % 360;
  const now     = new Date().toISOString();

  const posRow: Record<string, unknown> = {
    gps_device_id: gpsDeviceId,
    lat:           pos.lat,
    lng:           pos.lng,
    speed_kmh:     pos.speed,
    heading,
    recorded_at:   now,
    locate_mode:   pos.locateMode,
  };
  if (pos.battery !== null) posRow.battery_pct = pos.battery;

  const positionTime = gps903DateToIso(pos.fixTime);

  // Derive stop duration. GetTracking returns only an isStop boolean (no
  // duration), so we track it ourselves: stopped_since is set on the first
  // stationary fix (seeded from the fix time, so an already-parked device reads
  // a sensible duration) and cleared on movement; last_stop_minutes is computed
  // from it each poll.
  const STOP_SPEED_KMH = 3;
  const moving = pos.speed > STOP_SPEED_KMH;
  const { data: cur } = await svc
    .from("gps_devices")
    .select("stopped_since, last_lat, last_lng, geofence_id, geofence_alerted_at")
    .eq("id", gpsDeviceId)
    .maybeSingle();

  let stoppedSince: string | null;
  let stopMinutes: number;
  if (moving) {
    stoppedSince = null;
    stopMinutes  = 0;
  } else {
    stoppedSince = cur?.stopped_since ?? positionTime ?? now;
    stopMinutes  = Math.max(0, Math.round((Date.parse(now) - Date.parse(stoppedSince ?? now)) / 60000));
  }

  const deviceUpdate: Record<string, unknown> = {
    last_lat:          pos.lat,
    last_lng:          pos.lng,
    last_speed_kmh:    pos.speed,
    last_heading:      heading,
    last_seen_at:      now,
    last_polled_at:    now,
    last_poll_ok:      true,
    last_locate_mode:  pos.locateMode,
    stopped_since:     stoppedSince,
    last_stop_minutes: stopMinutes,
  };
  if (pos.battery !== null) deviceUpdate.last_battery_pct = pos.battery;
  if (positionTime) deviceUpdate.last_position_time = positionTime;
  deviceUpdate.last_ignition = pos.ignition;

  await Promise.all([
    svc.from("gps_device_positions").insert(posRow),
    svc.from("gps_devices").update(deviceUpdate).eq("id", gpsDeviceId),
  ]);

  console.log(
    `[GPS903] Position written — device ${gpsDeviceId} ` +
    `lat:${pos.lat.toFixed(5)} lng:${pos.lng.toFixed(5)} speed:${pos.speed} battery:${pos.battery ?? "?"}`,
  );

  // ── Smart geofence (state-based + hysteresis) ──
  // Track the device's current fence membership (gps_devices.geofence_id) and
  // only act on a CONFIRMED change. A cooldown absorbs boundary jitter so a
  // device hovering on an edge can't spam enter/exit alerts. Each confirmed
  // crossing is logged to geofence_events and pushed to admins/supervisors.
  // Non-fatal: never let alerting break the sync.
  const GEOFENCE_COOLDOWN_MS = 3 * 60 * 1000;
  try {
    const { data: fences } = await svc
      .from("geofences")
      .select("id, name, coordinates")
      .eq("active", true)
      .is("deleted_at", null);

    // Which active fence is the device inside right now (first match wins)?
    let currentFenceId: string | null = null;
    let currentFenceName = "";
    for (const fence of fences ?? []) {
      const coords = fence.coordinates as LatLng[];
      if (Array.isArray(coords) && coords.length >= 3 && isInsideGeofence(pos.lat, pos.lng, coords)) {
        currentFenceId = fence.id;
        currentFenceName = fence.name;
        break;
      }
    }

    const storedFenceId = cur?.geofence_id ?? null;
    if (currentFenceId !== storedFenceId) {
      const lastAlert = cur?.geofence_alerted_at ? Date.parse(cur.geofence_alerted_at) : 0;
      const withinCooldown = Date.now() - lastAlert < GEOFENCE_COOLDOWN_MS;

      if (!withinCooldown) {
        const crossings: Array<{ fenceId: string; name: string; type: "enter" | "exit" }> = [];
        if (storedFenceId) {
          const exited = (fences ?? []).find((f) => f.id === storedFenceId);
          crossings.push({ fenceId: storedFenceId, name: exited?.name ?? "พื้นที่เฝ้าระวัง", type: "exit" });
        }
        if (currentFenceId) {
          crossings.push({ fenceId: currentFenceId, name: currentFenceName, type: "enter" });
        }

        for (const c of crossings) {
          await svc.from("geofence_events").insert({
            geofence_id: c.fenceId,
            gps_device_id: gpsDeviceId,
            event_type: c.type,
            lat: pos.lat,
            lng: pos.lng,
          });
          const body = await buildGeofenceAlert({ deviceLabel, fenceName: c.name, eventType: c.type });
          await notifyRole(["admin", "supervisor"], {
            type: "system",
            title: "แจ้งเตือน Geofence",
            body,
            url: notificationLinks.map(),
            entityId: c.fenceId,
          });
        }

        await svc
          .from("gps_devices")
          .update({ geofence_id: currentFenceId, geofence_alerted_at: new Date().toISOString() })
          .eq("id", gpsDeviceId);
      }
      // within cooldown → absorb the flap; stored state is unchanged and the
      // genuine change (if it persists) is confirmed on the next poll past cooldown.
    }
  } catch (e) {
    console.error("[GPS903] geofence alert failed (non-fatal):", e);
  }
}
