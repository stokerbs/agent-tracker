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

/** Diagnostic snapshot of GPS903-related env vars (values never logged). */
export function gps903EnvCheck() {
  return {
    GPS903_IMEI:            !!process.env.GPS903_IMEI,
    GPS903_DEVICE_PASSWORD: !!process.env.GPS903_DEVICE_PASSWORD,
    CRON_SECRET:            !!process.env.CRON_SECRET,
  };
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

// ── Device catalog ────────────────────────────────────────────────────────────

export interface Gps903DeviceCatalog {
  gps903DeviceId: number;
  deviceName:     string | null;
  imei:           string | null;
  model:          string | null;
  lastSeen:       string | null;
}

/**
 * Fetch all devices registered under the current GPS903 account.
 * NOTE: This endpoint returns HTTP 500 for IMEI-scoped sessions (device-level login).
 * It requires an account-level session. Returns [] gracefully on any error.
 */
export async function gps903GetDevicesByUserID(
  sessionCookie: string,
): Promise<Gps903DeviceCatalog[]> {
  let res: Response;
  try {
    res = await fetch(`${GPS903_BASE}/Ajax/DevicesAjax.asmx/GetDevicesByUserID`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Cookie": sessionCookie },
      body:    JSON.stringify({ UserID: 0 }),
      signal:  withTimeout(FETCH_TIMEOUT),
    });
  } catch {
    return [];
  }

  console.log(`[GPS903] GetDevicesByUserID — HTTP ${res.status}`);
  if (!res.ok) {
    console.log(`[GPS903] GetDevicesByUserID failed (HTTP ${res.status}) — IMEI sessions are device-scoped`);
    return [];
  }

  let envelope: { d?: string };
  try { envelope = await res.json() as { d?: string }; } catch { return []; }
  if (!envelope.d) return [];

  const data = parseGps903Value(envelope.d);
  if (!Array.isArray(data)) return [];

  const devices = (data as Record<string, unknown>[])
    .filter((d) => d.DeviceID != null)
    .map((d) => ({
      gps903DeviceId: Number(d.DeviceID),
      deviceName:     d.DeviceName    ? String(d.DeviceName)    : null,
      imei:           d.IMEI          ? String(d.IMEI)          : null,
      model:          d.Model         ? String(d.Model)         : null,
      lastSeen:       d.DeviceUtcDate ? String(d.DeviceUtcDate) : null,
    }))
    .filter((d) => !isNaN(d.gps903DeviceId));

  console.log(`[GPS903] GetDevicesByUserID — ${devices.length} devices`);
  return devices;
}

// ── Session cache ─────────────────────────────────────────────────────────────

export async function getCachedSession(svc: SvcClient): Promise<string | null> {
  const { data } = await svc
    .from("gps903_session")
    .select("session_cookie, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at) <= new Date()) {
    console.log("[GPS903] Cached session expired");
    return null;
  }

  // Require .ASPXAUTH in cached value — discard old-format bare session IDs
  if (!hasAuthTicket(data.session_cookie)) {
    console.log("[GPS903] Cached session missing .ASPXAUTH — forcing re-login");
    return null;
  }

  console.log("[GPS903] Using cached session");
  return data.session_cookie;
}

export async function cacheSession(svc: SvcClient, cookie: string): Promise<void> {
  await svc.from("gps903_session").upsert({
    id:             1,
    session_cookie: cookie,
    expires_at:     new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    updated_at:     new Date().toISOString(),
  });
}

/** Returns a valid session cookie string or null if login fails / credentials missing. */
export async function getOrRefreshSession(svc: SvcClient): Promise<string | null> {
  const cached = await getCachedSession(svc);
  if (cached) return cached;

  const imei           = process.env.GPS903_IMEI;
  const devicePassword = process.env.GPS903_DEVICE_PASSWORD;

  console.log("[GPS903] Env check:", {
    GPS903_IMEI:            !!imei,
    GPS903_DEVICE_PASSWORD: !!devicePassword,
    CRON_SECRET:            !!process.env.CRON_SECRET,
  });

  if (!imei || !devicePassword) {
    console.error("[GPS903] Cannot login — GPS903_IMEI or GPS903_DEVICE_PASSWORD not set");
    return null;
  }

  console.log("[GPS903] Session cache miss — attempting fresh login");
  const fresh = await gps903Login(imei, devicePassword);

  if (!fresh) {
    console.error("[GPS903] Fresh login failed — check IMEI and device password");
    return null;
  }

  await cacheSession(svc, fresh);
  console.log("[GPS903] Session refreshed and cached");
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
