import { registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import {
  IDLE_INTERVAL_MS,
  MOVING_INTERVAL_MS,
  MOVING_SPEED_KMH,
} from "@/lib/geo/cadence";

const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

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

        void fetch("/api/agents/location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }).catch(() => {
          // Non-fatal — network may be briefly unavailable in the field.
        });
      },
    );

    return () => {
      void BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
    };
  } catch {
    // Plugin not present / permission denied — no-op so the app still runs.
    return () => {};
  }
}
