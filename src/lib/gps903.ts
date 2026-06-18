/**
 * Shared GPS903 Web API client.
 * Used by: /api/cron/gps903-sync  and  /gps-devices server actions.
 *
 * Login mode: IMEI No. tab (txtImeiNo / txtImeiPassword / btnLoginImei).
 * Successful login → HTTP 302 redirect + Set-Cookie with session + auth ticket.
 * Failed login    → HTTP 200 (login page again) — session ID extracted would be unauthenticated.
 */

import { createServiceClient } from "@/lib/supabase/server";

export const GPS903_BASE     = "http://www.gps903.net";
export const GPS903_TIMEZONE = "Asia/Bangkok";
const SESSION_TTL_MS         = 25 * 60 * 1000; // pessimistic 25-min TTL
const FETCH_TIMEOUT          = 8_000;

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
 * Extract all meaningful cookies (name=value pairs) from a Response.
 * Uses getSetCookie() (Node 20+ standard) for correct multi-header handling,
 * with a regex fallback for the joined Set-Cookie string.
 * Returns a full Cookie header value, e.g. "ASP.NET_SessionId=abc; .ASPXAUTH=xyz"
 * or null if no session-relevant cookies are found.
 */
function extractAllCookies(response: Response): string | null {
  const cookies: string[] = [];

  // getSetCookie() is available in Node 20+ and returns each Set-Cookie header separately
  if (typeof (response.headers as unknown as Record<string, unknown>).getSetCookie === "function") {
    const setCookies = (response.headers as unknown as { getSetCookie(): string[] }).getSetCookie();
    for (const header of setCookies) {
      const nameValue = header.split(";")[0]?.trim() ?? "";
      if (nameValue.includes("=")) cookies.push(nameValue);
    }
  } else {
    // Fallback: parse the (potentially joined) Set-Cookie header value
    const combined = response.headers.get("set-cookie") ?? "";
    for (const pattern of [/ASP\.NET_SessionId=[^;,]+/i, /\.ASPXAUTH=[^;,]+/i]) {
      const m = combined.match(pattern);
      if (m) cookies.push(m[0]);
    }
  }

  if (cookies.length === 0) return null;
  return cookies.join("; ");
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
 * Form fields confirmed from live inspection:
 *   txtImeiNo, txtImeiPassword, btnLoginImei
 *
 * Success indicator: HTTP 302 redirect (server redirects to dashboard).
 * Failure indicator: HTTP 200 (server returns login page again).
 *
 * Returns a full Cookie header string (e.g. "ASP.NET_SessionId=…; .ASPXAUTH=…")
 * or null on failure.
 */
export async function gps903Login(
  imei: string,
  devicePassword: string,
): Promise<string | null> {
  const loginUrl = `${GPS903_BASE}/Login.aspx?language=en-us`;
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  console.log(`[GPS903] Login attempt — IMEI prefix: ${imei.slice(0, 6)}***`);

  // Step 1: GET the login page to extract ASP.NET hidden form fields
  let html: string;
  let getRes: Response;
  try {
    getRes = await fetch(loginUrl, {
      headers: { "User-Agent": ua },
      redirect: "manual",
      signal: withTimeout(FETCH_TIMEOUT),
    });
    html = await getRes.text();
    console.log(`[GPS903] Login page GET — HTTP ${getRes.status}, ${html.length} bytes`);
  } catch (e) {
    console.error("[GPS903] Login page GET failed:", String(e));
    return null;
  }

  const viewState = extractHiddenInput(html, "__VIEWSTATE");
  if (!viewState) {
    console.error("[GPS903] Login aborted — could not extract __VIEWSTATE from login page");
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

  // Step 2: POST the IMEI login form
  let postRes: Response;
  try {
    postRes = await fetch(loginUrl, {
      method:   "POST",
      headers: {
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

  // GPS903 returns HTTP 302 on success, HTTP 200 on failure.
  // A 200 here means wrong credentials — even though it sets ASP.NET_SessionId,
  // that session is unauthenticated and API calls will return empty/error data.
  if (postRes.status !== 302) {
    console.error(`[GPS903] Login failed — expected HTTP 302, got ${postRes.status} (wrong IMEI or password)`);
    return null;
  }

  // Step 3: Extract all session cookies from the redirect response
  const fullCookie = extractAllCookies(postRes);
  const redacted   = fullCookie?.replace(/=([^;]+)/g, "=***") ?? "none";
  console.log(`[GPS903] Cookies from login response: ${redacted}`);

  if (!fullCookie) {
    console.error("[GPS903] Login response was 302 but contained no session cookies");
    return null;
  }

  console.log("[GPS903] Login successful");
  return fullCookie;
}

// ── GetTracking ───────────────────────────────────────────────────────────────

export interface TrackingResult {
  lat:      number;
  lng:      number;
  speed:    number;        // km/h
  course:   number;        // degrees 0–360
  battery:  number | null; // percent
  ignition: boolean;
  fixTime:  string;        // GPS903 "deviceUtcDate" as-is
}

export async function gps903GetTracking(
  sessionCookie: string,
  deviceId: number,
): Promise<TrackingResult | null> {
  let res: Response;
  try {
    res = await fetch(`${GPS903_BASE}/Ajax/DevicesAjax.asmx/GetTracking`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie":        sessionCookie,
      },
      body:   JSON.stringify({ DeviceID: deviceId, TimeZone: GPS903_TIMEZONE }),
      signal: withTimeout(FETCH_TIMEOUT),
    });
  } catch (e) {
    console.error(`[GPS903] GetTracking device ${deviceId} fetch error:`, String(e));
    return null;
  }

  console.log(`[GPS903] GetTracking device ${deviceId} — HTTP ${res.status}`);
  if (!res.ok) return null;

  let json: { d?: string };
  try { json = await res.json(); } catch { return null; }
  if (!json.d) {
    console.log(`[GPS903] GetTracking device ${deviceId} — empty response (session may be expired)`);
    return null;
  }

  let data: Record<string, unknown>;
  try { data = JSON.parse(json.d); } catch { return null; }

  // Guard: Number(null)===0 which passes isNaN, so check for null first
  if (data.lat == null || data.lng == null) {
    console.log(`[GPS903] GetTracking device ${deviceId} — null coordinates`);
    return null;
  }
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (isNaN(lat) || isNaN(lng)) return null;

  // ct = "ACC-alarm-fortify-door-battery%" e.g. "1-0-0-0-87"
  let battery:  number | null = null;
  let ignition: boolean       = false;
  const ct = String(data.ct ?? "");
  if (ct) {
    const parts = ct.split("-");
    ignition = parts[0] === "1";
    const raw = Number(parts[4]);
    if (!isNaN(raw) && raw >= 0 && raw <= 100) battery = raw;
  }

  const result: TrackingResult = {
    lat,
    lng,
    speed:    Number(data.speed)  || 0,
    course:   Number(data.course) || 0,
    battery,
    ignition,
    fixTime:  String(data.deviceUtcDate ?? new Date().toISOString()),
  };

  console.log(
    `[GPS903] GetTracking device ${deviceId} — lat:${lat.toFixed(5)} lng:${lng.toFixed(5)} ` +
    `speed:${result.speed} battery:${battery ?? "?"} ignition:${ignition}`,
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
      headers: {
        "Content-Type": "application/json",
        "Cookie":        sessionCookie,
      },
      body: JSON.stringify({
        DeviceID: deviceId, Start: start, End: end,
        TimeZone: GPS903_TIMEZONE, ShowLBS: 1,
      }),
      signal: withTimeout(FETCH_TIMEOUT),
    });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  let json: { d?: string };
  try { json = await res.json(); } catch { return []; }
  if (!json.d) return [];

  let data: { devices?: unknown[] };
  try { data = JSON.parse(json.d); } catch { return []; }
  if (!Array.isArray(data.devices)) return [];

  return (data.devices as Record<string, unknown>[])
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      lat:         Number(p.lat),
      lng:         Number(p.lng),
      speed:       Number(p.speed)           || 0,
      course:      Number(p.course)          || 0,
      fixTime:     String(p.deviceUtcDate    ?? ""),
      stopMinutes: Number(p.stopTimeMinute)  || 0,
    }))
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lng));
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

  // Backward compat: old format stored just the session ID value (no "=").
  // New format stores the full cookie string. Discard old-format entries.
  if (!data.session_cookie.includes("=")) {
    console.log("[GPS903] Cached session is in legacy format — forcing re-login");
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

  // Log env var status on every cache miss (visible in Vercel function logs)
  console.log("[GPS903] Env check:", {
    GPS903_IMEI:            !!imei,
    GPS903_DEVICE_PASSWORD: !!devicePassword,
    CRON_SECRET:            !!process.env.CRON_SECRET,
  });

  if (!imei || !devicePassword) {
    console.error("[GPS903] Cannot login — GPS903_IMEI or GPS903_DEVICE_PASSWORD not set in environment");
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
 * Calls GetDevicesByUserID (UserID=0 → current session user).
 * Returns [] on any error.
 */
export async function gps903GetDevicesByUserID(
  sessionCookie: string,
): Promise<Gps903DeviceCatalog[]> {
  let res: Response;
  try {
    res = await fetch(`${GPS903_BASE}/Ajax/DevicesAjax.asmx/GetDevicesByUserID`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie":        sessionCookie,
      },
      body:   JSON.stringify({ UserID: 0 }),
      signal: withTimeout(FETCH_TIMEOUT),
    });
  } catch {
    return [];
  }

  console.log(`[GPS903] GetDevicesByUserID — HTTP ${res.status}`);
  if (!res.ok) return [];

  let json: { d?: string };
  try { json = await res.json(); } catch { return []; }
  if (!json.d) return [];

  let data: unknown;
  try { data = JSON.parse(json.d); } catch { return []; }
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

  console.log(`[GPS903] GetDevicesByUserID — ${devices.length} devices returned`);
  return devices;
}

