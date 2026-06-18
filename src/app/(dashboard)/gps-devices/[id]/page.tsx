import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  Battery,
  BatteryLow,
  Briefcase,
  CheckCircle2,
  Clock,
  Compass,
  Gauge,
  MapPin,
  Navigation,
  Radio,
  Satellite,
  User,
  XCircle,
  Zap,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AgentStatusBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PollNowButton } from "@/components/gps903/poll-now-button";
import { RelinkAgentDialog } from "@/components/gps903/relink-agent-dialog";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `GPS Device — ${id.slice(0, 8)}` };
}

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

function fmtCoord(n: number | null): string {
  return n == null ? "—" : n.toFixed(6);
}

function BatteryDisplay({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const color = pct <= 20 ? "text-red-500" : pct <= 40 ? "text-amber-500" : "text-emerald-500";
  const Icon  = pct <= 20 ? BatteryLow : Battery;
  return (
    <span className={`flex items-center gap-1.5 font-mono text-sm font-medium ${color}`}>
      <Icon className="h-4 w-4" /> {pct}%
    </span>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  GPS903: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  AIS:    "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  TRUE:   "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  DTAC:   "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
};

export default async function GpsDeviceDetailPage({ params }: Props) {
  const { id } = await params;
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("gpsDevices");
  const supabase = await createClient();

  const [deviceRes, agentsRes] = await Promise.all([
    supabase
      .from("gps_devices")
      .select(`
        id, imei, phone_number, gps903_device_id, provider, notes, case_id,
        last_polled_at, last_poll_ok, agent_id, created_at,
        cases ( id, case_number ),
        agents (
          id, full_name, agent_code, status, photo_url,
          speed_kmh, heading, battery_pct, is_charging, last_active,
          current_lat, current_lng
        )
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),

    supabase
      .from("agents")
      .select("id, full_name, agent_code")
      .order("full_name"),
  ]);

  const device = deviceRes.data as any;
  if (!device) notFound();

  const allAgents = (agentsRes.data ?? []) as { id: string; full_name: string; agent_code: string }[];
  const agent     = device.agents as any;
  const now       = Date.now();
  const stale     = !agent || now - new Date(agent.last_active ?? 0).getTime() >= STALE_MS;

  // Last 48h of location history for the linked agent
  const historyRes = agent
    ? await supabase
        .from("agent_location_history")
        .select("lat, lng, speed_kmh, heading, recorded_at")
        .eq("agent_id", agent.id)
        .gte("recorded_at", new Date(now - 48 * 60 * 60 * 1000).toISOString())
        .order("recorded_at", { ascending: false })
        .limit(100)
    : null;

  const history = (historyRes?.data ?? []) as any[];

  const pollOk = device.last_poll_ok;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
          <Link href="/gps-devices">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("title")}
          </Link>
        </Button>
      </div>

      {/* Device title bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Satellite className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="font-mono text-lg font-bold">
              GPS903-{device.gps903_device_id ?? "—"}
            </h1>
            {device.notes && (
              <p className="text-sm text-muted-foreground">{device.notes}</p>
            )}
          </div>
          {device.provider && (
            <span
              className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-bold tracking-wider ${
                PROVIDER_COLORS[device.provider] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {device.provider}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              pollOk === true  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
              pollOk === false ? "bg-red-500/10 text-red-500" :
              "bg-muted text-muted-foreground"
            }`}
          >
            {pollOk === true  && <CheckCircle2 className="h-3 w-3" />}
            {pollOk === false && <XCircle      className="h-3 w-3" />}
            {pollOk === true  ? "Last poll OK" :
             pollOk === false ? "Last poll failed" :
             "Never polled"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <PollNowButton deviceId={device.id} />
          <RelinkAgentDialog
            deviceId={device.id}
            currentAgentId={device.agent_id}
            agents={allAgents}
          />
        </div>
      </div>

      {/* Info grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Device info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Radio className="h-4 w-4 text-emerald-500" />
              {t("detail.deviceInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="GPS903 ID" value={device.gps903_device_id ? `#${device.gps903_device_id}` : "—"} mono />
            <InfoRow label="IMEI"      value={device.imei ?? "—"} mono />
            <InfoRow label="SIM"       value={device.phone_number ?? "—"} mono />
            <InfoRow label="Provider"  value={device.provider ?? "—"} />
            <InfoRow label="Last poll" value={timeAgo(device.last_polled_at)} />
            <InfoRow label="Added"     value={new Date(device.created_at).toLocaleDateString()} />
            {device.cases && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Case</span>
                <Link
                  href={`/cases/${device.case_id}`}
                  className="flex items-center gap-1 font-mono text-xs font-medium text-primary hover:underline"
                >
                  <Briefcase className="h-3 w-3" />
                  {device.cases.case_number}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live telemetry */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Navigation className="h-4 w-4 text-sky-500" />
              {t("detail.telemetry")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Battery</span>
              <BatteryDisplay pct={agent?.battery_pct ?? null} />
            </div>
            {agent?.is_charging && (
              <div className="flex items-center gap-1 text-xs text-amber-500">
                <Zap className="h-3 w-3" /> Charging
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Speed
              </span>
              <span className="font-mono text-sm font-medium">
                {agent?.speed_kmh != null ? `${Math.round(agent.speed_kmh)} km/h` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Compass className="h-3.5 w-3.5" /> Heading
              </span>
              <span className="font-mono text-sm font-medium">
                {agent?.heading != null ? `${agent.heading}°` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Latitude
              </span>
              <span className="font-mono text-xs">{fmtCoord(agent?.current_lat ?? null)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Longitude
              </span>
              <span className="font-mono text-xs">{fmtCoord(agent?.current_lng ?? null)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Last seen
              </span>
              <span className={`text-xs font-medium ${stale && agent ? "text-amber-500" : ""}`}>
                {timeAgo(agent?.last_active ?? null)}
              </span>
            </div>
            {agent?.current_lat != null && (
              <Button asChild variant="outline" size="sm" className="mt-1 w-full gap-1.5 text-xs">
                <Link href="/map">
                  <MapPin className="h-3 w-3" />
                  View on Live Map
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Linked agent */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-violet-500" />
              {t("detail.linkedAgent")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agent ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-sm uppercase">
                    {agent.full_name?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{agent.full_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{agent.agent_code}</p>
                  </div>
                </div>
                <AgentStatusBadge status={stale ? "offline" : agent.status} />
                <Button asChild variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                  <Link href={`/agents/${agent.id}`}>
                    <User className="h-3 w-3" />
                    View Agent Profile
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <User className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">{t("unlinked")}</p>
                <p className="text-[11px] text-muted-foreground/60">
                  Link an agent above to enable Live Map updates.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Location history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {t("detail.history")}
            <Badge variant="secondary" className="ml-auto text-[10px]">
              Last 48h · {history.length} points
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Clock className="h-6 w-6 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                {agent ? t("detail.noHistory") : t("detail.noAgentHistory")}
              </p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{t("detail.histCol.time")}</TableHead>
                    <TableHead className="text-xs">{t("detail.histCol.lat")}</TableHead>
                    <TableHead className="text-xs">{t("detail.histCol.lng")}</TableHead>
                    <TableHead className="text-xs">{t("detail.histCol.speed")}</TableHead>
                    <TableHead className="text-xs">{t("detail.histCol.heading")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h: any, i: number) => (
                    <TableRow key={i} className="font-mono text-xs">
                      <TableCell className="text-muted-foreground">
                        {new Date(h.recorded_at).toLocaleString("en-GB", {
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit", second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>{h.lat.toFixed(6)}</TableCell>
                      <TableCell>{h.lng.toFixed(6)}</TableCell>
                      <TableCell>
                        {h.speed_kmh != null ? `${Math.round(h.speed_kmh)} km/h` : "—"}
                      </TableCell>
                      <TableCell>
                        {h.heading != null ? `${h.heading}°` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
