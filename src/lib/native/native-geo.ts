import { Geolocation } from "@capacitor/geolocation";

const REPORT_INTERVAL_MS = 55_000; // mirror the web GpsReporter cadence

/**
 * Start a foreground native GPS watch that POSTs the agent's position to
 * /api/agents/location every ~55s — the native mirror of
 * src/components/layout/gps-reporter.tsx. Cookie auth from the webview session
 * applies (foreground only; true background posting is Phase B).
 *
 * Returns a stop() function to clear the watch.
 */
export async function startNativeGpsWatch(): Promise<() => void> {
  try {
    const perm = await Geolocation.requestPermissions();
    if (perm.location === "denied") return () => {};
  } catch {
    return () => {};
  }

  let lastReport = 0;

  const watchId = await Geolocation.watchPosition(
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    (position, err) => {
      if (err || !position) return;
      const now = Date.now();
      if (now - lastReport < REPORT_INTERVAL_MS) return;
      lastReport = now;

      const { coords } = position;
      const body: Record<string, unknown> = { lat: coords.latitude, lng: coords.longitude };
      if (coords.speed != null && coords.speed >= 0) {
        body.speed_kmh = Math.round(coords.speed * 3.6 * 10) / 10;
      }
      if (coords.heading != null && !Number.isNaN(coords.heading)) {
        body.heading = Math.round(coords.heading) % 360;
      }

      void fetch("/api/agents/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {
        // Non-fatal — network may be briefly unavailable in the field.
      });
    },
  );

  return () => {
    void Geolocation.clearWatch({ id: watchId }).catch(() => {});
  };
}
