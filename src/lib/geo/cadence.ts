/**
 * Shared geo helpers for adaptive live-tracking cadence.
 *
 * Field devices report their position more often while moving (for a smooth,
 * Life360-style live map) and back off when stationary (to spare battery and
 * DB writes). The same thresholds drive both the web and native reporters and
 * the server-side breadcrumb guard, so they live here in one place.
 */

/** Report ~9 s apart while the agent is on the move. */
export const MOVING_INTERVAL_MS = 9_000;
/** Back off to ~60 s while the agent is stationary. */
export const IDLE_INTERVAL_MS = 60_000;
/** Speed above this (km/h) counts as "moving". */
export const MOVING_SPEED_KMH = 1.5;
/** ...or displacement above this (m) since the last report counts as "moving". */
export const MOVING_DISTANCE_M = 12;
/** Minimum displacement (m) to record a trail breadcrumb (drops GPS jitter). */
export const BREADCRUMB_MIN_M = 5;

/** Great-circle (haversine) distance between two coordinates, in metres. */
export function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Whether the agent is moving — true if fast enough OR displaced far enough
 * since the previous report. `movedM` is null when there is no previous fix
 * (treated as moving so the first report goes out promptly).
 */
export function isMoving(speedKmh: number, movedM: number | null): boolean {
  if (speedKmh > MOVING_SPEED_KMH) return true;
  return movedM === null || movedM > MOVING_DISTANCE_M;
}

/** The throttle interval to apply for the current movement state. */
export function reportIntervalMs(speedKmh: number, movedM: number | null): number {
  return isMoving(speedKmh, movedM) ? MOVING_INTERVAL_MS : IDLE_INTERVAL_MS;
}
