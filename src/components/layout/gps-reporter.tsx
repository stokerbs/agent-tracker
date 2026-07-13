"use client";

import { useEffect } from "react";
import { isNative } from "@/lib/native";
import { distanceM, reportIntervalMs, IDLE_INTERVAL_MS } from "@/lib/geo/cadence";

interface BatteryManager {
  readonly charging: boolean;
  readonly level: number; // 0.0 – 1.0
}

async function readBattery(): Promise<{ battery: number; charging: boolean } | null> {
  try {
    if (!("getBattery" in navigator)) return null;
    const bm = await (navigator as Navigator & { getBattery(): Promise<BatteryManager> }).getBattery();
    return { battery: Math.round(bm.level * 100), charging: bm.charging };
  } catch {
    return null;
  }
}

/**
 * Invisible background component that reports the logged-in agent's GPS position,
 * speed, heading, and battery level to /api/agents/location.
 * Runs for all authenticated users; silently no-ops when no agent profile is
 * linked (the API returns 404 which is ignored).
 *
 * Battery: instead of a continuous high-accuracy `watchPosition` (which keeps the
 * GPS radio powered 100% of the time — a major drain), we DUTY-CYCLE — take a
 * single `getCurrentPosition` fix, report it, then sleep until the next scheduled
 * tick so the radio can power down in between. Cadence is unchanged and adaptive:
 * ~9 s while moving (the live map still glides) and ~60 s when stationary.
 *
 * On first successful report the API auto-promotes status offline → available.
 * Speed = Geolocation API (m/s → km/h); heading = compass bearing (0 = north).
 */
export function GpsReporter() {
  // Web browser only: on native, GPS is handled by the background-geolocation
  // watcher started in NativeBootstrap (foreground + background), so this no-ops.
  useEffect(() => {
    if (isNative()) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastPos: { lat: number; lng: number } | null = null;

    const schedule = (ms: number) => {
      if (stopped) return;
      timer = setTimeout(tick, ms);
    };

    const postReport = async (coords: GeolocationCoordinates) => {
      const speedKmh = coords.speed !== null && coords.speed >= 0 ? coords.speed * 3.6 : 0;
      const battery = await readBattery();

      const body: Record<string, unknown> = { lat: coords.latitude, lng: coords.longitude };
      if (coords.speed !== null && coords.speed >= 0) {
        body.speed_kmh = Math.round(speedKmh * 10) / 10;
      }
      if (coords.heading !== null && !isNaN(coords.heading)) {
        body.heading = Math.round(coords.heading) % 360;
      }
      if (battery) {
        body.battery = battery.battery;
        body.charging = battery.charging;
      }

      try {
        await fetch("/api/agents/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        // Non-fatal — network may be briefly unavailable in the field.
      }
    };

    function tick() {
      if (stopped) return;

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (stopped) return;
          const { coords } = position;
          const here = { lat: coords.latitude, lng: coords.longitude };
          const speedKmh = coords.speed !== null && coords.speed >= 0 ? coords.speed * 3.6 : 0;
          const movedM = lastPos ? distanceM(lastPos, here) : null;
          lastPos = here;

          await postReport(coords);

          // Schedule the NEXT fix by movement: moving → 9 s, stationary → 60 s.
          schedule(reportIntervalMs(speedKmh, movedM));
        },
        () => schedule(IDLE_INTERVAL_MS), // fix failed/timed out → back off, retry
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
      );
    }

    tick(); // first fix right away

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
