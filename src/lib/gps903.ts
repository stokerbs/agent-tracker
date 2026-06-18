/**
 * Shared GPS903 Web API client.
 * Used by: /api/cron/gps903-sync  and  /gps-devices server actions.
 *
 * Login mode: IMEI No. tab (txtImeiNo / txtImeiPassword / btnLoginImei).
 *
 * IMPORTANT — actual GPS903 behavior (confirmed by live probe 2026-06-18):
 *   - Login always returns HTTP 200 (both success and failure)
 *   - Success indicator: .ASPXAUTH cookie present in Set-Cookie response headers
 *   - Failure indicator: only ASP.NET_SessionId is set, no .ASPXAUTH
 *   - GetTracking response: {"d": "{unquoted JS object literal}"} — NOT valid JSON
 *     Must eval with Function(), not JSON.parse()
 *   - Field names: latitude/longitude (not lat/lng), speed is a string, dataContext="ACC,battery%,alarm"
 *   - GetDevicesByUserID returns HTTP 500 for IMEI-scoped sessions (device-level login)
 *
 * Session management: per-credential (one ASP.NET session per device IMEI).
 * Sessions are cached in gps903_credential_sessions keyed by gps903_credentials.id.
 */

import { createServiceClient } from "@/lib/supabase/server";

export const GPS903_BASE     = "http://www.gps903.net";
export const GPS903_TIMEZONE = "Asia/Bangkok";
const SESSION_TTL_MS         = 25 * 60 * 1000;
const FETCH_TIMEOUT          = 10_000;

type SvcClient = ReturnType<typeof createServiceClient>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function extractHiddenInput(html: string, name: string): string {
  const m =
    html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "i")) ??
    html.match(new RegExp(`value="([^"]*)"[^>]*name="${name}"`, "i"));
  return m?.[1] ?? "";
}

/**
 * Parse the GPS903 "d" field.
 * GPS903 ASMX services return {"d": "{unquoted JS object literal}"} —
 * the inner string uses unquoted property names and is NOT valid JSON.
 * We evaluate it in strict mode (trusted internal GPS tracker data).
 */
function parseGps903Value(str: string): Record<string, unknown> | unknown[] | null {
  try {
    // eslint-disable-next-line no-new-func
    return new Function('"use strict"; return (' + str + ')')() as Record<string, unknown> | unknown[];
  } catch {
    return null;
  }
}

/**
 * Extract all meaningful cookies from a Response, deduplicated by name.
 * Uses getSetCookie() (Node 20+) for correct multi-header handling.
 * Returns "Name=value; Name2=value2" or null if none found.
 */
function extractAllCookies(response: Response): string | null {
  const seen    = new Set<string>();
  const parts: string[] = [];

  const headers = response.headers as unknown as { getSetCookie?(): string[] };
  const setCookies: string[] = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : (response.headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).map((s) => s.trim());

  for (const h of setCookies) {
    const nameValue  = h.split(";")[0]?.trim() ?? "";
    const cookieName = nameValue.split("=")[0]?.trim() ?? "";
    if (nameValue.includes("=") && cookieName && !seen.has(cookieName)) {
      seen.add(cookieName);
      parts.push(nameValue);
    }
  }

  return parts.length ? parts.join("; ") : null;
}

/** Returns true when a cookie string contains a valid .ASPXAUTH ticket. */
function hasAuthTicket(cookies: string | null): boolean {
  if (!cookies) return false;
  return cookies.toLowerCase().split(";").some((c) => c.trim().toLowerCase().startsWith(".aspxauth="));
}


// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * POST Login.aspx using the IMEI No. tab.
 *
 * Live-confirmed form fields: txtImeiNo, txtImeiPassword, btnLoginImei
 *
 * Success/failure both return HTTP 200 — distinguish by .ASPXAUTH cookie:
 *   Success: ASP.NET_SessionId + .ASPXAUTH + Language cookies set
 *   Failure: only ASP.NET_SessionId set, no .ASPXAUTH
 *
 * Returns deduplicated Cookie header string or null on failure.
 */
