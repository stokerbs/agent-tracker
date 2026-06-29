import { type SvcClient } from "./client";
import { type TrackingResult, gps903DateToIso } from "./tracking";

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
    .select("stopped_since")
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
}
