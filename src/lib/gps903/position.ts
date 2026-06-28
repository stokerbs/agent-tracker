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

  const deviceUpdate: Record<string, unknown> = {
    last_lat:         pos.lat,
    last_lng:         pos.lng,
    last_speed_kmh:   pos.speed,
    last_heading:     heading,
    last_seen_at:     now,
    last_polled_at:   now,
    last_poll_ok:     true,
    last_locate_mode: pos.locateMode,
  };
  if (pos.battery !== null) deviceUpdate.last_battery_pct = pos.battery;

  const positionTime = gps903DateToIso(pos.fixTime);
  if (positionTime) deviceUpdate.last_position_time = positionTime;
  if (pos.stopMinutes !== null) deviceUpdate.last_stop_minutes = pos.stopMinutes;
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
