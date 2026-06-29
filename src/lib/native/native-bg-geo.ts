import { registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import {
  IDLE_INTERVAL_MS,
  MOVING_INTERVAL_MS,
  MOVING_SPEED_KMH,
} from "@/lib/geo/cadence";

const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

// ── Offline queue ──────────────────────────────────────────────────────────
// Field agents work in dead-signal areas. A fix that fails to POST is stored
// locally and replayed (as historical backfill, with its true timestamp) once
// connectivity returns, so the GPS track isn't lost while offline.
const QUEUE_KEY = "dp_gps_queue";
const QUEUE_MAX = 500;

function readQueue(): Array<Record<string, unknown>> {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeQueue(q: Array<Record<string, unknown>>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX)));
  } catch {
    /* storage full — best effort */
  }
}
function enqueueFix(fix: Record<string, unknown>) {
  const q = readQueue();
  q.push(fix);
  writeQueue(q);
}

async function postFix(token: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/agents/location", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Replay queued offline fixes oldest-first; stop at the first failure and keep
 *  the remainder for the next attempt. Exported for unit testing. */
export async function flushQueue(token: string) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const q = readQueue();
  if (q.length === 0) return;
  let sent = 0;
  for (; sent < q.length; sent++) {
    const ok = await postFix(token, q[sent]);
    if (!ok) break;
  }
  if (sent > 0) writeQueue(q.slice(sent));
}

// Adaptive cadence — post often while moving for a smooth (Life360-like) live
// map, then back off when stationary to save battery and DB writes. The plugin
// emits more often than this (past its 10 m distanceFilter); we throttle to
// the shared cadence intervals.

/**
 * Start background GPS reporting via @capacitor-community/background-geolocation.
 * Runs in foreground AND background (and keeps the app alive for location on a
 * persistent notification). Each fix is POSTed to /api/agents/location with a
 * Bearer GPS token, so it authenticates without the WebView session cookie.
 *
 * Native only — requires the native plugin + iOS background mode / Android
 * foreground service (see CAPACITOR.md). Returns a stop() function; resolves to
 * a no-op stop if the plugin/permissions are unavailable.
 */
export async function startBackgroundGps(token: string): Promise<() => void> {
  let lastReport = 0;

  try {
    const watcherId = await BackgroundGeolocation.addWatcher(
      {
        requestPermissions: true,
        stale: false,
        backgroundTitle: "Detective Pulse — On duty",
        backgroundMessage: "Reporting your position to operations.",
        distanceFilter: 10,
      },
      (location, error) => {
        if (error || !location) return;
        const now = Date.now();

        // Cadence depends on movement: the plugin only emits past distanceFilter
        // (10 m), so any emission with speed under threshold is treated as a slow
        // drift and throttled to the idle interval.
        const speedKmh =
          location.speed != null && location.speed >= 0
            ? location.speed * 3.6
            : 0;
        const interval =
          speedKmh > MOVING_SPEED_KMH ? MOVING_INTERVAL_MS : IDLE_INTERVAL_MS;
        if (now - lastReport < interval) return;
        lastReport = now;

        const body: Record<string, unknown> = {
          lat: location.latitude,
          lng: location.longitude,
        };
        if (location.speed != null && location.speed >= 0) {
          body.speed_kmh = Math.round(speedKmh * 10) / 10;
        }
        if (location.bearing != null && !Number.isNaN(location.bearing)) {
          body.heading = Math.round(location.bearing) % 360;
        }

        // Live send (no recorded_at → updates the agent's current position).
        // On success, flush any backlog; on failure (offline), queue this fix
        // with its capture time so it's backfilled later instead of lost.
        const recordedAt = new Date().toISOString();
        void postFix(token, body).then((ok) => {
          if (ok) void flushQueue(token);
          else enqueueFix({ ...body, recorded_at: recordedAt });
        });
      },
    );

    // Flush the backlog as soon as connectivity returns.
    const onOnline = () => void flushQueue(token);
    if (typeof window !== "undefined") window.addEventListener("online", onOnline);
    void flushQueue(token); // also try once on start

    return () => {
      if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
      void BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
    };
  } catch {
    // Plugin not present / permission denied — no-op so the app still runs.
    return () => {};
  }
}
