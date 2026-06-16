import type { Metadata } from "next";
import { MapPin, Siren } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { SosButton } from "@/components/emergency/sos-button";
import { AlertActions } from "@/components/emergency/alert-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Emergency" };
export const dynamic = "force-dynamic";

const STATUS_BADGE = {
  active: "bg-red-500/15 text-red-600",
  acknowledged: "bg-amber-500/15 text-amber-600",
  resolved: "bg-emerald-500/15 text-emerald-600",
} as const;

export default async function EmergencyPage() {
  const profile = await requireProfile();
  const t = await getTranslations("emergency");
  const supabase = await createClient();
  const staff = isStaff(profile.role);

  const { data } = await supabase
    .from("emergency_alerts")
    .select("*, agents(full_name, agent_code, area)")
    .order("created_at", { ascending: false })
    .limit(100);

  const alerts = (data ?? []) as never[];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <SosButton />
      </PageHeader>

      {alerts.length === 0 ? (
        <EmptyState
          icon={<Siren className="h-6 w-6" />}
          title={t("noTitle")}
          description={t("noDescription")}
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((a: any) => (
            <Card
              key={a.id}
              className={a.status === "active" ? "border-destructive/40" : ""}
            >
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      a.status === "active"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Siren className={`h-5 w-5 ${a.status === "active" ? "animate-pulse" : ""}`} />
                  </div>
                  <div>
                    <p className="font-medium">
                      {a.agents?.full_name ?? t("alert.unknownAgent")}{" "}
                      <span className="text-xs text-muted-foreground">
                        {a.agents?.agent_code}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {a.notes ?? t("alert.sosTriggered")}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{timeAgo(a.created_at)}</span>
                      {a.lat && a.lng && (
                        <a
                          className="flex items-center gap-1 text-primary hover:underline"
                          href={`https://www.google.com/maps?q=${a.lat},${a.lng}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin className="h-3 w-3" /> {a.lat.toFixed(4)},{" "}
                          {a.lng.toFixed(4)}
                        </a>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`border-transparent ${STATUS_BADGE[a.status as keyof typeof STATUS_BADGE]}`}>
                    {t(`status.${a.status}` as any)}
                  </Badge>
                  {staff && <AlertActions alertId={a.id} status={a.status} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
