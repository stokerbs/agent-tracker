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
  lat:         number;
  lng:         number;
  speed:       number;               // km/h
  course:      number;               // degrees 0–360
  battery:     number | null;        // percent (from dataContext[1])
  ignition:    boolean;              // ACC on/off (from dataContext[0])
  fixTime:     string;               // deviceUtcDate as-is
  locateMode:  "gps" | "lbs" | "unknown"; // gps = satellite fix; lbs = cell tower; unknown = field absent
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

  // GPS903 reports locate mode via isLBS:
  //   isLBS === 0  → GPS satellite fix
  //   isLBS === 1  → LBS cell-tower fallback (less accurate)
  //   field absent → unknown (treat conservatively as unknown)
  let locateMode: "gps" | "lbs" | "unknown" = "unknown";
  if ("isLBS" in data) {
    locateMode = Number(data.isLBS) === 1 ? "lbs" : "gps";
  }

  const result: TrackingResult = {
    lat,
    lng,
    speed:      parseFloat(String(data.speed)) || 0,
    course:     Number(data.course) || 0,
    battery,
    ignition,
    fixTime:    String(data.deviceUtcDate ?? new Date().toISOString()),
    locateMode,
  };

  console.log(
    `[GPS903] GetTracking device ${deviceId} — lat:${lat.toFixed(5)} lng:${lng.toFixed(5)} ` +
    `speed:${result.speed} battery:${battery ?? "?"} ignition:${ignition} ` +
    `locateMode:${locateMode} status:${data.status ?? "?"}`,
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

// ── Device ID discovery ──────────────────────────────────────────────────────

export interface Gps903DiagEntry {
  source:       string;        // endpoint key or page label
  status:       number | null; // HTTP status, null if fetch threw
  rawPreview:   string;        // first 700 chars of raw response body
  candidateIds: number[];      // device IDs extracted from this source
  note?:        string;        // e.g. redirect destination, locationID value
  error?:       string;
}

export interface Gps903DiscoveryResult {
  deviceId:    number | null;
  method:      string | null;    // which probe found it
  diagnostics: Gps903DiagEntry[];
}

/**
 * Extract integer device ID candidates from any text (HTML, JSON, JS, URL).
 * Uses broad context-specific patterns. Keeps numbers in [1, 99_999_999].
 */
function extractDeviceIdCandidates(text: string): number[] {
  const patterns: RegExp[] = [
    // JSON / JS object key–value
    /["']DeviceID["']\s*[,:]\s*(\d+)/gi,
    /["']deviceId["']\s*[,:]\s*(\d+)/gi,
    /["']DeviceId["']\s*[,:]\s*(\d+)/gi,
    /["']TrackerID["']\s*[,:]\s*(\d+)/gi,
    /["']trackerId["']\s*[,:]\s*(\d+)/gi,
    /["']LocationID["']\s*[,:]\s*(\d+)/gi,
    /["']locationID["']\s*[,:]\s*(\d+)/gi,
    // Unquoted JS object literal (GPS903 format)
    /\bDeviceID\s*:\s*(\d+)/gi,
    /\bdeviceId\s*:\s*(\d+)/gi,
    /\bLocationID\s*:\s*(\d+)/gi,
    /\blocID\s*:\s*(\d+)/gi,
    // Variable assignment
    /\bvar\s+\w*[Dd]evice(?:ID|Id)?\w*\s*=\s*(\d+)/gi,
    /\bvar\s+\w*[Tt]racker(?:ID|Id)?\w*\s*=\s*(\d+)/gi,
    /\bDeviceID\s*=\s*(\d+)/gi,
    /\bdeviceId\s*=\s*(\d+)/gi,
    // HTML data attributes
    /data-device[-_]?id\s*=\s*["']?(\d+)/gi,
    /data-tracker[-_]?id\s*=\s*["']?(\d+)/gi,
    // URL query params
    /[?&]DeviceID=(\d+)/gi,
    /[?&]deviceId=(\d+)/gi,
    // Function call context
    /GetTracking[^}]{0,200}?(\d{4,9})/gi,
    /DeviceID[^\d]{1,10}(\d{4,9})/gi,
  ];

  const seen = new Set<number>();
  for (const pat of patterns) {
    for (const m of text.matchAll(pat)) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 99_999_999) seen.add(n);
    }
  }
  return [...seen];
}

/**
 * Full systematic GPS903 Device ID discovery.
 *
 * Tries every plausible approach in order, stops as soon as one succeeds:
 *   1. ASMX service description — discovers the full web method list
 *   2. ~16 ASMX endpoint probes — some return device listings without needing a device ID
 *   3. HTML page probes — follow redirects, scan JS content, extract JS file URLs
 *   4. Inline JS files referenced from those pages
 *
 * All responses are logged and returned as diagnostics so operators can
 * inspect what GPS903 is actually returning even when auto-detection fails.
 */
export async function runGps903Discovery(
  sessionCookie: string,
  imei: string,
): Promise<Gps903DiscoveryResult> {
  const ua                 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  const diag: Gps903DiagEntry[] = [];
  let   deviceId: number | null = null;
  let   method:   string | null = null;

  function record(entry: Gps903DiagEntry): void {
    diag.push(entry);
    const cStr = entry.candidateIds.length ? `[${entry.candidateIds.join(",")}]` : "—";
    console.log(
      `[GPS903 discovery] ${entry.source} ` +
      `HTTP:${entry.status ?? "ERR"} candidates:${cStr}` +
      (entry.note  ? ` note:${entry.note}`   : "") +
      (entry.error ? ` error:${entry.error}` : ""),
    );
    if (deviceId === null && entry.candidateIds.length > 0) {
      const freq = new Map<number, number>();
      for (const id of entry.candidateIds) freq.set(id, (freq.get(id) ?? 0) + 1);
      const [[best]] = [...freq.entries()].sort((a, b) => b[1] - a[1]);
      deviceId = best;
      method   = entry.source;
      console.log(`[GPS903 discovery] ✓ Device ID ${deviceId} found via ${method}`);
    }
  }

  // ── 1. ASMX service description ────────────────────────────────────────────
  try {
    const res  = await fetch(`${GPS903_BASE}/Ajax/DevicesAjax.asmx`, {
      headers: { Cookie: sessionCookie, "User-Agent": ua },
      signal:  withTimeout(FETCH_TIMEOUT),
    });
    const text = await res.text();
    const methods = [...text.matchAll(/href="[^"]*[?&]op=(\w+)"/gi)].map((m) => m[1]);
    if (methods.length) console.log(`[GPS903 discovery] ASMX methods: ${methods.join(", ")}`);
    record({
      source:       "GET:DevicesAjax.asmx",
      status:       res.status,
      rawPreview:   text.slice(0, 700),
      candidateIds: extractDeviceIdCandidates(text),
      note:         methods.length ? `methods: ${methods.join(", ")}` : undefined,
    });
  } catch (e) {
    record({ source: "GET:DevicesAjax.asmx", status: null, rawPreview: "", candidateIds: [], error: String(e) });
  }

  // ── 2. ASMX endpoint probes ────────────────────────────────────────────────
  //
  // Why these specific endpoints:
  //   - GetAllDevices / GetDeviceList — list devices for the logged-in account
  //     (for IMEI sessions GPS903 might return just the one paired device)
  //   - GetDeviceByImei — IMEI-keyed lookup; could return {DeviceID: N, ...}
  //   - GetCurrentLocations / GetTrackingAll — position list; GPS903 may embed device IDs
  //   - GetTracking with DeviceID=0/-1 — IMEI sessions may ignore the param and return the
  //     session device; locationID in the response could be the real device ID
  //   - GetDevicesByUserID — HTTP 500 for IMEI sessions, but response body may contain hints
  //   - UserAjax.asmx endpoints — alternate service file that may list user's device(s)
  const ENDPOINTS = [
    { key: "GetAllDevices",             path: "Ajax/DevicesAjax.asmx/GetAllDevices",         body: {} },
    { key: "GetAllDevices+TZ",          path: "Ajax/DevicesAjax.asmx/GetAllDevices",         body: { TimeZone: GPS903_TIMEZONE } },
    { key: "GetDevices",                path: "Ajax/DevicesAjax.asmx/GetDevices",            body: {} },
    { key: "GetDeviceList",             path: "Ajax/DevicesAjax.asmx/GetDeviceList",         body: {} },
    { key: "GetCurrentLocations",       path: "Ajax/DevicesAjax.asmx/GetCurrentLocations",   body: { TimeZone: GPS903_TIMEZONE } },
    { key: "GetAllCurrentLocations",    path: "Ajax/DevicesAjax.asmx/GetAllCurrentLocations",body: { TimeZone: GPS903_TIMEZONE } },
    { key: "GetUserDevices",            path: "Ajax/DevicesAjax.asmx/GetUserDevices",        body: {} },
    { key: "GetDeviceInfo",             path: "Ajax/DevicesAjax.asmx/GetDeviceInfo",         body: {} },
    { key: "GetTrackingAll",            path: "Ajax/DevicesAjax.asmx/GetTrackingAll",        body: { TimeZone: GPS903_TIMEZONE } },
    { key: "GetDeviceCount",            path: "Ajax/DevicesAjax.asmx/GetDeviceCount",        body: {} },
    { key: "GetDeviceByImei",           path: "Ajax/DevicesAjax.asmx/GetDeviceByImei",       body: { Imei: imei } },
    { key: "GetDevicesByUserID",        path: "Ajax/DevicesAjax.asmx/GetDevicesByUserID",    body: {} },
    { key: "GetTracking:DeviceID=0",    path: "Ajax/DevicesAjax.asmx/GetTracking",           body: { DeviceID: 0,  TimeZone: GPS903_TIMEZONE } },
    { key: "GetTracking:DeviceID=-1",   path: "Ajax/DevicesAjax.asmx/GetTracking",           body: { DeviceID: -1, TimeZone: GPS903_TIMEZONE } },
    { key: "UserAjax:GetUserInfo",      path: "Ajax/UserAjax.asmx/GetUserInfo",              body: {} },
    { key: "UserAjax:GetDevices",       path: "Ajax/UserAjax.asmx/GetDevices",               body: {} },
  ];

  for (const ep of ENDPOINTS) {
    if (deviceId !== null) break;
    try {
      const res  = await fetch(`${GPS903_BASE}/${ep.path}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie, "User-Agent": ua },
        body:    JSON.stringify(ep.body),
        signal:  withTimeout(FETCH_TIMEOUT),
      });
      const text       = await res.text();
      const candidates = extractDeviceIdCandidates(text);
      let   note: string | undefined;

      // For GetTracking with special IDs: also surface the locationID field
      if (ep.key.startsWith("GetTracking:")) {
        try {
          const env = JSON.parse(text) as { d?: string };
          if (env.d) {
            const parsed = parseGps903Value(env.d) as Record<string, unknown> | null;
            if (parsed && !Array.isArray(parsed)) {
              const locId = Number(parsed.locationID);
              note = `locationID=${locId} lat=${parsed.latitude} lng=${parsed.longitude} status=${parsed.status}`;
              if (locId >= 1 && !candidates.includes(locId)) candidates.push(locId);
            }
          }
        } catch { /* ignore parse errors */ }
      }

      record({ source: `POST:${ep.key}`, status: res.status, rawPreview: text.slice(0, 700), candidateIds: candidates, note });
    } catch (e) {
      record({ source: `POST:${ep.key}`, status: null, rawPreview: "", candidateIds: [], error: String(e) });
    }
  }

  // ── 3. HTML page probes ────────────────────────────────────────────────────
  const HTML_PAGES = [
    { key: "page:/",                url: `${GPS903_BASE}/` },
    { key: "page:Default.aspx",     url: `${GPS903_BASE}/Default.aspx` },
    { key: "page:Track.aspx",       url: `${GPS903_BASE}/Track.aspx?language=en-us` },
    { key: "page:Map.aspx",         url: `${GPS903_BASE}/Map.aspx?language=en-us` },
    { key: "page:DeviceDetail.aspx",url: `${GPS903_BASE}/DeviceDetail.aspx` },
  ];

  for (const { key, url } of HTML_PAGES) {
    if (deviceId !== null) break;
    try {
      const res  = await fetch(url, {
        headers:  { Cookie: sessionCookie, "User-Agent": ua },
        redirect: "follow",
        signal:   withTimeout(FETCH_TIMEOUT),
      });
      const html       = await res.text();
      const candidates = extractDeviceIdCandidates(html);
      let   note: string | undefined;

      // The redirect destination URL may contain ?DeviceID=N
      if (res.url !== url) {
        note = `redirect → ${res.url}`;
        for (const c of extractDeviceIdCandidates(res.url)) {
          if (!candidates.includes(c)) candidates.push(c);
        }
      }

      // Probe up to 4 JS files referenced in this page
      const scriptSrcs = [...html.matchAll(/src=["']([^"']*\.js[^"'?#]*)/gi)]
        .map((m) => m[1])
        .slice(0, 4);

      for (const src of scriptSrcs) {
        const absUrl = src.startsWith("http") ? src : `${GPS903_BASE}/${src.replace(/^\//, "")}`;
        try {
          const jsRes = await fetch(absUrl, { headers: { "User-Agent": ua }, signal: withTimeout(6000) });
          const js    = await jsRes.text();
          const jsCands = extractDeviceIdCandidates(js);
          if (jsCands.length) {
            console.log(`[GPS903 discovery] ${key} JS ${src} → candidates: ${jsCands}`);
            for (const c of jsCands) if (!candidates.includes(c)) candidates.push(c);
          }
        } catch { /* JS fetch failures are non-fatal */ }
      }

      record({
        source:       key,
        status:       res.status,
        rawPreview:   html.slice(0, 700),
        candidateIds: candidates,
        note,
      });
    } catch (e) {
      record({ source: key, status: null, rawPreview: "", candidateIds: [], error: String(e) });
    }
  }

  if (deviceId === null) {
    console.log("[GPS903 discovery] No device ID found after exhausting all probes");
  }

  return { deviceId, method, diagnostics: diag };
}

/**
 * Attempt to discover the GPS903 Device ID for a just-established IMEI session.
 * Wrapper around runGps903Discovery — returns only the ID.
 */
export async function detectGps903DeviceId(
  sessionCookie: string,
  imei: string,
): Promise<number | null> {
  const { deviceId } = await runGps903Discovery(sessionCookie, imei);
  return deviceId;
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

  await Promise.all([
    svc.from("gps_device_positions").insert(posRow),
    svc.from("gps_devices").update(deviceUpdate).eq("id", gpsDeviceId),
  ]);

  console.log(
    `[GPS903] Position written — device ${gpsDeviceId} ` +
    `lat:${pos.lat.toFixed(5)} lng:${pos.lng.toFixed(5)} speed:${pos.speed} battery:${pos.battery ?? "?"}`,
  );
}
