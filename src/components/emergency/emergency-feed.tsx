"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Siren } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { AlertActions } from "@/components/emergency/alert-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";
import type { AlertStatus, EmergencyAlert } from "@/lib/types";

type AlertWithAgent = EmergencyAlert & {
  agents: { full_name: string; agent_code: string; area: string | null } | null;
};

const STATUS_BADGE: Record<AlertStatus, string> = {
  active:       "bg-red-500/15 text-red-600",
  acknowledged: "bg-amber-500/15 text-amber-600",
  resolved:     "bg-emerald-500/15 text-emerald-600",
};

async function fetchAlerts(supabase: ReturnType<typeof createClient>): Promise<AlertWithAgent[]> {
  const { data } = await supabase
    .from("emergency_alerts")
    .select("*, agents(full_name, agent_code, area)")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as AlertWithAgent[];
}

export function EmergencyFeed({
  initialAlerts,
}: {
  initialAlerts: AlertWithAgent[];
}) {
  const t = useTranslations("emergency");
  const supabase = createClient();
  const [alerts, setAlerts] = useState<AlertWithAgent[]>(initialAlerts);
  const knownIds = useRef(new Set(initialAlerts.map((a) => a.id)));

  // Sync when server re-renders (e.g. after AlertActions calls router.refresh())
  useEffect(() => {
    setAlerts(initialAlerts);
    knownIds.current = new Set(initialAlerts.map((a) => a.id));
  }, [initialAlerts]);

  useEffect(() => {
    async function reload() {
      const fresh = await fetchAlerts(supabase);

      // Surface a toast for any newly-active alert we haven't seen before
      for (const a of fresh) {
        if (a.status === "active" && !knownIds.current.has(a.id)) {
          const agentName = a.agents?.full_name ?? t("alert.unknownAgent");
          toast.error(`🚨 ${agentName} — ${a.notes ?? t("alert.sosTriggered")}`, {
            duration: 10000,
            id: a.id,
          });
        }
      }

      knownIds.current = new Set(fresh.map((a) => a.id));
      setAlerts(fresh);
    }

    const channel = supabase
      .channel("emergency-alerts-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergency_alerts" },
        () => reload(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "emergency_alerts" },
        () => reload(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={<Siren className="h-6 w-6" />}
        title={t("noTitle")}
        description={t("noDescription")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((a) => (
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
              <Badge className={`border-transparent ${STATUS_BADGE[a.status]}`}>
                {t(`status.${a.status}` as any)}
              </Badge>
              <AlertActions alertId={a.id} status={a.status} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
