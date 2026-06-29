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
    .select("stopped_since, last_lat, last_lng")
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

  // ── Smart geofence: alert on enter/exit of any active fence ──
  // Compare the device's previous position to the new one (same approach as the
  // agent location route). Non-fatal: never let alerting break the sync.
  try {
    const prevLat = cur?.last_lat;
    const prevLng = cur?.last_lng;
    const { data: fences } = await svc
      .from("geofences")
      .select("id, name, coordinates")
      .eq("active", true)
      .is("deleted_at", null);

    for (const fence of fences ?? []) {
      const coords = fence.coordinates as LatLng[];
      if (!Array.isArray(coords) || coords.length < 3) continue;

      const nowInside = isInsideGeofence(pos.lat, pos.lng, coords);
      const wasInside =
        prevLat != null && prevLng != null
          ? isInsideGeofence(Number(prevLat), Number(prevLng), coords)
          : false;
      if (nowInside === wasInside) continue;

      const eventType = nowInside ? "enter" : "exit";
      const body = await buildGeofenceAlert({ deviceLabel, fenceName: fence.name, eventType });
      await notifyRole(["admin", "supervisor"], {
        type: "system",
        title: "แจ้งเตือน Geofence",
        body,
        url: notificationLinks.map(),
        entityId: fence.id,
      });
    }
  } catch (e) {
    console.error("[GPS903] geofence alert failed (non-fatal):", e);
  }
}
