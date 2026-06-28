/**
 * Shared Google Maps constants and formatters used by both map surfaces —
 * the live ops map (components/map/live-map.tsx) and the GPS monitor
 * (components/gps903/gps-monitor-map.tsx). Consolidated for TD-1.
 */

/** Advanced-marker map style id (falls back to the ops map id). */
export const MAP_ID =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "detective-pulse-ops-map";

/** A fix older than this is treated as stale / offline on the maps. */
export const STALE_MS = 10 * 60 * 1000;

/** Format a UTC timestamp for display in Asia/Bangkok (GMT+7). */
export function formatBangkokTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      day:      "2-digit",
      month:    "short",
      year:     "numeric",
      hour:     "2-digit",
      minute:   "2-digit",
      second:   "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}:${get("second")} GMT+7`;
  } catch { return "—"; }
}

/** Format a stop-duration in minutes as "1h 20m" / "45m" / "2h". */
export function formatStopMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes < 0) return "—";
  if (minutes === 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
