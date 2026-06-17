import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getAgents } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { FadeUp } from "@/components/shared/motion";
import { AnalyticsClient } from "@/components/analytics/analytics-client";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("analytics");
  const agents = await getAgents();

  return (
    <FadeUp className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} />
      <AnalyticsClient agents={agents} />
    </FadeUp>
  );
}
