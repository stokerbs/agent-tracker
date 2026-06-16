"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AgentAvailabilityBoard({
  stats,
}: {
  stats: { total: number; available: number; active: number; offline: number };
}) {
  const t = useTranslations("availability");

  const rows = [
    { labelKey: "available", value: stats.available, color: "bg-emerald-500" },
    { labelKey: "onDuty", value: stats.active, color: "bg-blue-500" },
    { labelKey: "offline", value: stats.offline, color: "bg-slate-400" },
  ] as const;

  const max = Math.max(stats.total, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-4xl font-semibold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">{t("totalAgents")}</p>
        </div>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.labelKey}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t(r.labelKey)}</span>
                <span className="font-medium">{r.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${r.color}`}
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
