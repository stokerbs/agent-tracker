import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { LiveMap } from "@/components/map/live-map";
import { getActiveAgents } from "@/lib/queries";

export const metadata: Metadata = { title: "Live Map" };
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const agents = await getActiveAgents();
  return (
    <div>
      <PageHeader
        title="Live GPS Tracking"
        description="Real-time field positions, auto-refreshed every 60 seconds."
      />
      <LiveMap initialAgents={agents} />
    </div>
  );
}
