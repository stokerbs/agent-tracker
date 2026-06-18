import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Activity,
  Battery,
  BatteryLow,
  CheckCircle2,
  ChevronRight,
  Gauge,
  MapPin,
  Radio,
  Satellite,
  XCircle,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { AgentStatusBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PollNowButton } from "@/components/gps903/poll-now-button";

export const metadata: Metadata = { title: "GPS Devices" };
export const dynamic = "force-dynamic";

const STALE_MS = 10 * 60 * 1000;

function timeAgo(ts: string | null): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PROVIDER_COLORS: Record<string, string> = {
  GPS903: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  AIS:    "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  TRUE:   "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  DTAC:   "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
};

export default async function GpsDevicesPage() {
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("gpsDevices");
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("gps_devices")
    .select(`
      id, imei, gps903_device_id, notes, provider, case_id,
      last_polled_at, last_poll_ok, last_battery_pct, last_speed_kmh, last_seen_at, agent_id,
      cases ( case_number ),
      agents ( id, full_name, agent_code, status )
    `)
    .not("gps903_device_id", "is", null)
    .is("deleted_at", null)
    .order("gps903_device_id", { ascending: true });

  const devices = (rows ?? []) as any[];

  const now    = Date.now();
  const total  = devices.length;
  const linked = devices.filter((d) => d.agent_id).length;
  const live   = devices.filter(
    (d) => d.last_seen_at && now - new Date(d.last_seen_at).getTime() < STALE_MS,
  ).length;
  const errors = devices.filter((d) => d.last_poll_ok === false).length;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: <Satellite className="h-4 w-4 text-emerald-500" />, label: t("stats.total"),  value: total  },
          { icon: <Activity  className="h-4 w-4 text-sky-500"     />, label: t("stats.linked"), value: linked },
          { icon: <MapPin    className="h-4 w-4 text-green-500"   />, label: t("stats.live"),   value: live   },
          { icon: <XCircle   className="h-4 w-4 text-red-500"     />, label: t("stats.errors"), value: errors },
        ].map(({ icon, label, value }) => (
          <Card key={label} className="p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              {icon}
              <span className="text-xs">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>

      {devices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Satellite className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">{t("empty")}</p>
            <p className="max-w-sm text-xs text-muted-foreground/60">{t("emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => {
            const agent   = d.agents;
            const stale   = !d.last_seen_at || now - new Date(d.last_seen_at).getTime() >= STALE_MS;
            const battery = d.last_battery_pct as number | null;
            const pollOk  = d.last_poll_ok;

            return (
              <Card
                key={d.id}
                className="relative flex flex-col overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Poll status stripe */}
                <div
                  className={`absolute inset-x-0 top-0 h-0.5 ${
                    pollOk === true  ? "bg-emerald-500" :
                    pollOk === false ? "bg-red-500" :
                    "bg-border"
                  }`}
                />

                <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-foreground">
                        GPS903-{d.gps903_device_id}
                      </p>
                      {d.notes && (
                        <p className="truncate text-xs text-muted-foreground">{d.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {d.provider && (
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${
                            PROVIDER_COLORS[d.provider] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {d.provider}
                        </span>
                      )}
                      {pollOk === true  && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                      {pollOk === false && <XCircle      className="h-3.5 w-3.5 text-red-500" />}
                    </div>
                  </div>

                  {/* IMEI */}
                  <p className="font-mono text-[11px] text-muted-foreground/70">
                    IMEI: {d.imei ?? "—"}
                  </p>

                  {/* Agent row */}
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
                    {agent ? (
                      <>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{agent.full_name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{agent.agent_code}</p>
                        </div>
                        <AgentStatusBadge status={agent.status} />
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground/50">{t("unlinked")}</p>
                    )}
                  </div>

                  {/* Telemetry row — sourced from device last_* fields */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {/* Battery */}
                    {battery !== null ? (
                      <span className={`flex items-center gap-1 font-mono ${
                        battery <= 20 ? "text-red-500" : battery <= 40 ? "text-amber-500" : "text-emerald-600"
                      }`}>
                        {battery <= 20 ? <BatteryLow className="h-3 w-3" /> : <Battery className="h-3 w-3" />}
                        {battery}%
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Battery className="h-3 w-3" /> —
                      </span>
                    )}

                    {/* Speed */}
                    <span className="flex items-center gap-1">
                      <Gauge className="h-3 w-3" />
                      {d.last_speed_kmh != null ? `${Math.round(d.last_speed_kmh)} km/h` : "—"}
                    </span>

                    {/* Last seen */}
                    <span className={`ml-auto ${stale && d.last_seen_at ? "text-amber-500" : ""}`}>
                      {timeAgo(d.last_seen_at ?? null)}
                    </span>
                  </div>

                  {/* Case + poll stamp */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
                    {d.cases ? (
                      <Link href={`/cases/${d.case_id}`} className="font-mono font-medium text-primary hover:underline">
                        {d.cases.case_number}
                      </Link>
                    ) : <span />}
                    {d.last_polled_at && (
                      <span>polled {timeAgo(d.last_polled_at)}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-auto flex items-center gap-2 border-t border-border/50 pt-3">
                    <PollNowButton deviceId={d.id} size="xs" />
                    <Button asChild size="sm" variant="ghost" className="ml-auto h-7 gap-1 text-xs">
                      <Link href={`/gps-devices/${d.id}`}>
                        Details <ChevronRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground/50">
        {t("pollingNote")}
      </p>
    </div>
  );
}
