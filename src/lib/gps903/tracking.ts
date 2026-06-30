import {
  GPS903_BASE,
  GPS903_TIMEZONE,
  FETCH_TIMEOUT,
  withTimeout,
  parseGps903Value,
} from "./client";

export interface TrackingResult {
  lat:         number;
  lng:         number;
  speed:       number;               // km/h
  course:      number;               // degrees 0–360
  battery:     number | null;        // percent (from dataContext[1])
  ignition:    boolean;              // ACC on/off (from dataContext[0])
  fixTime:     string;               // deviceUtcDate as-is
  locateMode:  "gps" | "lbs" | "unknown"; // gps = satellite fix; lbs = cell tower; unknown = field absent
  stopMinutes: number | null;        // minutes stopped (stopTimeMinute or parsed stopTime string)
  isStop:      boolean | null;       // 903's own stopped flag (isStop=1 / status "Stop"); null = field absent
}

/**
 * Parse GPS903 stop-time strings like "3Hour20Minute" → 200 (total minutes).
 * Falls back to numeric conversion for plain number strings.
 */
function parseGps903StopString(s: string): number | null {
  const asNum = Number(s);
  if (!isNaN(asNum)) return asNum >= 0 ? asNum : null;
  const h = s.match(/(\d+)\s*[Hh]our/)?.[1];
  const m = s.match(/(\d+)\s*[Mm]inute/)?.[1];
  if (h === undefined && m === undefined) return null;
  return (parseInt(h ?? "0", 10) * 60) + parseInt(m ?? "0", 10);
}

/**
 * Convert a GPS903 device UTC date string to an ISO 8601 timestamp for PostgreSQL.
 * GPS903 format is typically "YYYY-MM-DD HH:MM:SS" (space-separated, no timezone).
 * We treat it as UTC to match the "deviceUtcDate" field name.
 */
