"use client";

import { useState, useEffect, useCallback } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import {
  Battery,
  BatteryLow,
  CalendarClock,
  Gauge,
  MapPinOff,
  Phone,
  RefreshCw,
  Satellite,
  Search,
  Signal,
  Timer,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_MAP_CENTER } from "@/lib/constants";
import type { GpsDeviceForMap, UserRole } from "@/lib/types";

const MAP_ID   = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "detective-pulse-ops-map";
const STALE_MS = 10 * 60 * 1000;

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatBangkokTime(ts: string | null | undefined): string {
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

function formatStopMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return "—";
  if (minutes === 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Locate mode ────────────────────────────────────────────────────────────

const LOCATE_CFG = {
  gps:     { label: "GPS",     cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", color: "#10b981" },
  lbs:     { label: "LBS",     cls: "bg-amber-500/10   text-amber-400   border-amber-500/20",   color: "#f59e0b" },
  offline: { label: "OFFLINE", cls: "bg-red-500/10     text-red-400     border-red-500/20",     color: "#ef4444" },
  unknown: { label: "?",       cls: "bg-muted text-muted-foreground border-border",             color: "#64748b" },
} as const;

type LocateKey = keyof typeof LOCATE_CFG;

function getLocateKey(device: GpsDeviceForMap): LocateKey {
  const stale = !device.last_seen_at
    || Date.now() - new Date(device.last_seen_at).getTime() >= STALE_MS;
  if (stale) return "offline";
  return (device.last_locate_mode as LocateKey | null) ?? "unknown";
}

// ─── Provider badge ─────────────────────────────────────────────────────────

const PROVIDER_CFG: Record<string, string> = {
  AIS:    "bg-green-500/10  text-green-400  border-green-500/20",
  TRUE:   "bg-red-500/10    text-red-400    border-red-500/20",
  DTAC:   "bg-blue-500/10   text-blue-400   border-blue-500/20",
  GPS903: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

// ─── Device display helpers ──────────────────────────────────────────────────

function deviceDisplayName(d: GpsDeviceForMap): string {
  return d.cred_name ?? d.notes ?? `GPS903-${d.gps903_device_id ?? "?"}`;
}

// ─── GPS marker ─────────────────────────────────────────────────────────────

function GpsMarker({
  device, isSelected, onClick,
}: {
  device: GpsDeviceForMap;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { color } = LOCATE_CFG[getLocateKey(device)];
  const moving = (device.last_speed_kmh ?? 0) > 1;

  return (
    <AdvancedMarker
      position={{ lat: Number(device.last_lat), lng: Number(device.last_lng) }}
      onClick={onClick}
      zIndex={isSelected ? 500 : 10}
    >
      <div
        className="relative cursor-pointer select-none"
        style={{ transform: isSelected ? "scale(1.25)" : "scale(1)", transition: "transform 0.15s" }}
      >
        {moving && (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-25"
            style={{ backgroundColor: color }}
          />
        )}
        <div
          className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-md"
          style={{ borderColor: color, backgroundColor: `${color}20` }}
        >
          <Satellite className="h-4 w-4" style={{ color }} />
        </div>
      </div>
    </AdvancedMarker>
  );
}

// ─── GPS popup (InfoWindow) ──────────────────────────────────────────────────

function GpsPopup({ device, onClose }: { device: GpsDeviceForMap; onClose: () => void }) {
  const lk         = getLocateKey(device);
  const cfg        = LOCATE_CFG[lk];
  const dispName   = deviceDisplayName(device);
  const dispImei   = device.cred_imei   ?? device.imei;
  const dispPhone  = device.cred_phone;
  const dispProv   = device.cred_provider ?? device.provider;
  const battery    = device.last_battery_pct;

  return (
    <InfoWindow
      position={{ lat: Number(device.last_lat), lng: Number(device.last_lng) }}
      onCloseClick={onClose}
      pixelOffset={[0, -44]}
    >
      <div className="w-60 space-y-2 p-1 text-sm">
        {/* Header: name + locate mode badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-tight text-foreground">{dispName}</p>
            {dispImei && (
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{dispImei}</p>
            )}
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold ${cfg.cls}`}>
            <Signal className="h-2.5 w-2.5" />
            {cfg.label}
          </span>
        </div>

        {/* Phone + Provider */}
        {(dispPhone || dispProv) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {dispPhone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />{dispPhone}
              </span>
            )}
            {dispProv && (
              <span className={`inline-flex items-center rounded-md border px-1 py-0.5 font-mono text-[10px] font-bold ${PROVIDER_CFG[dispProv] ?? "bg-muted border-border text-muted-foreground"}`}>
                {dispProv}
              </span>
            )}
          </div>
        )}

        <div className="border-t border-border/40" />

        {/* Telemetry */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              {(battery ?? 100) <= 20
                ? <BatteryLow className="h-3.5 w-3.5 text-red-500" />
                : <Battery    className="h-3.5 w-3.5 text-emerald-500" />}
              <span className="font-mono">{battery != null ? `${battery}%` : "—"}</span>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              <span className="font-mono">
                {device.last_speed_kmh != null ? `${Math.round(Number(device.last_speed_kmh))} km/h` : "—"}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <span>{formatBangkokTime(device.last_position_time)}</span>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground">
            <Timer className="h-3.5 w-3.5 shrink-0" />
            <span>{formatStopMinutes(device.last_stop_minutes)}</span>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground">
            <Satellite className="h-3.5 w-3.5 shrink-0" />
            <span>{formatBangkokTime(device.last_seen_at)}</span>
          </div>

          <div className="flex items-center gap-1">
            <Zap className={`h-3.5 w-3.5 shrink-0 ${device.last_ignition ? "text-emerald-500" : "text-muted-foreground/40"}`} />
            <span className={device.last_ignition ? "font-medium text-emerald-500" : "text-muted-foreground"}>
              {device.last_ignition == null ? "—" : device.last_ignition ? "ACC ON" : "ACC OFF"}
            </span>
          </div>
        </div>

        {device.case_number && (
          <>
            <div className="border-t border-border/40" />
            <p className="font-mono text-xs font-medium text-primary">{device.case_number}</p>
          </>
        )}
      </div>
    </InfoWindow>
  );
}

// ─── Device list card ────────────────────────────────────────────────────────

function DeviceCard({
  device, isSelected, onClick,
}: {
  device: GpsDeviceForMap;
  isSelected: boolean;
  onClick: () => void;
}) {
  const lk     = getLocateKey(device);
  const { label, cls, color } = LOCATE_CFG[lk];
  const name   = deviceDisplayName(device);
  const battery = device.last_battery_pct;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-muted/50 ${
        isSelected ? "bg-primary/5" : ""
      }`}
    >
      {/* Icon */}
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: color, backgroundColor: `${color}18` }}
      >
        <Satellite className="h-3.5 w-3.5" style={{ color }} />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-xs font-medium leading-tight">{name}</p>
          <span className={`shrink-0 rounded border px-1 py-0.5 font-mono text-[9px] font-bold ${cls}`}>
            {label}
          </span>
        </div>
        {device.case_number && (
          <p className="mt-0.5 font-mono text-[10px] font-medium text-primary">{device.case_number}</p>
        )}
        <div className="mt-0.5 flex items-center gap-2.5 text-[10px] text-muted-foreground">
          {battery != null && <span>{battery}%</span>}
          <span>{timeAgo(device.last_seen_at)}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Row flattening for client-side refresh ──────────────────────────────────

type RawRow = {
  cases: { case_number: string } | null;
  gps903_credentials: { device_name: string | null; imei: string | null; phone_number: string | null; provider: string | null } | null;
  [key: string]: unknown;
};

function flattenRow(row: RawRow): GpsDeviceForMap {
  return {
    ...(row as unknown as GpsDeviceForMap),
    case_number:   row.cases?.case_number                    ?? null,
    cred_name:     row.gps903_credentials?.device_name      ?? null,
    cred_imei:     row.gps903_credentials?.imei             ?? null,
    cred_phone:    row.gps903_credentials?.phone_number     ?? null,
    cred_provider: row.gps903_credentials?.provider         ?? null,
  };
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  initialDevices: GpsDeviceForMap[];
  role:           UserRole;
}

export function GpsMonitorMap({ initialDevices, role: _role }: Props) {
  const [devices,    setDevices]    = useState(initialDevices);
  const [selected,   setSelected]   = useState<GpsDeviceForMap | null>(null);
  const [search,     setSearch]     = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel  = supabase
      .channel("gps-monitor-rt")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gps_devices" },
        (payload) => {
          const updated = payload.new as Partial<GpsDeviceForMap> & { id: string };
          setDevices((prev) =>
            prev.map((d) => d.id === updated.id ? { ...d, ...updated } : d),
          );
          setSelected((prev) =>
            prev?.id === updated.id ? { ...prev, ...updated } : prev,
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Manual refresh ─────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("gps_devices")
        .select("*, cases(case_number), gps903_credentials(device_name, imei, phone_number, provider)")
        .not("last_lat", "is", null)
        .is("deleted_at", null)
        .order("last_seen_at", { ascending: false });

      if (data) {
        setDevices((data as unknown as RawRow[]).map(flattenRow));
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = devices.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      deviceDisplayName(d).toLowerCase().includes(q) ||
      (d.cred_imei ?? d.imei ?? "").toLowerCase().includes(q) ||
      (d.case_number  ?? "").toLowerCase().includes(q) ||
      (d.cred_phone   ?? "").toLowerCase().includes(q) ||
      (d.gps903_device_id != null && String(d.gps903_device_id).includes(q))
    );
  });

  const onMap = filtered.filter((d) => d.last_lat != null && d.last_lng != null);

  if (!apiKey) {
    return (
      <div className="rounded-lg border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        Google Maps API key not configured (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-3">
      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <Satellite className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">GPS Devices</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {filtered.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Search */}
        <div className="border-b border-border/40 p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Search devices…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>

        {/* Device list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <MapPinOff className="h-8 w-8 text-muted-foreground/25" />
              <p className="text-xs text-muted-foreground">
                {devices.length === 0 ? "No GPS devices assigned to your cases." : "No results."}
              </p>
            </div>
          ) : (
            filtered.map((d) => (
              <DeviceCard
                key={d.id}
                device={d}
                isSelected={selected?.id === d.id}
                onClick={() => setSelected((prev) => (prev?.id === d.id ? null : d))}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden rounded-lg border shadow-sm">
        <APIProvider apiKey={apiKey}>
          <Map
            mapId={MAP_ID}
            defaultCenter={DEFAULT_MAP_CENTER}
            defaultZoom={11}
            gestureHandling="greedy"
            disableDefaultUI={false}
            className="h-full w-full"
          >
            {onMap.map((d) => (
              <GpsMarker
                key={d.id}
                device={d}
                isSelected={selected?.id === d.id}
                onClick={() => setSelected((prev) => (prev?.id === d.id ? null : d))}
              />
            ))}

            {selected && selected.last_lat != null && selected.last_lng != null && (
              <GpsPopup
                device={selected}
                onClose={() => setSelected(null)}
              />
            )}
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}
