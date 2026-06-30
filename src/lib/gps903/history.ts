import {
  GPS903_BASE,
  GPS903_TIMEZONE,
  FETCH_TIMEOUT,
  withTimeout,
  parseGps903Value,
} from "./client";

export interface HistoryPoint {
  lat:         number;
  lng:         number;
  speed:       number;
  course:      number;
  fixTime:     string;
  stopMinutes: number;
}

export async function gps903GetHistory(
  sessionCookie: string,
  deviceId: number,
  start: string, // "YYYY-MM-DD HH:MM:SS"
  end:   string,
): Promise<HistoryPoint[]> {
  let res: Response;
  try {
    res = await fetch(`${GPS903_BASE}/Ajax/DevicesAjax.asmx/GetDevicesHistory`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Cookie": sessionCookie },
      body:    JSON.stringify({
        DeviceID: deviceId, Start: start, End: end,
        TimeZone: GPS903_TIMEZONE, ShowLBS: 1,
      }),
      signal: withTimeout(FETCH_TIMEOUT),
    });
  } catch (e) {
    console.error(`[GPS903] GetHistory device ${deviceId} fetch error:`, String(e));
    return [];
  }

  console.log(`[GPS903] GetHistory device ${deviceId} ${start}..${end} — HTTP ${res.status}`);
  if (!res.ok) return [];

  let envelope: { d?: string };
  try { envelope = await res.json() as { d?: string }; } catch { return []; }
  if (!envelope.d) {
    console.log(`[GPS903] GetHistory device ${deviceId} — empty d field`);
    return [];
  }

  const data = parseGps903Value(envelope.d);
  const points = (Array.isArray(data) ? data : (data as Record<string, unknown> | null)?.devices) as unknown[];
  if (!Array.isArray(points)) return [];

  const mapped = (points as Record<string, unknown>[])
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({
      lat:         parseFloat(String(p.latitude)),
      lng:         parseFloat(String(p.longitude)),
      speed:       parseFloat(String(p.speed))         || 0,
      course:      Number(p.course)                    || 0,
      fixTime:     String(p.deviceUtcDate              ?? ""),
      stopMinutes: Number(p.stopTimeMinute)             || 0,
    }))
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lng));

  // Force chronological (oldest-first) — replay walks the array forwards and the
  // upstream return order is not guaranteed. fixTime is a fixed
  // "YYYY-MM-DD HH:MM:SS" string, so a lexicographic sort is chronological.
  mapped.sort((a, b) => a.fixTime.localeCompare(b.fixTime));

  console.log(`[GPS903] GetHistory device ${deviceId} — ${mapped.length} points`);
  return mapped;
}