export function gps903DateToIso(fixTime: string): string | null {
  if (!fixTime) return null;
  if (fixTime.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(fixTime)) {
    const d = new Date(fixTime);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const normalized = fixTime.replace(/\//g, "-").replace(" ", "T") + "Z";
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Call GetTracking for a single device.
 *
 * Response format (live-confirmed):
 *   {"d": "{locationID:1,latitude:\"13.65902\",longitude:\"100.64618\",speed:\"0.00\",
 *            course:0,isStop:1,dataContext:\"0,50,0\",deviceUtcDate:\"...\",status:\"Stop\"}"}
 *
 * dataContext = "ACC,battery%,alarm" e.g. "1,87,0" → ignition=on, battery=87%, alarm=off
 */
export async function gps903GetTracking(
  sessionCookie: string,
  deviceId: number,
): Promise<TrackingResult | null> {
  let res: Response;
  try {
    res = await fetch(`${GPS903_BASE}/Ajax/DevicesAjax.asmx/GetTracking`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Cookie": sessionCookie },
      body:    JSON.stringify({ DeviceID: deviceId, TimeZone: GPS903_TIMEZONE }),
      signal:  withTimeout(FETCH_TIMEOUT),
    });
  } catch (e) {
    console.error(`[GPS903] GetTracking device ${deviceId} fetch error:`, String(e));
    return null;
  }

  console.log(`[GPS903] GetTracking device ${deviceId} — HTTP ${res.status}`);
  if (!res.ok) return null;

  let envelope: { d?: string };
  try { envelope = await res.json() as { d?: string }; } catch { return null; }

  if (!envelope.d) {
    console.log(`[GPS903] GetTracking device ${deviceId} — empty d field (session may be expired)`);
    return null;
  }

  // The d field is a JS object literal, not JSON — use Function eval
  const data = parseGps903Value(envelope.d) as Record<string, unknown> | null;
  if (!data || Array.isArray(data)) return null;

  // Log every raw field so we can identify the locate-mode field name in production logs.
  // GPS903 firmware versions differ; we need to see the real payload once to confirm.
  console.log(
    `[GPS903] GetTracking device ${deviceId} raw fields: ` +
    Object.entries(data).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" "),
  );

  // GPS903 uses latitude/longitude (strings), not lat/lng
  if (data.latitude == null || data.longitude == null) {
    console.log(`[GPS903] GetTracking device ${deviceId} — no coordinates`);
    return null;
  }
  const lat = parseFloat(String(data.latitude));
  const lng = parseFloat(String(data.longitude));
  if (isNaN(lat) || isNaN(lng)) return null;

  // dataContext = "ACC,battery%,alarm" e.g. "0,50,0"
  let battery:  number | null = null;
  let ignition: boolean       = false;
  const ctx = String(data.dataContext ?? "");
  if (ctx) {
    const parts = ctx.split(",");
    ignition = parts[0] === "1";
    const raw = Number(parts[1]);
    if (!isNaN(raw) && raw >= 0 && raw <= 100) battery = raw;
  }

  // ── Locate mode detection ────────────────────────────────────────────────
  //
  // GPS903 firmware encodes fix type differently across versions.
  // We try every known variant in priority order and log which one fires.
  //
  // isLBS / IsLBS / isLbs  : numeric 0=GPS, 1=LBS  (most common)
  // locType / loctype       : numeric 0=GPS, 1=LBS
  // isGPS  / isGps          : numeric 1=GPS, 0=LBS  (inverted flag)
  // type                    : string  "GPS" | "LBS"
  // status                  : string  may contain "GPS" or "LBS" as substring
  //                           e.g. "GPS Stop", "LBS Moving"
  //
  // If none of the above resolves it, we emit "unknown" and the full field
  // list is already in the log line above for diagnosis.
  let locateMode: "gps" | "lbs" | "unknown" = "unknown";
  let locateModeSource = "none";

  // dataType — confirmed in the real payload for this firmware: 1=GPS, 2=LBS
  // (3309704 returned dataType=2 on an LBS/parked fix). Highest priority.
  if ("dataType" in data && data.dataType !== null && data.dataType !== "") {
    const dt = Number(data.dataType);
    if (dt === 1) { locateMode = "gps"; locateModeSource = `dataType=${data.dataType}`; }
    else if (dt === 2) { locateMode = "lbs"; locateModeSource = `dataType=${data.dataType}`; }
  }

  // Numeric: isLBS / locType (0=GPS, 1=LBS)
  if (locateMode === "unknown") {
    const lbsFlagFields = ["isLBS", "IsLBS", "isLbs", "locType", "loctype", "posType"];
    for (const f of lbsFlagFields) {
      if (f in data && data[f] !== null && data[f] !== undefined && data[f] !== "") {
        locateMode       = Number(data[f]) === 1 ? "lbs" : "gps";
        locateModeSource = `${f}=${data[f]}`;
        break;
      }
    }
  }

  // Numeric inverted: isGPS (1=GPS, 0=LBS)
  if (locateMode === "unknown") {
    const gpsFlag = ["isGPS", "isGps", "isGps"];
    for (const f of gpsFlag) {
      if (f in data && data[f] !== null && data[f] !== undefined && data[f] !== "") {
        locateMode       = Number(data[f]) === 1 ? "gps" : "lbs";
        locateModeSource = `${f}=${data[f]}`;
        break;
      }
    }
  }

  // String type field
  if (locateMode === "unknown" && "type" in data) {
    const t = String(data.type ?? "").trim().toUpperCase();
    if (t === "GPS" || t === "1") { locateMode = "gps"; locateModeSource = `type="${data.type}"`; }
    else if (t === "LBS" || t === "0") { locateMode = "lbs"; locateModeSource = `type="${data.type}"`; }
  }

  // Status string contains "GPS" or "LBS" (e.g. "GPS Stop", "LBS Moving")
  if (locateMode === "unknown" && data.status) {
    const s = String(data.status).toUpperCase();
    if (s.includes("GPS")) { locateMode = "gps"; locateModeSource = `status="${data.status}"`; }
    else if (s.includes("LBS")) { locateMode = "lbs"; locateModeSource = `status="${data.status}"`; }
  }

  // Stop duration — try stopTimeMinute (numeric, confirmed in GetDevicesHistory) then stopTime (string)
  let stopMinutes: number | null = null;
  if ("stopTimeMinute" in data && data.stopTimeMinute !== null && data.stopTimeMinute !== "") {
    const n = Number(data.stopTimeMinute);
    if (!isNaN(n) && n >= 0) stopMinutes = n;
  }
  if (stopMinutes === null) {
    const stopRaw = data.stopTime ?? data.stopDuration ?? data.stoppedTime;
    if (stopRaw !== undefined && stopRaw !== null && stopRaw !== "") {
      stopMinutes = typeof stopRaw === "number"
        ? (stopRaw >= 0 ? stopRaw : null)
        : parseGps903StopString(String(stopRaw));
    }
  }

  // 903's own move/stop determination — more reliable than the speed field,
  // which some firmwares report as 0 even while driving. Prefer the numeric
  // isStop flag, fall back to the status string ("Stop"/"Move").
  let isStop: boolean | null = null;
  if ("isStop" in data && data.isStop !== null && data.isStop !== "") {
    isStop = Number(data.isStop) === 1;
  } else if (data.status) {
    const s = String(data.status).toLowerCase();
    if (s.includes("stop")) isStop = true;
    else if (s.includes("move") || s.includes("run") || s.includes("driv")) isStop = false;
  }

  const result: TrackingResult = {
    lat,
    lng,
    speed:       parseFloat(String(data.speed)) || 0,
    course:      Number(data.course) || 0,
    battery,
    ignition,
    fixTime:     String(data.deviceUtcDate ?? new Date().toISOString()),
    locateMode,
    stopMinutes,
    isStop,
  };

  console.log(
    `[GPS903] GetTracking device ${deviceId} — lat:${lat.toFixed(5)} lng:${lng.toFixed(5)} ` +
    `speed:${result.speed} battery:${battery ?? "?"} ignition:${ignition} ` +
    `locateMode:${locateMode} (source:${locateModeSource}) status:${data.status ?? "?"}`,
  );

  return result;
}