export async function gps903Login(
  imei: string,
  devicePassword: string,
): Promise<string | null> {
  const loginUrl = `${GPS903_BASE}/Login.aspx?language=en-us`;
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  console.log(`[GPS903] Login attempt — IMEI prefix: ${imei.slice(0, 6)}***`);

  // Step 1: GET login page to extract ASP.NET hidden form fields
  let html: string;
  let getRes: Response;
  try {
    getRes = await fetch(loginUrl, {
      headers:  { "User-Agent": ua },
      redirect: "manual",
      signal:   withTimeout(FETCH_TIMEOUT),
    });
    html = await getRes.text();
    console.log(`[GPS903] Login page GET — HTTP ${getRes.status}, ${html.length} bytes`);
  } catch (e) {
    console.error("[GPS903] Login page GET failed:", String(e));
    return null;
  }

  const viewState = extractHiddenInput(html, "__VIEWSTATE");
  if (!viewState) {
    console.error("[GPS903] Login aborted — could not extract __VIEWSTATE");
    return null;
  }

  const body = new URLSearchParams({
    __VIEWSTATE:          viewState,
    __VIEWSTATEGENERATOR: extractHiddenInput(html, "__VIEWSTATEGENERATOR"),
    __EVENTVALIDATION:    extractHiddenInput(html, "__EVENTVALIDATION"),
    txtImeiNo:            imei,
    txtImeiPassword:      devicePassword,
    btnLoginImei:         "",
  });

  // Step 2: POST IMEI login form
  let postRes: Response;
  try {
    postRes = await fetch(loginUrl, {
      method:   "POST",
      headers:  {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":   ua,
      },
      body:     body.toString(),
      redirect: "manual",
      signal:   withTimeout(FETCH_TIMEOUT),
    });
    console.log(`[GPS903] Login POST — HTTP ${postRes.status}`);
  } catch (e) {
    console.error("[GPS903] Login POST failed:", String(e));
    return null;
  }

  // Step 3: Extract cookies — success = .ASPXAUTH present (HTTP status is 200 for both outcomes)
  const fullCookie = extractAllCookies(postRes);
  const names      = fullCookie?.split(";").map((c) => c.trim().split("=")[0]).join(", ") ?? "none";
  console.log(`[GPS903] Cookies received: ${names}`);

  if (!hasAuthTicket(fullCookie)) {
    console.error("[GPS903] Login failed — .ASPXAUTH not set (wrong IMEI or device password)");
    return null;
  }

  console.log("[GPS903] Login successful — .ASPXAUTH confirmed");
  return fullCookie!;
}

// ── GetTracking ───────────────────────────────────────────────────────────────

export interface TrackingResult {
  lat:      number;
  lng:      number;
  speed:    number;        // km/h
  course:   number;        // degrees 0–360
  battery:  number | null; // percent (from dataContext[1])
  ignition: boolean;       // ACC on/off (from dataContext[0])
  fixTime:  string;        // deviceUtcDate as-is
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

  const result: TrackingResult = {
    lat,
    lng,
    speed:    parseFloat(String(data.speed)) || 0,
    course:   Number(data.course) || 0,
    battery,
    ignition,
    fixTime:  String(data.deviceUtcDate ?? new Date().toISOString()),
  };

  console.log(
    `[GPS903] GetTracking device ${deviceId} — lat:${lat.toFixed(5)} lng:${lng.toFixed(5)} ` +
    `speed:${result.speed} battery:${battery ?? "?"} ignition:${ignition} status:${data.status ?? "?"}`,
  );

  return result;
}

// ── GetDevicesHistory ─────────────────────────────────────────────────────────

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
  } catch {
    return [];
  }

  if (!res.ok) return [];

  let envelope: { d?: string };
  try { envelope = await res.json() as { d?: string }; } catch { return []; }
  if (!envelope.d) return [];

  const data = parseGps903Value(envelope.d);
  const points = (Array.isArray(data) ? data : (data as Record<string, unknown> | null)?.devices) as unknown[];
  if (!Array.isArray(points)) return [];

  return (points as Record<string, unknown>[])
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
}

// ── Device ID auto-detection ─────────────────────────────────────────────────

/**
 * Attempt to extract the GPS903 integer Device ID from the tracking page.
 *
 * After an IMEI login, GPS903 scopes the session to the logged-in device.
 * The tracking page embeds the device ID in JavaScript globals or data attrs.
 * We parse those patterns rather than requiring the operator to look it up manually.
 *
 * Returns the detected device ID, or null if parsing fails (falls back to manual entry).
 */
