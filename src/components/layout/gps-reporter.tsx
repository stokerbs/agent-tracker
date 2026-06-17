"use client";

import { useEffect, useRef } from "react";

const REPORT_INTERVAL_MS = 55_000; // slightly under the 60s map poll

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
 * agent's GPS position, speed, heading, and battery level to /api/agents/location
 * every ~55 s. Runs for all authenticated users; silently no-ops when no agent
 * profile is linked (the API returns 404 which is ignored).
 *
 * On first successful report the API auto-promotes status offline → available
 * so the agent appears on the live map without any manual action.
 *
 * Speed is derived from Geolocation API (m/s → km/h).
 * Heading is the compass bearing in degrees (0 = north).
 */
export function GpsReporter() {
  const lastReportRef = useRef<number>(0);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const report = async (position: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastReportRef.current < REPORT_INTERVAL_MS) return;
      lastReportRef.current = now;

      const batteryInfo = await readBattery();
      const { coords } = position;

      const body: Record<string, unknown> = {
        lat: coords.latitude,
        lng: coords.longitude,
      };

      // Speed: Geolocation API returns m/s (or null if unavailable)
      if (coords.speed !== null && coords.speed >= 0) {
        body.speed_kmh = Math.round(coords.speed * 3.6 * 10) / 10;
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

    const watchId = navigator.geolocation.watchPosition(report, () => {}, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 30_000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return null;
}
