"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ROWS = [
  { key: "available", color: "bg-success", glow: "shadow-[0_0_8px_hsl(var(--success)/0.5)]" },
  { key: "onDuty",    color: "bg-primary",  glow: "shadow-[0_0_8px_hsl(var(--primary)/0.4)]" },
  { key: "offline",   color: "bg-muted-foreground/40", glow: "" },
] as const;

export function AgentAvailabilityBoard({
  stats,
}: {
  stats: { total: number; available: number; active: number; offline: number };
}) {
  const t = useTranslations("availability");
  const max = Math.max(stats.total, 1);

  const values: Record<typeof ROWS[number]["key"], number> = {
    available: stats.available,
    onDuty: stats.active,
    offline: stats.offline,
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Total count */}
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-bold tracking-tight text-glow-primary">
            {stats.total}
          </span>
          <span className="text-xs text-muted-foreground">{t("totalAgents")}</span>
        </div>

        {/* Progress bars */}
        <div className="space-y-3">
          {ROWS.map(({ key, color, glow }) => {
            const val = values[key];
            const pct = (val / max) * 100;
            return (
              <div key={key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
                    <span className="text-xs text-muted-foreground">{t(key)}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold">{val}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={`h-full rounded-full ${color} ${glow}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/40 p-2">
          {[
            { label: t("shortOn"), value: stats.available, accent: "text-success" },
            { label: t("shortOps"), value: stats.active - stats.available, accent: "text-primary" },
            { label: t("shortOff"), value: stats.offline, accent: "text-muted-foreground" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="flex flex-col items-center py-1">
              <span className={`font-mono text-lg font-bold leading-none ${accent}`}>{value}</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
