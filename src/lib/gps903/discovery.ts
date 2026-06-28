import {
  GPS903_BASE,
  GPS903_TIMEZONE,
  FETCH_TIMEOUT,
  withTimeout,
  parseGps903Value,
} from "./client";

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
