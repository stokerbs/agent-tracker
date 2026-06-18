import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Activity,
  Battery,
  BatteryLow,
  Gauge,
  MapPin,
  Radio,
  RefreshCw,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { AgentStatusBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "GPS Devices" };
export const dynamic = "force-dynamic";

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

function isStale(ts: string | null): boolean {
  if (!ts) return true;
  return Date.now() - new Date(ts).getTime() > 10 * 60 * 1000; // > 10 min
}

function BatteryIcon({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground/50">—</span>;
  const color =
    pct <= 20 ? "text-red-500" : pct <= 40 ? "text-amber-500" : "text-emerald-500";
  const Icon = pct <= 20 ? BatteryLow : Battery;
  return (
    <span className={`flex items-center gap-1 font-mono text-xs ${color}`}>
      <Icon className="h-3 w-3" />
      {pct}%
    </span>
  );
}

export default async function GpsDevicesPage() {
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("gpsDevices");
  const supabase = await createClient();

  // All gps_devices with GPS903 polling configured, joined with agent + case data
  const { data: rows } = await supabase
    .from("gps_devices")
    .select(`
      id,
      imei,
      gps903_device_id,
      notes,
      provider,
      case_id,
      cases ( case_number ),
      agent_id,
      agents (
        id,
        full_name,
        agent_code,
        status,
        speed_kmh,
        battery_pct,
        last_active,
        current_lat,
        current_lng
      )
    `)
    .not("gps903_device_id", "is", null)
    .is("deleted_at", null)
    .order("gps903_device_id", { ascending: true });

  const devices = (rows ?? []) as any[];

  // Summary stats
  const total   = devices.length;
  const linked  = devices.filter((d) => d.agent_id).length;
  const live    = devices.filter(
    (d) => d.agents && !isStale(d.agents.last_active),
  ).length;
  const stale   = linked - live;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/gps-devices">
            <RefreshCw className="h-3.5 w-3.5" />
            {t("refresh")}
          </Link>
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Radio className="h-4 w-4 text-emerald-500" />} label={t("stats.total")} value={total} />
        <StatCard icon={<Activity className="h-4 w-4 text-sky-500" />} label={t("stats.linked")} value={linked} />
        <StatCard icon={<MapPin className="h-4 w-4 text-green-500" />} label={t("stats.live")} value={live} />
        <StatCard icon={<Activity className="h-4 w-4 text-amber-500" />} label={t("stats.stale")} value={stale} />
      </div>

      {devices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Radio className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
            <p className="max-w-sm text-xs text-muted-foreground/60">{t("emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="h-4 w-4 text-emerald-500" />
              {t("tableTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("col.device")}</TableHead>
                  <TableHead>{t("col.imei")}</TableHead>
                  <TableHead>{t("col.linkedAgent")}</TableHead>
                  <TableHead>{t("col.case")}</TableHead>
                  <TableHead>{t("col.battery")}</TableHead>
                  <TableHead>{t("col.speed")}</TableHead>
                  <TableHead>{t("col.lastSeen")}</TableHead>
                  <TableHead>{t("col.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d) => {
                  const agent    = d.agents;
                  const staleRow = isStale(agent?.last_active ?? null);
                  const hasLoc   = agent?.current_lat != null;

                  return (
                    <TableRow key={d.id} className={staleRow ? "opacity-60" : ""}>
                      {/* Device */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            GPS903-{d.gps903_device_id}
                          </span>
                          {d.notes && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                              {d.notes}
                            </span>
                          )}
                          {d.provider && (
                            <Badge variant="outline" className="w-fit text-[10px] py-0 px-1">
                              {d.provider}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* IMEI */}
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {d.imei ?? "—"}
                        </span>
                      </TableCell>

                      {/* Linked agent */}
                      <TableCell>
                        {agent ? (
                          <Link
                            href={`/agents/${agent.id}`}
                            className="flex items-center gap-1.5 hover:underline"
                          >
                            <span className="text-sm font-medium">{agent.full_name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {agent.agent_code}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">{t("unlinked")}</span>
                        )}
                      </TableCell>

                      {/* Case */}
                      <TableCell>
                        {d.cases ? (
                          <Link
                            href={`/cases/${d.case_id}`}
                            className="font-mono text-xs font-medium text-primary hover:underline"
                          >
                            {d.cases.case_number}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>

                      {/* Battery */}
                      <TableCell>
                        <BatteryIcon pct={agent?.battery_pct ?? null} />
                      </TableCell>

                      {/* Speed */}
                      <TableCell>
                        {agent?.speed_kmh != null ? (
                          <span className="flex items-center gap-1 font-mono text-xs">
                            <Gauge className="h-3 w-3 text-muted-foreground/60" />
                            {Math.round(agent.speed_kmh)} km/h
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>

                      {/* Last seen */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs ${staleRow ? "text-amber-500" : "text-foreground/70"}`}>
                            {timeAgo(agent?.last_active ?? null)}
                          </span>
                          {hasLoc && (
                            <Link
                              href="/map"
                              className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                            >
                              <MapPin className="h-2.5 w-2.5" />
                              {t("viewOnMap")}
                            </Link>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {agent ? (
                          <AgentStatusBadge status={staleRow ? "offline" : agent.status} />
                        ) : (
                          <span className="text-xs text-muted-foreground/50">{t("unlinked")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Polling info footer */}
      <p className="text-center text-[11px] text-muted-foreground/50">
        {t("pollingNote")}
      </p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}
