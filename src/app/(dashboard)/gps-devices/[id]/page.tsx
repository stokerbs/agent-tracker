import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  Battery,
  BatteryLow,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock,
  Compass,
  Gauge,
  Lock,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Satellite,
  Signal,
  Timer,
  User,
  XCircle,
  Zap,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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
import { PollNowButton }           from "@/components/gps903/poll-now-button";
import { RelinkAgentDialog }        from "@/components/gps903/relink-agent-dialog";
import { DevicePermissionsPanel }   from "@/components/gps903/device-permissions-panel";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
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

/** Format a UTC timestamp for display in Asia/Bangkok (GMT+7). */
function formatBangkokTime(ts: string | null): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone:  "Asia/Bangkok",
      day:       "2-digit",
      month:     "short",
      year:      "numeric",
      hour:      "2-digit",
      minute:    "2-digit",
      second:    "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}:${get("second")} GMT+7`;
  } catch { return "—"; }
}

function formatStopMinutes(minutes: number | null): string {
  if (minutes === null || minutes < 0) return "—";
  if (minutes === 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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

type LocateMode = "gps" | "lbs" | "offline" | "unknown" | null;

const LOCATE_MODE_CFG: Record<string, { label: string; cls: string }> = {
  gps:     { label: "GPS",     cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  lbs:     { label: "LBS",     cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  offline: { label: "OFFLINE", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
  unknown: { label: "UNKNOWN", cls: "bg-muted text-muted-foreground border-border" },
};

function LocateModeBadge({ mode, isStale }: { mode: LocateMode; isStale: boolean }) {
  const key = isStale ? "offline" : (mode ?? "unknown");
  const cfg = LOCATE_MODE_CFG[key] ?? LOCATE_MODE_CFG.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider ${cfg.cls}`}>
      <Signal className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  GPS903: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  AIS:    "bg-green-500/10  text-green-600  dark:text-green-400  border-green-500/20",
  TRUE:   "bg-red-500/10    text-red-600    dark:text-red-400    border-red-500/20",
  DTAC:   "bg-blue-500/10   text-blue-600   dark:text-blue-400   border-blue-500/20",
};

const TABS = [
  { key: "info",        label: "Device Info" },
  { key: "permissions", label: "Permissions" },
  { key: "history",     label: "Position History" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default async function GpsDeviceDetailPage({ params, searchParams }: Props) {
  const { id }  = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS.map((t) => t.key) as string[]).includes(rawTab ?? "")
    ? (rawTab as Tab)
    : "info";

  const actor = await requireRole(["admin", "supervisor"]);
  const t      = await getTranslations("gpsDevices");
  const supabase    = await createClient();
  const serviceSup  = createServiceClient();

  // ── Device (user-scoped — RLS enforces visibility) ──
  const [deviceRes, agentsRes] = await Promise.all([
    supabase
      .from("gps_devices")
      .select(`
        id, imei, phone_number, gps903_device_id, provider, notes, case_id,
        last_polled_at, last_poll_ok, last_battery_pct, last_speed_kmh, last_heading,
        last_lat, last_lng, last_seen_at, last_locate_mode, last_position_time, last_stop_minutes, last_ignition,
        agent_id, created_at,
        cases ( id, case_number ),
        agents ( id, full_name, agent_code, status, photo_url )
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
  const stale     = !device.last_seen_at || now - new Date(device.last_seen_at).getTime() >= STALE_MS;
  const pollOk    = device.last_poll_ok;
  const isAdmin   = actor.role === "admin";

  // ── Tab-specific data ──
  let history:    any[]                             = [];
  let profiles:   { id: string; full_name: string | null; email: string; role: string; avatar_url: string | null }[] = [];
  let grantedIds: string[]                          = [];

  if (tab === "history") {
    const res = await supabase
      .from("gps_device_positions")
      .select("lat, lng, speed_kmh, heading, recorded_at")
      .eq("gps_device_id", device.id)
      .gte("recorded_at", new Date(now - 48 * 60 * 60 * 1000).toISOString())
      .order("recorded_at", { ascending: false })
      .limit(100);
    history = (res.data ?? []) as any[];
  }

  if (tab === "permissions") {
    const [profilesRes, accessRes] = await Promise.all([
      // Service client: list all non-admin, non-client profiles for the permission picker
      serviceSup
        .from("profiles")
        .select("id, full_name, email, role, avatar_url")
        .in("role", ["supervisor", "agent"])
        .eq("is_active", true)
        .order("full_name"),

      // Existing grants for this device
      serviceSup
        .from("gps_device_access")
        .select("profile_id")
        .eq("gps_device_id", device.id),
    ]);

    profiles   = (profilesRes.data ?? []) as typeof profiles;
    grantedIds = (accessRes.data ?? []).map((r: { profile_id: string }) => r.profile_id);
  }

  const deviceLabel = device.notes ?? `GPS903-${device.gps903_device_id ?? "—"}`;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
        <Link href="/gps-devices">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("title")}
        </Link>
      </Button>

      {/* Title bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Satellite className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="font-mono text-lg font-bold">GPS903-{device.gps903_device_id ?? "—"}</h1>
            {device.notes && <p className="text-sm text-muted-foreground">{device.notes}</p>}
            <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground/70">
              <Phone className="h-3 w-3 shrink-0" />
              {device.phone_number ?? "—"}
            </p>
          </div>
          {device.provider && (
            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-bold tracking-wider ${
              PROVIDER_COLORS[device.provider] ?? "bg-muted text-muted-foreground"
            }`}>
              {device.provider}
            </span>
          )}
          <LocateModeBadge mode={device.last_locate_mode ?? null} isStale={stale} />
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            pollOk === true  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
            pollOk === false ? "bg-red-500/10 text-red-500" :
            "bg-muted text-muted-foreground"
          }`}>
            {pollOk === true  && <CheckCircle2 className="h-3 w-3" />}
            {pollOk === false && <XCircle      className="h-3 w-3" />}
            {pollOk === true ? "Last poll OK" : pollOk === false ? "Last poll failed" : "Never polled"}
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

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/60 pb-px">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={`?tab=${key}`}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {key === "permissions" && <Lock className="h-3.5 w-3.5" />}
            {label}
            {key === "permissions" && grantedIds.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">
                {grantedIds.length}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── Tab: Info ── */}
      {tab === "info" && (
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
                <BatteryDisplay pct={device.last_battery_pct ?? null} />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" /> Speed
                </span>
                <span className="font-mono text-sm font-medium">
                  {device.last_speed_kmh != null ? `${Math.round(device.last_speed_kmh)} km/h` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Compass className="h-3.5 w-3.5" /> Heading
                </span>
                <span className="font-mono text-sm font-medium">
                  {device.last_heading != null ? `${device.last_heading}°` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" /> Position time
                </span>
                <span className="font-mono text-xs font-medium">
                  {formatBangkokTime(device.last_position_time ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Timer className="h-3.5 w-3.5" /> Stop time
                </span>
                <span className="font-mono text-sm font-medium">
                  {formatStopMinutes(device.last_stop_minutes ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Latitude
                </span>
                <span className="font-mono text-xs">{fmtCoord(device.last_lat ?? null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Longitude
                </span>
                <span className="font-mono text-xs">{fmtCoord(device.last_lng ?? null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Last seen
                </span>
                <span className={`font-mono text-xs font-medium ${stale && device.last_seen_at ? "text-amber-500" : ""}`}>
                  {formatBangkokTime(device.last_seen_at ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Signal className="h-3.5 w-3.5" /> Locate mode
                </span>
                <LocateModeBadge mode={device.last_locate_mode ?? null} isStale={stale} />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Zap className="h-3.5 w-3.5" /> ACC
                </span>
                <span className={`font-mono text-sm font-medium ${
                  device.last_ignition === true  ? "text-emerald-600 dark:text-emerald-400"
                  : device.last_ignition === false ? "text-muted-foreground"
                  : "text-muted-foreground/50"
                }`}>
                  {device.last_ignition === null ? "—" : device.last_ignition ? "ON" : "OFF"}
                </span>
              </div>
              {device.last_lat != null && (
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                      {agent.full_name?.[0] ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{agent.full_name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{agent.agent_code}</p>
                    </div>
                  </div>
                  <AgentStatusBadge status={agent.status} />
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
                    Link an agent above to associate field activity.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Permissions ── */}
      {tab === "permissions" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 text-amber-500" />
              Visibility Permissions
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {grantedIds.length} user{grantedIds.length !== 1 ? "s" : ""} granted
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAdmin || actor.role === "supervisor" ? (
              <DevicePermissionsPanel
                deviceId={device.id}
                profiles={profiles}
                grantedIds={grantedIds}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Only admins and supervisors can manage GPS device permissions.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Position History ── */}
      {tab === "history" && (
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
                <p className="text-xs text-muted-foreground">{t("detail.noHistory")}</p>
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
                            timeZone: "Asia/Bangkok",
                            day: "2-digit", month: "short",
                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                            hourCycle: "h23",
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
      )}
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
