"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  Battery,
  BatteryLow,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Gauge,
  History,
  Maximize2,
  LocateFixed,
  Minimize2,
  MapPinOff,
  Navigation,
  Phone,
  RefreshCw,
  Satellite,
  Search,
  Signal,
  Timer,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_MAP_CENTER } from "@/lib/constants";
import { MAP_ID, STALE_MS, formatBangkokTime, formatStopMinutes } from "@/lib/maps/shared";
import { useMapFullscreen } from "@/lib/maps/use-map-fullscreen";
import { RouteReplay } from "@/components/gps903/route-replay";
import type { GpsDeviceForMap, UserRole } from "@/lib/types";

// ─── Formatting ──────────────────────────────────────────────────────────────

function timeAgo(ts: string | null | undefined, justNow: string, never: string): string {
  if (!ts) return never;
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return justNow;
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const LOCATE_CFG = {
  gps:     { label: "GPS",     cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", color: "#10b981" },
  lbs:     { label: "LBS",     cls: "bg-amber-500/10   text-amber-400   border-amber-500/20",   color: "#f59e0b" },
  online:  { label: "ONLINE",  cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", color: "#10b981" },
  offline: { label: "OFFLINE", cls: "bg-red-500/10     text-red-400     border-red-500/20",     color: "#ef4444" },
  unknown: { label: "?",       cls: "bg-muted text-muted-foreground border-border",             color: "#64748b" },
} as const;

type LocateKey = keyof typeof LOCATE_CFG;

// Connectivity (online/offline) is decided by recency of the last successful
// poll; only THEN do we report the fix type (GPS vs LBS). A device that is
// reporting but whose fix type we couldn't classify is still ONLINE — not the
// grey "unknown"/offline it used to fall through to.
function getLocateKey(d: GpsDeviceForMap): LocateKey {
  const stale = !d.last_seen_at || Date.now() - new Date(d.last_seen_at).getTime() >= STALE_MS;
  if (stale) return "offline";
  const mode = d.last_locate_mode as string | null;
  if (mode === "gps" || mode === "lbs") return mode;
  return "online";
}

const PROVIDER_CFG: Record<string, string> = {
  AIS:    "bg-green-500/10  text-green-400  border-green-500/20",
  TRUE:   "bg-red-500/10    text-red-400    border-red-500/20",
  DTAC:   "bg-blue-500/10   text-blue-400   border-blue-500/20",
  GPS903: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function deviceName(d: GpsDeviceForMap): string {
  return d.cred_name ?? d.notes ?? `GPS903-${d.gps903_device_id ?? "?"}`;
}

// ─── Map panner (must live inside <Map>) ─────────────────────────────────────

function MapPanner({ target }: { target: google.maps.LatLngLiteral | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && target) map.panTo(target);
  }, [map, target]);
  return null;
}

// Fits the map to the given points when `nonce` changes (button-triggered), so
// the viewer + GPS device(s) are all visible. One point → pan + zoom in.
function FitToDevices({ nonce, points }: { nonce: number; points: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || nonce === 0 || points.length === 0) return;
    if (points.length === 1) {
      map.panTo(points[0]);
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 64);
    // Only re-fit on an explicit button press (nonce), not on every position tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);
  return null;
}

// ─── GPS marker ──────────────────────────────────────────────────────────────

function GpsMarker({ device, isSelected, onClick }: {
  device: GpsDeviceForMap; isSelected: boolean; onClick: () => void;
}) {
  const { color } = LOCATE_CFG[getLocateKey(device)];
  const moving    = (device.last_speed_kmh ?? 0) > 1;
  return (
    <AdvancedMarker
      position={{ lat: Number(device.last_lat), lng: Number(device.last_lng) }}
      onClick={onClick}
      zIndex={isSelected ? 500 : 10}
    >
      <div
        className="relative cursor-pointer select-none"
        style={{ transform: isSelected ? "scale(1.3)" : "scale(1)", transition: "transform 0.15s" }}
      >
        {moving && (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-40"
            style={{ backgroundColor: color }}
          />
        )}
        <div
          className="relative flex h-10 w-10 items-center justify-center rounded-full shadow-lg ring-2 ring-white"
          style={{ backgroundColor: color, boxShadow: `0 2px 8px ${color}99, 0 0 0 1px ${color}` }}
        >
          <Satellite className="h-5 w-5 text-white drop-shadow" strokeWidth={2.5} />
        </div>
      </div>
    </AdvancedMarker>
  );
}

// ─── Viewer's own live position ("you are here") ────────────────────────────

function MyLocationMarker({ position }: { position: google.maps.LatLngLiteral }) {
  return (
    <AdvancedMarker position={position} zIndex={1000} title="ตำแหน่งของคุณ">
      <div className="relative flex items-center justify-center">
        <span className="absolute h-8 w-8 animate-ping rounded-full bg-sky-400/30" />
        <span className="relative h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
      </div>
    </AdvancedMarker>
  );
}

// Haversine distance, formatted "ห่างจากคุณ ~120 ม." / "~3.4 กม.".
function distanceFromMe(
  me: google.maps.LatLngLiteral,
  lat: number,
  lng: number,
): string {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat - me.lat);
  const dLng = toRad(lng - me.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(me.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  const m = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return m < 1000 ? `~${Math.round(m)} ม.` : `~${(m / 1000).toFixed(1)} กม.`;
}

// ─── GPS popup (InfoWindow — compact + expandable) ───────────────────────────

function GpsPopup({ device, myPos, onClose, onReplay }: {
  device: GpsDeviceForMap; myPos: google.maps.LatLngLiteral | null; onClose: () => void; onReplay: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const t        = useTranslations("gpsMonitor");
  const tCommon  = useTranslations("common");
  const stale    = !device.last_seen_at || Date.now() - new Date(device.last_seen_at).getTime() >= STALE_MS;
  const online   = !stale;
  const sigMode  = device.last_locate_mode as string | null;
  const name     = deviceName(device);
  const battery  = device.last_battery_pct;
  const dispImei = device.cred_imei   ?? device.imei;
  const dispPhone = device.cred_phone;
  const dispProv = device.cred_provider ?? device.provider;

  return (
    <InfoWindow
      position={{ lat: Number(device.last_lat), lng: Number(device.last_lng) }}
      onCloseClick={onClose}
      pixelOffset={[0, -46]}
    >
      <div className="min-w-[200px] max-w-[240px] space-y-2 p-1 text-sm">

        {/* ── Header: name + connectivity + signal-type badges ── */}
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-tight text-foreground">{name}</p>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {/* connectivity */}
            <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
              online ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                     : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`} />
              {online ? "ONLINE" : "OFFLINE"}
            </span>
            {/* signal type (GPS vs LBS) — shown whenever known */}
            {(sigMode === "gps" || sigMode === "lbs") && (
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold ${LOCATE_CFG[sigMode].cls}`}>
                <Signal className="h-2.5 w-2.5" />{LOCATE_CFG[sigMode].label}
              </span>
            )}
          </div>
        </div>

        {/* ── Compact telemetry row ── */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
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
          <span className="flex items-center gap-1 text-muted-foreground">
            <Timer className="h-3.5 w-3.5" />
            {formatStopMinutes(device.last_stop_minutes)}
          </span>
        </div>

        {/* ── Distance from the viewer ── */}
        {myPos && device.last_lat != null && device.last_lng != null && (
          <div className="flex items-center gap-1 text-xs font-medium text-sky-400">
            <Navigation className="h-3.5 w-3.5" />
            <span>ห่างจากคุณ {distanceFromMe(myPos, Number(device.last_lat), Number(device.last_lng))}</span>
          </div>
        )}

        {/* ── Expanded details ── */}
        {expanded && (
          <div className="space-y-1 border-t border-border/40 pt-1.5 text-xs">
            {(dispPhone || dispProv) && (
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                {dispPhone && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{dispPhone}</span>
                )}
                {dispProv && (
                  <span className={`inline-flex items-center rounded-md border px-1 py-0.5 font-mono text-[10px] font-bold ${PROVIDER_CFG[dispProv] ?? "bg-muted border-border text-muted-foreground"}`}>
                    {dispProv}
                  </span>
                )}
              </div>
            )}
            {dispImei && (
              <p className="font-mono text-[10px] text-muted-foreground/70">{dispImei}</p>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              <span>{formatBangkokTime(device.last_position_time)}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Satellite className="h-3.5 w-3.5 shrink-0" />
              <span>{formatBangkokTime(device.last_seen_at)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className={`h-3.5 w-3.5 shrink-0 ${device.last_ignition ? "text-emerald-500" : "text-muted-foreground/40"}`} />
              <span className={device.last_ignition ? "font-medium text-emerald-500" : "text-muted-foreground"}>
                {device.last_ignition == null ? "—" : device.last_ignition ? t("accOn") : t("accOff")}
              </span>
            </div>
            {device.case_number && (
              <p className="font-mono text-xs font-semibold text-primary">{device.case_number}</p>
            )}
          </div>
        )}

        {/* ── Actions: navigate (Google Maps) + route replay ── */}
        {device.last_lat != null && device.last_lng != null && (
          <div className="flex gap-1.5">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${Number(device.last_lat)},${Number(device.last_lng)}&travelmode=driving`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Navigation className="h-3.5 w-3.5" />
              นำทาง
            </a>
            <button
              onClick={onReplay}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/60 px-2 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <History className="h-3.5 w-3.5" />
              ย้อนเส้นทาง
            </button>
          </div>
        )}

        {/* ── Details toggle ── */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-end gap-0.5 text-[11px] font-medium text-primary hover:underline"
        >
          {expanded ? tCommon("less") : tCommon("details")}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>
    </InfoWindow>
  );
}

// ─── Desktop sidebar card ────────────────────────────────────────────────────

function DeviceCard({ device, isSelected, onClick, justNow, never }: {
  device: GpsDeviceForMap; isSelected: boolean; onClick: () => void;
  justNow: string; never: string;
}) {
  const lk = getLocateKey(device);
  const { label, cls, color } = LOCATE_CFG[lk];
  const name = deviceName(device);
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-muted/50 ${
        isSelected ? "bg-primary/5" : ""
      }`}
    >
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: color, backgroundColor: `${color}18` }}
      >
        <Satellite className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-xs font-medium leading-tight">{name}</p>
          <span className={`shrink-0 rounded border px-1 py-0.5 font-mono text-[9px] font-bold ${cls}`}>{label}</span>
        </div>
        {device.case_number && (
          <p className="mt-0.5 font-mono text-[10px] font-medium text-primary">{device.case_number}</p>
        )}
        <div className="mt-0.5 flex items-center gap-2.5 text-[10px] text-muted-foreground">
          {device.last_battery_pct != null && <span>{device.last_battery_pct}%</span>}
          <span>{timeAgo(device.last_seen_at, justNow, never)}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Mobile bottom sheet ─────────────────────────────────────────────────────

function BottomSheet({ devices, filtered, selected, search, onSearch, onSelect }: {
  devices:  GpsDeviceForMap[];
  filtered: GpsDeviceForMap[];
  selected: GpsDeviceForMap | null;
  search:   string;
  onSearch: (v: string) => void;
  onSelect: (d: GpsDeviceForMap) => void;
}) {
  const [open, setOpen] = useState(false);
  const t       = useTranslations("gpsMonitor");
  const tCommon = useTranslations("common");

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 flex flex-col rounded-t-2xl border-t border-border/60 bg-card shadow-2xl transition-all duration-300"
      style={{
        maxHeight: open ? "40vh" : "3.5rem",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Handle / pill ──────────────────────────────────────────────── */}
      <button
        className="flex w-full shrink-0 items-center justify-between px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <div className="h-1 w-8 rounded-full bg-border" />
          <span className="text-sm font-medium">
            {t("devices")}
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {devices.length}
            </span>
          </span>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronUp   className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Expanded content ─────────────────────────────────────────── */}
      {open && (
        <>
          {/* Search */}
          <div className="shrink-0 border-t border-border/40 px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="h-8 pl-7 text-sm"
              />
            </div>
          </div>

          {/* Device list */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <MapPinOff className="h-7 w-7 text-muted-foreground/25" />
                <p className="text-xs text-muted-foreground">
                  {devices.length === 0 ? t("noDevices") : t("noResults")}
                </p>
              </div>
            ) : (
              filtered.map((d) => (
                <DeviceCard
                  key={d.id}
                  device={d}
                  isSelected={selected?.id === d.id}
                  onClick={() => { onSelect(d); setOpen(false); }}
                  justNow={tCommon("justNow")}
                  never={tCommon("never")}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Row flattening ───────────────────────────────────────────────────────────

type RawRow = {
  cases: { case_number: string } | null;
  gps903_credentials: { device_name: string | null; imei: string | null; phone_number: string | null; provider: string | null } | null;
  [key: string]: unknown;
};

function flattenRow(row: RawRow): GpsDeviceForMap {
  return {
    ...(row as unknown as GpsDeviceForMap),
    case_number:   row.cases?.case_number                ?? null,
    cred_name:     row.gps903_credentials?.device_name  ?? null,
    cred_imei:     row.gps903_credentials?.imei         ?? null,
    cred_phone:    row.gps903_credentials?.phone_number ?? null,
    cred_provider: row.gps903_credentials?.provider     ?? null,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialDevices: GpsDeviceForMap[];
  role:           UserRole;
}

export function GpsMonitorMap({ initialDevices, role: _role }: Props) {
  const t       = useTranslations("gpsMonitor");
  const tCommon = useTranslations("common");

  const [devices,      setDevices]      = useState(initialDevices);
  const [selected,     setSelected]     = useState<GpsDeviceForMap | null>(null);
  const [search,       setSearch]       = useState("");
  const [refreshing,   setRefreshing]   = useState(false);
  const [panTarget,    setPanTarget]    = useState<google.maps.LatLngLiteral | null>(null);
  const [myPos,        setMyPos]        = useState<google.maps.LatLngLiteral | null>(null);
  const [fitNonce,     setFitNonce]     = useState(0);
  const [replayDevice, setReplayDevice] = useState<GpsDeviceForMap | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const apiKey       = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel  = supabase
      .channel("gps-monitor-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "gps_devices" }, (payload) => {
        const updated = payload.new as Partial<GpsDeviceForMap> & { id: string };
        setDevices((prev) => prev.map((d) => d.id === updated.id ? { ...d, ...updated } : d));
        setSelected((prev) => prev?.id === updated.id ? { ...prev, ...updated } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Viewer's own live position (browser geolocation) ──────────────────────
  // So the user can see where they are relative to the tracked GPS devices.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => { /* permission denied / unavailable — just don't show the marker */ },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ── Full screen ── CSS overlay (not the browser Fullscreen API) — exit via
  // the button only, no "swipe down to exit" banner. Shared hook (TD-1).
  const { isFullscreen, toggle: toggleFullscreen } = useMapFullscreen();

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
      if (data) setDevices((data as unknown as RawRow[]).map(flattenRow));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── Device selection: pan map + collapse sheet ─────────────────────────────
  const handleSelect = useCallback((d: GpsDeviceForMap) => {
    setSelected((prev) => (prev?.id === d.id ? null : d));
    if (d.last_lat != null && d.last_lng != null) {
      setPanTarget({ lat: Number(d.last_lat), lng: Number(d.last_lng) });
    }
  }, []);

  // Recenter on the viewer's own position.
  const locateMe = useCallback(() => {
    if (myPos) setPanTarget({ lat: myPos.lat, lng: myPos.lng });
  }, [myPos]);

  // Jump the map to the GPS device(s) — fits the viewer + all devices in view.
  const goToGps = useCallback(() => setFitNonce((n) => n + 1), []);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = devices.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      deviceName(d).toLowerCase().includes(q) ||
      (d.cred_imei ?? d.imei ?? "").toLowerCase().includes(q) ||
      (d.case_number ?? "").toLowerCase().includes(q) ||
      (d.cred_phone  ?? "").toLowerCase().includes(q) ||
      (d.gps903_device_id != null && String(d.gps903_device_id).includes(q))
    );
  });

  const onMap = filtered.filter((d) => d.last_lat != null && d.last_lng != null);

  if (!apiKey) {
    return (
      <div className="rounded-lg border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        {t("noApiKey")}
      </div>
    );
  }

  return (
    /*
     * Outer container:
     *   mobile  — relative, fills remaining viewport height respecting safe areas
     *   desktop — flex row with sidebar + map
     *   fullscreen (via Fullscreen API) — the browser handles sizing; we just need
     *             the inner map to fill 100% so we keep h-full on the map container
     */
    <div
      ref={containerRef}
      className={[
        "flex flex-col overflow-hidden bg-background md:flex-row",
        isFullscreen
          /* Full screen: CSS overlay covering the viewport (button-only exit) */
          ? "fixed inset-0 z-50 h-[100dvh] w-screen"
          /* Mobile: remaining viewport height · Desktop: side-by-side panel + map */
          : "relative h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-10rem)] md:gap-3 md:rounded-lg",
      ].join(" ")}
      style={{
        paddingTop:    isFullscreen ? "env(safe-area-inset-top, 0px)"    : undefined,
        paddingBottom: isFullscreen ? "env(safe-area-inset-bottom, 0px)" : undefined,
      }}
    >
      {/* ── Desktop sidebar (hidden on mobile) ──────────────────────────── */}
      <div className="hidden md:flex md:w-72 md:shrink-0 md:flex-col md:overflow-hidden md:rounded-lg md:border md:bg-card md:shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <Satellite className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t("devicesHeader")}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {filtered.length}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh} disabled={refreshing} title={tCommon("refresh")}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {/* Search */}
        <div className="border-b border-border/40 p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <MapPinOff className="h-8 w-8 text-muted-foreground/25" />
              <p className="text-xs text-muted-foreground">
                {devices.length === 0 ? t("noDevices") : t("noResults")}
              </p>
            </div>
          ) : (
            filtered.map((d) => (
              <DeviceCard
                key={d.id}
                device={d}
                isSelected={selected?.id === d.id}
                onClick={() => handleSelect(d)}
                justNow={tCommon("justNow")}
                never={tCommon("never")}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Map area ────────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden md:rounded-lg md:border md:shadow-sm">
        <APIProvider apiKey={apiKey}>
          <Map
            mapId={MAP_ID}
            defaultCenter={DEFAULT_MAP_CENTER}
            defaultZoom={11}
            gestureHandling="greedy"
            disableDefaultUI={false}
            // Our own CSS full-screen toggle replaces Google's control, which
            // calls the browser Fullscreen API (iOS "swipe down to exit").
            fullscreenControl={false}
            className="h-full w-full"
          >
            <MapPanner target={panTarget} />
            <FitToDevices
              nonce={fitNonce}
              points={[
                ...onMap.map((d) => ({ lat: Number(d.last_lat), lng: Number(d.last_lng) })),
                ...(myPos ? [myPos] : []),
              ]}
            />

            {myPos && <MyLocationMarker position={myPos} />}

            {onMap.map((d) => (
              <GpsMarker
                key={d.id}
                device={d}
                isSelected={selected?.id === d.id}
                onClick={() => handleSelect(d)}
              />
            ))}

            {selected && selected.last_lat != null && selected.last_lng != null && (
              <GpsPopup
                device={selected}
                myPos={myPos}
                onClose={() => setSelected(null)}
                onReplay={() => setReplayDevice(selected)}
              />
            )}
          </Map>
        </APIProvider>

        {/* ── Floating action buttons (top-right) ──────────────────────── */}
        <div
          className="absolute right-3 top-3 z-10 flex flex-col gap-2"
          style={{ top: isFullscreen ? "calc(env(safe-area-inset-top, 0px) + 0.75rem)" : undefined }}
        >
          <button
            onClick={goToGps}
            disabled={onMap.length === 0}
            title="ไปที่ตำแหน่ง GPS"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card shadow-md transition-opacity hover:bg-muted disabled:opacity-40"
          >
            <Satellite className="h-4 w-4 text-emerald-500" />
          </button>
          <button
            onClick={locateMe}
            disabled={!myPos}
            title="ไปที่ตำแหน่งของฉัน"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card shadow-md transition-opacity hover:bg-muted disabled:opacity-40"
          >
            <LocateFixed className="h-4 w-4 text-sky-500" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title={tCommon("refresh")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card shadow-md transition-opacity hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card shadow-md transition-opacity hover:bg-muted"
          >
            {isFullscreen
              ? <Minimize2 className="h-4 w-4 text-muted-foreground" />
              : <Maximize2 className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>

        {/* ── Mobile bottom sheet ───────────────────────────────────────── */}
        <div className="md:hidden">
          <BottomSheet
            devices={devices}
            filtered={filtered}
            selected={selected}
            search={search}
            onSearch={setSearch}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {replayDevice && (
        <RouteReplay device={replayDevice} onClose={() => setReplayDevice(null)} />
      )}
    </div>
  );
}
