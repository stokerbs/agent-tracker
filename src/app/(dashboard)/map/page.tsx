import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { LiveMap } from "@/components/map/live-map";
import { getActiveAgents } from "@/lib/queries";

export const metadata: Metadata = { title: "Live Map" };
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const t = await getTranslations("map");
  const agents = await getActiveAgents();
  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <LiveMap initialAgents={agents} />
    </div>
  );
}
