"use client";

import { useEffect, useRef } from "react";
import { isNative } from "@/lib/native";
import { distanceM, reportIntervalMs } from "@/lib/geo/cadence";

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
 * Invisible background component that continuously reports the logged-in
 * agent's GPS position, speed, heading, and battery level to /api/agents/location.
 * Runs for all authenticated users; silently no-ops when no agent profile is
 * linked (the API returns 404 which is ignored).
 *
 * Cadence is adaptive: ~9 s while the agent is moving (so the live map glides
 * smoothly) and ~60 s when stationary (to spare battery and DB writes).
 *
 * On first successful report the API auto-promotes status offline → available
 * so the agent appears on the live map without any manual action.
 *
 * Speed is derived from Geolocation API (m/s → km/h).
 * Heading is the compass bearing in degrees (0 = north).
 */
export function GpsReporter() {
  const lastReportRef = useRef<number>(0);
  const lastPosRef    = useRef<{ lat: number; lng: number } | null>(null);

  // Web browser only: navigator.geolocation watch. On native, GPS is handled by
  // the background-geolocation watcher started in NativeBootstrap (covers
  // foreground + background), so this no-ops to avoid double reporting.
  useEffect(() => {
    if (isNative()) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const report = async (position: GeolocationPosition) => {
      const now = Date.now();
      const { coords } = position;
      const here = { lat: coords.latitude, lng: coords.longitude };

      // Decide cadence: moving (fast enough OR displaced enough) → 9 s, else 60 s.
      const speedKmh =
        coords.speed !== null && coords.speed >= 0 ? coords.speed * 3.6 : 0;
      const movedM = lastPosRef.current
        ? distanceM(lastPosRef.current, here)
        : null;
      const interval = reportIntervalMs(speedKmh, movedM);

      if (now - lastReportRef.current < interval) return;
      lastReportRef.current = now;
      lastPosRef.current = here;

      const batteryInfo = await readBattery();

      const body: Record<string, unknown> = { lat: here.lat, lng: here.lng };

      // Speed: Geolocation API returns m/s (or null if unavailable)
      if (coords.speed !== null && coords.speed >= 0) {
        body.speed_kmh = Math.round(speedKmh * 10) / 10;
      }

      // Heading: compass degrees 0–359 (or null if stationary/unavailable)
      if (coords.heading !== null && !isNaN(coords.heading)) {
        body.heading = Math.round(coords.heading) % 360;
      }

      if (batteryInfo) {
        body.battery = batteryInfo.battery;
        body.charging = batteryInfo.charging;
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

    // maximumAge kept low so each tick is a fresh fix — essential for the ~9 s
    // moving cadence (a stale cached position would freeze the marker).
    const watchId = navigator.geolocation.watchPosition(report, () => {}, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 5_000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return null;
}
