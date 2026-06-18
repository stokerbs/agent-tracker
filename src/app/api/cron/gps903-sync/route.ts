import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30; // seconds — requires Vercel Pro for cron routes

const GPS903_BASE    = "http://www.gps903.net";
const TIMEZONE       = "Asia/Bangkok";
const SESSION_TTL_MS = 25 * 60 * 1000; // treat session as valid for 25 min
const FETCH_TIMEOUT  = 8_000;           // ms — abort GPS903 calls that hang

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

// ── GPS903 login ──────────────────────────────────────────────────────────────

function extractHiddenInput(html: string, name: string): string {
  const m = html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "i"))
            ?? html.match(new RegExp(`value="([^"]*)"[^>]*name="${name}"`, "i"));
  return m?.[1] ?? "";
}

async function gps903Login(username: string, password: string): Promise<string | null> {
  const loginUrl = `${GPS903_BASE}/Login.aspx?language=en-us`;
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  // Step 1: GET login page to grab ASP.NET hidden fields
  let html: string;
  try {
    const getRes = await fetch(loginUrl, {
      headers: { "User-Agent": ua },
      redirect: "manual",
      signal: withTimeout(FETCH_TIMEOUT),
    });
    html = await getRes.text();
  } catch {
    return null;
  }

  const viewstate          = extractHiddenInput(html, "__VIEWSTATE");
  const viewstategenerator = extractHiddenInput(html, "__VIEWSTATEGENERATOR");
  const eventvalidation    = extractHiddenInput(html, "__EVENTVALIDATION");

  // Step 2: POST login form — exact field names confirmed from live page source
  const body = new URLSearchParams({
    __VIEWSTATE:          viewstate,
    __VIEWSTATEGENERATOR: viewstategenerator,
    __EVENTVALIDATION:    eventvalidation,
    txtUserName:          username,
    txtAccountPassword:   password,
    btnLoginAccount:      "",
  });

  let postRes: Response;
  try {
    postRes = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": ua,
      },
      body: body.toString(),
      redirect: "manual",
      signal: withTimeout(FETCH_TIMEOUT),
    });
  } catch {
    return null;
  }

  // Success = 302 redirect with Set-Cookie containing ASP.NET_SessionId
  const setCookie = postRes.headers.get("set-cookie") ?? "";
  const match     = setCookie.match(/ASP\.NET_SessionId=([^;]+)/i);
  return match?.[1] ?? null;
}

// ── GPS903 GetTracking ────────────────────────────────────────────────────────

interface TrackingResult {
  lat: number;
  lng: number;
  speed: number;   // km/h (GPS903 web API returns display units)
  course: number;  // degrees 0–360
  battery: number | null;
  fixTime: string;
}