export async function detectGps903DeviceId(sessionCookie: string): Promise<number | null> {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  // Pages to probe, in preference order
  const candidates = [
    `${GPS903_BASE}/Track.aspx?language=en-us`,
    `${GPS903_BASE}/Default.aspx`,
    `${GPS903_BASE}/`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers:  { "Cookie": sessionCookie, "User-Agent": ua },
        redirect: "follow",
        signal:   withTimeout(FETCH_TIMEOUT),
      });

      if (!res.ok) {
        console.log(`[GPS903] detectDeviceId — ${url} → HTTP ${res.status}, skipping`);
        continue;
      }

      const html = await res.text();
      console.log(`[GPS903] detectDeviceId — ${url} (${html.length} bytes)`);

      // GPS903 embeds the device ID as a JS integer in various forms.
      // Ordered from most specific to broadest to minimise false positives.
      const patterns = [
        /["']DeviceID["']\s*[,:]\s*(\d{5,8})/gi,
        /DeviceID\s*=\s*(\d{5,8})/gi,
        /["']deviceId["']\s*[,:]\s*(\d{5,8})/gi,
        /deviceId\s*=\s*(\d{5,8})/gi,
        /var\s+(?:deviceID|DeviceID|deviceId)\s*=\s*(\d{5,8})/gi,
        /GetTracking[^}]{0,120}?(\d{5,8})/gi,
        /DeviceID[^\d]{1,8}(\d{5,8})/gi,
      ];

      const freq = new Map<number, number>();
      for (const pattern of patterns) {
        for (const match of html.matchAll(pattern)) {
          const id = Number(match[1]);
          if (id > 0) freq.set(id, (freq.get(id) ?? 0) + 1);
        }
      }

      if (freq.size > 0) {
        const [[bestId]] = [...freq.entries()].sort((a, b) => b[1] - a[1]);
        console.log(
          `[GPS903] detectDeviceId — found ${bestId} ` +
          `(${freq.get(bestId)} pattern matches across ${freq.size} candidate(s))`,
        );
        return bestId;
      }
    } catch (e) {
      console.warn(`[GPS903] detectDeviceId — ${url} error:`, String(e));
    }
  }

  console.log("[GPS903] detectDeviceId — no device ID found in any page");
  return null;
}

// ── Per-credential session cache ─────────────────────────────────────────────
// Each GPS903 device has its own IMEI login → distinct ASP.NET session.
// Sessions are cached in gps903_credential_sessions keyed by credential UUID.

export interface Gps903CredentialForSession {
  id:              string;
  imei:            string;
  device_password: string;
}

/**
 * Return a valid ASP.NET session cookie for one credential.
 * Checks gps903_credential_sessions for a non-expired, auth-ticket-bearing cookie.
 * On cache miss or expiry, performs a fresh IMEI login and caches the result.
 */
export async function getOrRefreshCredentialSession(
  svc: SvcClient,
  credential: Gps903CredentialForSession,
): Promise<string | null> {
  const { data: cached } = await svc
    .from("gps903_credential_sessions")
    .select("session_cookie, expires_at")
    .eq("credential_id", credential.id)
    .maybeSingle();

  if (
    cached &&
    new Date(cached.expires_at) > new Date() &&
    hasAuthTicket(cached.session_cookie)
  ) {
    console.log(`[GPS903] Using cached session for credential ${credential.id.slice(0, 8)}`);
    return cached.session_cookie;
  }

  console.log(`[GPS903] Session cache miss for credential ${credential.id.slice(0, 8)} — logging in`);
  const fresh = await gps903Login(credential.imei, credential.device_password);
  if (!fresh) return null;

  await svc.from("gps903_credential_sessions").upsert({
    credential_id:  credential.id,
    session_cookie: fresh,
    expires_at:     new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    updated_at:     new Date().toISOString(),
  });

  console.log(`[GPS903] Session cached for credential ${credential.id.slice(0, 8)}`);
  return fresh;
}

// ── Device position update ────────────────────────────────────────────────────

/**
 * Write a GPS tracking result to the device position history and update
 * the denormalized last-known position on gps_devices.
 *
 * GPS devices are independent entities — this does NOT update the agents table.
 * Agent locations come from the agent's own mobile GPS reporter or Traccar.
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
    last_lat:        pos.lat,
    last_lng:        pos.lng,
    last_speed_kmh:  pos.speed,
    last_heading:    heading,
    last_seen_at:    now,
    last_polled_at:  now,
    last_poll_ok:    true,
  };
  if (pos.battery !== null) deviceUpdate.last_battery_pct = pos.battery;

  await Promise.all([
    svc.from("gps_device_positions").insert(posRow),
    svc.from("gps_devices").update(deviceUpdate).eq("id", gpsDeviceId),
  ]);

  console.log(
    `[GPS903] Position written — device ${gpsDeviceId} ` +
    `lat:${pos.lat.toFixed(5)} lng:${pos.lng.toFixed(5)} speed:${pos.speed} battery:${pos.battery ?? "?"}`,
  );
}