// ── Agent position update ─────────────────────────────────────────────────────

/**
 * Applies a GPS tracking result to the linked agent row.
 * Mirrors the mobile GPS reporter status-transition logic.
 */
export async function applyPositionToAgent(
  svc: SvcClient,
  agentId: string,
  pos: TrackingResult,
): Promise<void> {
  const { data: agent } = await svc
    .from("agents")
    .select("status")
    .eq("id", agentId)
    .maybeSingle();

  const currentStatus = agent?.status ?? "offline";
  let newStatus = currentStatus;

  if (currentStatus !== "emergency") {
    if (currentStatus === "offline") {
      newStatus = pos.speed > 1 ? "moving" : "online";
    } else if (pos.speed > 1) {
      newStatus = "moving";
    } else if (currentStatus === "moving") {
      newStatus = "online";
    }
  }

  const heading = Math.round(pos.course) % 360;
  const update: Record<string, unknown> = {
    current_lat: pos.lat,
    current_lng: pos.lng,
    last_active: new Date().toISOString(),
    speed_kmh:   pos.speed,
    heading,
    status:      newStatus,
  };
  if (pos.battery !== null) update.battery_pct = pos.battery;

  await Promise.all([
    svc.from("agents").update(update).eq("id", agentId),
    svc.from("agent_location_history").insert({
      agent_id:  agentId,
      lat:       pos.lat,
      lng:       pos.lng,
      speed_kmh: pos.speed,
      heading,
    }),
  ]);
}