async function getTracking(sessionCookie: string, deviceId: number): Promise<TrackingResult | null> {
  let res: Response;
  try {
    res = await fetch(`${GPS903_BASE}/Ajax/DevicesAjax.asmx/GetTracking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `ASP.NET_SessionId=${sessionCookie}`,
      },
      body: JSON.stringify({ DeviceID: deviceId, TimeZone: TIMEZONE }),
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

  // Guard against null/missing coordinates before Number() conversion.
  // Number(null) === 0 which would pass isNaN but be a false positive.
  if (data.lat == null || data.lng == null) return null;
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (isNaN(lat) || isNaN(lng)) return null;

  // ct = "ACC-alarm-fortify-door-battery%" e.g. "1-0-0-0-87"
  let battery: number | null = null;
  const ct = String(data.ct ?? "");
  if (ct) {
    const parts = ct.split("-");
    const raw   = Number(parts[4]);
    if (!isNaN(raw) && raw >= 0 && raw <= 100) battery = raw;
  }

  return {
    lat,
    lng,
    speed:   Number(data.speed) || 0,
    course:  Number(data.course) || 0,
    battery,
    fixTime: String(data.deviceUtcDate ?? new Date().toISOString()),
  };
}

// ── Session cache (Supabase gps903_session table) ─────────────────────────────

async function getCachedSession(svc: ReturnType<typeof createServiceClient>): Promise<string | null> {
  const { data } = await svc
    .from("gps903_session")
    .select("session_cookie, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at) <= new Date()) return null;

  return data.session_cookie;
}

async function cacheSession(svc: ReturnType<typeof createServiceClient>, cookie: string) {
  await svc.from("gps903_session").upsert({
    id:             1,
    session_cookie: cookie,
    expires_at:     new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    updated_at:     new Date().toISOString(),
  });
}

// ── Agent update (mirrors mobile GPS reporter logic) ──────────────────────────

async function updateAgent(
  svc: ReturnType<typeof createServiceClient>,
  agentId: string,
  pos: TrackingResult,
) {
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

// ── Per-device poll (with session-expiry retry) ───────────────────────────────

async function pollDevice(
  svc: ReturnType<typeof createServiceClient>,
  gps903Id: number,
  agentId: string,
  session: string,
  username: string,
  password: string,
): Promise<{ deviceId: number; ok: boolean; error?: string; freshSession?: string }> {
  let pos = await getTracking(session, gps903Id);

  let freshSession: string | undefined;

  // Null return may mean session expired — re-auth once and retry
  if (!pos) {
    const fresh = await gps903Login(username, password);
    if (fresh) {
      freshSession = fresh;
      pos = await getTracking(fresh, gps903Id);
    }
  }

  if (!pos) {
    return { deviceId: gps903Id, ok: false, error: "no position returned", freshSession };
  }

  try {
    await updateAgent(svc, agentId, pos);
    return { deviceId: gps903Id, ok: true, freshSession };
  } catch (e) {
    return { deviceId: gps903Id, ok: false, error: String(e), freshSession };
  }
}

// ── Cron handler ──────────────────────────────────────────────────────────────

/**
 * GET /api/cron/gps903-sync
 * Vercel Cron calls this as GET with Authorization: Bearer <CRON_SECRET>.
 * Polls GPS903 for every active device with gps903_device_id + agent_id set.
 * All devices are polled in parallel (Promise.allSettled).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const username = process.env.GPS903_USERNAME;
  const password = process.env.GPS903_PASSWORD;
  if (!username || !password) {
    return NextResponse.json(
      { error: "GPS903_USERNAME / GPS903_PASSWORD not configured" },
      { status: 500 },
    );
  }

  const svc = createServiceClient();

  // Fetch devices configured for polling
  const { data: devices, error: devErr } = await svc
    .from("gps_devices")
    .select("id, gps903_device_id, agent_id")
    .not("gps903_device_id", "is", null)
    .not("agent_id", "is", null)
    .is("deleted_at", null);

  if (devErr) {
    return NextResponse.json({ error: devErr.message }, { status: 500 });
  }
  if (!devices?.length) {
    return NextResponse.json({ ok: true, skipped: "no configured devices" });
  }

  // Get or refresh GPS903 session
  let session = await getCachedSession(svc);
  if (!session) {
    session = await gps903Login(username, password);
    if (!session) {
      return NextResponse.json({ error: "GPS903 login failed — check credentials" }, { status: 502 });
    }
    await cacheSession(svc, session);
  }

  // Poll all devices in parallel; each handles its own session-expiry retry
  const settled = await Promise.allSettled(
    devices.map((device) =>
      pollDevice(
        svc,
        device.gps903_device_id as number,
        device.agent_id as string,
        session!,
        username,
        password,
      ),
    ),
  );

  // If any device obtained a fresh session, persist the newest one
  const freshSessions = settled
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof pollDevice>>> =>
      r.status === "fulfilled" && !!r.value.freshSession,
    )
    .map((r) => r.value.freshSession!);

  if (freshSessions.length > 0) {
    await cacheSession(svc, freshSessions[freshSessions.length - 1]);
  }

  const results = settled.map((r) =>
    r.status === "fulfilled"
      ? { deviceId: r.value.deviceId, ok: r.value.ok, error: r.value.error }
      : { ok: false, error: r.reason?.message ?? "unknown" },
  );

  return NextResponse.json({ ok: true, polled: results.length, results });
}
