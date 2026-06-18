import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { LiveMap } from "@/components/map/live-map";
import { FadeUp } from "@/components/shared/motion";
import {
  getActiveAgents,
  getActiveEmergencyAlerts,
  getActiveGpsDevices,
  getGeofences,
  getRecentGeofenceEvents,
} from "@/lib/queries";

export const metadata: Metadata = { title: "Live Map" };
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const profile = await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("map");

  const [agents, geofences, emergencyAlerts, geofenceEvents, gpsDevices] = await Promise.all([
    getActiveAgents(),
    getGeofences(),
    getActiveEmergencyAlerts(),
    getRecentGeofenceEvents(),
    getActiveGpsDevices(),
  ]);

  return (
    <FadeUp className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} />
      <LiveMap
        initialAgents={agents}
        initialGeofences={geofences}
        emergencyAlerts={emergencyAlerts}
        initialGeofenceEvents={geofenceEvents}
        initialGpsDevices={gpsDevices}
        isAdmin={profile.role === "admin"}
      />
    </FadeUp>
  );
}
