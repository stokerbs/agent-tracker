/**
 * Shared GPS903 Web API client.
 * Used by: /api/cron/gps903-sync  and  /gps-devices server actions.
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

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * POST Login.aspx with account credentials.
 * Returns the ASP.NET_SessionId value on success, null on failure.
 * Field names confirmed from live page source inspection.
 */
export async function gps903Login(
  username: string,
  password: string,
): Promise<string | null> {
  const loginUrl = `${GPS903_BASE}/Login.aspx?language=en-us`;
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  let html: string;
  try {
    const r = await fetch(loginUrl, {
      headers: { "User-Agent": ua },
      redirect: "manual",
      signal: withTimeout(FETCH_TIMEOUT),
    });
    html = await r.text();
  } catch {
    return null;
  }

  const body = new URLSearchParams({
    __VIEWSTATE:          extractHiddenInput(html, "__VIEWSTATE"),
    __VIEWSTATEGENERATOR: extractHiddenInput(html, "__VIEWSTATEGENERATOR"),
    __EVENTVALIDATION:    extractHiddenInput(html, "__EVENTVALIDATION"),
    txtUserName:          username,
    txtAccountPassword:   password,
    btnLoginAccount:      "",
  });

  let postRes: Response;
  try {
    postRes = await fetch(loginUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": ua },
      body:    body.toString(),
      redirect: "manual",
      signal:  withTimeout(FETCH_TIMEOUT),
    });
  } catch {
    return null;
  }

  const setCookie = postRes.headers.get("set-cookie") ?? "";
  const match     = setCookie.match(/ASP\.NET_SessionId=([^;]+)/i);
  return match?.[1] ?? null;
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
        "Cookie":        `ASP.NET_SessionId=${sessionCookie}`,
      },
      body:   JSON.stringify({ DeviceID: deviceId, TimeZone: GPS903_TIMEZONE }),
      signal: withTimeout(FETCH_TIMEOUT),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let json: { d?: string };
  try { json = await res.json(); } catch { return null; }
  if (!json.d) return null;

  let data: Record<string, unknown>;
  try { data = JSON.parse(json.d); } catch { return null; }

  // Guard: Number(null)===0 which passes isNaN, so check for null first
  if (data.lat == null || data.lng == null) return null;
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

  return {
    lat,
    lng,
    speed:    Number(data.speed)  || 0,
    course:   Number(data.course) || 0,
    battery,
    ignition,
    fixTime:  String(data.deviceUtcDate ?? new Date().toISOString()),
  };
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
        "Cookie":        `ASP.NET_SessionId=${sessionCookie}`,
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
  if (new Date(data.expires_at) <= new Date()) return null;
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

/** Returns a valid session or null if login fails / credentials missing. */
export async function getOrRefreshSession(svc: SvcClient): Promise<string | null> {
  const cached = await getCachedSession(svc);
  if (cached) return cached;

  const username = process.env.GPS903_USERNAME;
  const password = process.env.GPS903_PASSWORD;
  if (!username || !password) return null;

  const fresh = await gps903Login(username, password);
  if (!fresh) return null;

  await cacheSession(svc, fresh);
  return fresh;
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
