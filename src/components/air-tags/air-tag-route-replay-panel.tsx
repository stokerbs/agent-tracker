"use client";

import { useRouter } from "next/navigation";
import { AirTagRouteReplay, type AirTagTrackerForReplay } from "./air-tag-route-replay";

/**
 * Thin client shim mounting the full-screen <AirTagRouteReplay> overlay from
 * the "Route Replay" tab. AirTagRouteReplay is a fixed inset-0 overlay with
 * its own close (X) control — `onClose` here just navigates back to the
 * Overview tab, since there's no local "closed" state to fall back to in a
 * server-rendered tab (the tab itself IS the open state).
 */
export function AirTagRouteReplayPanel({ tracker }: { tracker: AirTagTrackerForReplay }) {
  const router = useRouter();
  return <AirTagRouteReplay tracker={tracker} onClose={() => router.push("?tab=overview")} />;
}
