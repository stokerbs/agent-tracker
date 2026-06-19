import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getGpsMonitorDevices } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { GpsMonitorMap } from "@/components/gps/gps-monitor-map";

export const metadata: Metadata = { title: "GPS Monitor" };
export const dynamic = "force-dynamic";

export default async function GpsMonitorPage() {
  const profile = await requireRole(["admin", "supervisor", "agent"]);
  const devices  = await getGpsMonitorDevices();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="GPS Monitor"
        description={
          profile.role === "agent"
            ? "GPS trackers assigned to your cases."
            : "Live GPS device positions across all active cases."
        }
      />
      <GpsMonitorMap initialDevices={devices} role={profile.role} />
    </div>
  );
}
