import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { SosButton } from "@/components/emergency/sos-button";
import { EmergencyFeed } from "@/components/emergency/emergency-feed";

export const metadata: Metadata = { title: "Emergency" };
export const dynamic = "force-dynamic";

export default async function EmergencyPage() {
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("emergency");
  const supabase = await createClient();

  const { data } = await supabase
    .from("emergency_alerts")
    .select("*, agents(full_name, agent_code, area)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <SosButton />
      </PageHeader>
      <EmergencyFeed initialAlerts={(data ?? []) as any} />
    </div>
  );
}
