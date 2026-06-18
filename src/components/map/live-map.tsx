"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  Polygon,
  Polyline,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import {
  AlertTriangle,
  Battery,
  BatteryCharging,
  BatteryMedium,
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crosshair,
  Gauge,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPinOff,
  Pencil,
  Phone,
  RefreshCw,
  Satellite,
  Shield,
  SlidersHorizontal,
  Timer,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AgentRoleBadge, AgentStatusBadge } from "@/components/shared/status-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AGENT_ROLE_META,
  AGENT_STATUS_META,
  DEFAULT_MAP_CENTER,
  GPS_REFRESH_MS,
} from "@/lib/constants";
import { batteryColor, initials, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { createGeofence, deleteGeofence } from "@/app/(dashboard)/map/actions";
import type {
  Agent,
  AgentRole,
  AgentStatus,
  AgentVehicleType,
  EmergencyAlert,
  Geofence,
  GpsDeviceForMap,
} from "@/lib/types";
import type { GeofenceEventFeed } from "@/lib/queries";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "detective-pulse-ops-map";
const AGENT_STATUSES = Object.keys(AGENT_STATUS_META) as AgentStatus[];
const STALE_MS      = 10 * 60 * 1000;
const VERY_STALE_MS = 30 * 60 * 1000;

const FENCE_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
];

// ─────────────────────────────────────────────
// Speed utilities
// ─────────────────────────────────────────────

function speedColor(kmh: number): string {
  if (kmh < 1) return "#64748b";
  if (kmh < 20) return "#22c55e";
  if (kmh < 60) return "#f59e0b";
  return "#ef4444";
}

function speedRingClass(kmh: number): string {
  if (kmh < 1) return "border-slate-400";
  if (kmh < 20) return "border-green-500";
  if (kmh < 60) return "border-amber-500";
  return "border-red-500";
}

function mapDisplayStatus(agent: Agent, now: number): AgentStatus {
  const sinceActive = agent.last_active
    ? now - new Date(agent.last_active).getTime()
    : Infinity;
  if (sinceActive > STALE_MS) return "offline";
  return agent.status;
}

// ─────────────────────────────────────────────
// Animated position hook
// ─────────────────────────────────────────────

function useAnimatedPosition(
  targetLat: number | null,
  targetLng: number | null,
  durationMs = 2500,
) {
  const currentRef = useRef<{ lat: number; lng: number } | null>(null);
  const [displayed, setDisplayed] = useState<{ lat: number; lng: number } | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (targetLat == null || targetLng == null) return;
    const target = { lat: targetLat, lng: targetLng };

    if (!currentRef.current) {
      currentRef.current = target;
      setDisplayed(target);
      return;
    }

    const delta =
      Math.abs(target.lat - currentRef.current.lat) +
      Math.abs(target.lng - currentRef.current.lng);
    if (delta < 0.000001) return;

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const from = { ...currentRef.current };
    const startTime = performance.now();

    function tick(now: number) {
      const t = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - (1 - t) ** 3;
      const interp = {
        lat: from.lat + (target.lat - from.lat) * eased,
        lng: from.lng + (target.lng - from.lng) * eased,
      };
      currentRef.current = interp;
      setDisplayed({ ...interp });
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [targetLat, targetLng, durationMs]);

  return displayed;
}

// ─────────────────────────────────────────────
// Vehicle icons
// ─────────────────────────────────────────────

function VehicleIcon({
  type,
  size = 18,
  color = "currentColor",
}: {
  type: AgentVehicleType | null;
  size?: number;
  color?: string;
}) {
  const shared = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: 1.8,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "car":
      return (
        <svg {...shared}>
          <path d="M7 17H5a2 2 0 01-2-2v-4l3-6h12l3 6v4a2 2 0 01-2 2h-2" />
          <rect x="7" y="14" width="10" height="5" rx="1" />
          <circle cx="7.5" cy="17.5" r="1.5" fill={color} />
          <circle cx="16.5" cy="17.5" r="1.5" fill={color} />
        </svg>
      );
    case "motorcycle":
      return (
        <svg {...shared}>
          <circle cx="5" cy="16" r="3" />
          <circle cx="19" cy="16" r="3" />
          <path d="M5 16h4l3-8h2l3 4h3M9 16l3-8" />
        </svg>
      );
    case "foot":
      return (
        <svg {...shared}>
          <circle cx="12" cy="5" r="2" fill={color} />
          <path d="M9 20l1-5 2 2 2-5M9 12l3 3 3-5" />
          <path d="M7 20h3M13 20h4" />
        </svg>
      );
    default:
      return (
        <svg {...shared}>
          <circle cx="12" cy="8" r="3" />
          <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        </svg>
      );
  }
}

// ─────────────────────────────────────────────
// Agent marker
// ─────────────────────────────────────────────

function AgentMarker({
  agent, isEmergency, isSelected, now, onSelect,
}: {
  agent: Agent; isEmergency: boolean; isSelected: boolean;
  now: number; onSelect: (a: Agent) => void;
}) {
  const pos     = useAnimatedPosition(agent.current_lat, agent.current_lng);
  if (!pos) return null;

  const speed    = agent.speed_kmh ?? 0;
  const heading  = agent.heading ?? 0;
  const isMoving = speed > 1;
  const sinceActive = agent.last_active
    ? now - new Date(agent.last_active).getTime() : Infinity;
  const isStale     = sinceActive > STALE_MS;
  const isVeryStale = sinceActive > VERY_STALE_MS;

  return (
    <AdvancedMarker
      position={pos}
      onClick={() => onSelect(agent)}
      zIndex={isEmergency ? 1000 : isSelected ? 500 : isMoving ? 100 : 10}
    >
      <div className="relative cursor-pointer select-none" title={agent.full_name}>
        {isEmergency && (
          <span className="absolute inset-[-4px] rounded-full bg-red-500/60 animate-ping" />
        )}
        <div className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] bg-card shadow-lg transition-all duration-300",
          speedRingClass(isStale ? 0 : speed),
          isSelected && "ring-2 ring-white ring-offset-1",
          isEmergency && "bg-red-50",
        )}>
          <div
            className="flex items-center justify-center transition-transform duration-1000"
            style={{ transform: isMoving ? `rotate(${heading}deg)` : "none" }}
          >
            <VehicleIcon
              type={agent.vehicle_type} size={20}
              color={isEmergency ? "#ef4444" : isVeryStale ? "#94a3b8" : "#1e293b"}
            />
          </div>
        </div>
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
          isStale || agent.status === "offline" ? "bg-slate-400"
            : agent.status === "emergency" ? "bg-red-500"
            : isMoving ? "bg-amber-500"
            : "bg-emerald-500",
        )} />
        {isStale && !isVeryStale && (
          <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 border-2 border-white" />
        )}
      </div>
    </AdvancedMarker>
  );
}

// ─────────────────────────────────────────────
// GPS Device marker
// ─────────────────────────────────────────────

function GpsDeviceMarker({
  device, isSelected, now, onSelect,
}: {
  device: GpsDeviceForMap; isSelected: boolean;
  now: number; onSelect: (d: GpsDeviceForMap) => void;
}) {
  if (!device.last_lat || !device.last_lng) return null;

  const battery = device.last_battery_pct;
  const sinceLastSeen = device.last_seen_at
    ? now - new Date(device.last_seen_at).getTime() : Infinity;
  const isStale = sinceLastSeen > STALE_MS;

  const battDot =
    battery === null ? "bg-slate-400"
      : battery > 50  ? "bg-emerald-500"
      : battery > 20  ? "bg-amber-500"
      : "bg-red-500";

  return (
    <AdvancedMarker
      position={{ lat: device.last_lat, lng: device.last_lng }}
      onClick={() => onSelect(device)}
      zIndex={isSelected ? 500 : 50}
    >
      <div
        className="relative cursor-pointer select-none"
        title={device.cred_name ?? device.notes ?? `GPS903-${device.gps903_device_id ?? "?"}`}
      >
        {/* Diamond (rotated square) body */}
        <div className={cn(
          "flex h-9 w-9 rotate-45 items-center justify-center rounded-lg border-2 shadow-lg transition-all",
          isStale
            ? "border-slate-400 bg-slate-500/80"
            : "border-amber-500 bg-amber-500/90",
          isSelected && "ring-2 ring-white ring-offset-1",
        )}>
          <Satellite className="-rotate-45 h-4 w-4 text-white" />
        </div>
        {/* Battery dot */}
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
          battDot,
        )} />
      </div>
    </AdvancedMarker>
  );
}

// ─────────────────────────────────────────────
// Trail layer
// ─────────────────────────────────────────────

function TrailLayer({
  agentId, durationMinutes,
}: {
  agentId: string; durationMinutes: 15 | 30 | 60;
}) {
  const supabase = createClient();
  const [path, setPath] = useState<Array<{ lat: number; lng: number }>>([]);

  useEffect(() => {
    const since = new Date(Date.now() - durationMinutes * 60_000).toISOString();
    supabase
      .from("agent_location_history")
      .select("lat,lng,recorded_at")
      .eq("agent_id", agentId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .then(({ data }) => {
        if (data) setPath(data.map((d) => ({ lat: d.lat, lng: d.lng })));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, durationMinutes]);

  if (path.length < 2) return null;

  const n  = path.length;
  const t1 = Math.max(1, Math.floor(n / 3));
  const t2 = Math.max(2, Math.floor((2 * n) / 3));

  return (
    <>
      {t1 >= 2 && <Polyline path={path.slice(0, t1)} strokeColor="#3B82F6" strokeOpacity={0.2} strokeWeight={3} />}
      {t2 - t1 >= 2 && <Polyline path={path.slice(t1 - 1, t2)} strokeColor="#3B82F6" strokeOpacity={0.5} strokeWeight={3} />}
      {n - t2 >= 2 && <Polyline path={path.slice(t2 - 1)} strokeColor="#3B82F6" strokeOpacity={0.9} strokeWeight={4} />}
      <AdvancedMarker position={path[0]} zIndex={1}>
        <div className="h-2 w-2 rounded-full bg-blue-400/60 border border-blue-600" />
      </AdvancedMarker>
    </>
  );
}

// ─────────────────────────────────────────────
// Geofence layer
// ─────────────────────────────────────────────

function GeofenceLayer({
  geofences, drawPoints, selectedFence, onFenceClick,
}: {
  geofences: Geofence[];
  drawPoints: Array<{ lat: number; lng: number }>;
  selectedFence: Geofence | null;
  onFenceClick: (f: Geofence) => void;
}) {
  return (
    <>
      {geofences.map((fence) => (
        <Polygon
          key={fence.id}
          paths={[fence.coordinates]}
          strokeColor={fence.color}
          strokeOpacity={0.85}
          strokeWeight={selectedFence?.id === fence.id ? 3 : 2}
          fillColor={fence.color}
          fillOpacity={selectedFence?.id === fence.id ? 0.2 : 0.1}
          onClick={() => onFenceClick(fence)}
        />
      ))}
      {drawPoints.length >= 2 && (
        <>
          <Polyline
            path={drawPoints.length >= 3 ? [...drawPoints, drawPoints[0]] : drawPoints}
            strokeColor="#f59e0b" strokeOpacity={0.8} strokeWeight={2}
          />
          {drawPoints.map((pt, i) => (
            <AdvancedMarker key={i} position={pt} zIndex={200}>
              <div className={cn("h-3 w-3 rounded-full border-2 border-white shadow",
                i === 0 ? "bg-amber-600" : "bg-amber-400")} />
            </AdvancedMarker>
          ))}
        </>
      )}
      {drawPoints.length === 1 && (
        <AdvancedMarker position={drawPoints[0]} zIndex={200}>
          <div className="h-3 w-3 rounded-full bg-amber-500 border-2 border-white shadow" />
        </AdvancedMarker>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Ops panel
// ─────────────────────────────────────────────

function OpsPanel({
  agents, gpsDevices, open, onToggle, now,
}: {
  agents: Agent[]; gpsDevices: GpsDeviceForMap[];
  open: boolean; onToggle: () => void; now: number;
}) {
  const t      = useTranslations("map");
  const active = agents.filter((a) => mapDisplayStatus(a, now) !== "offline").length;
  const moving = agents.filter((a) => a.status === "moving" || (a.speed_kmh ?? 0) > 1).length;
  const offline = agents.filter((a) => mapDisplayStatus(a, now) === "offline").length;
  const liveGps = gpsDevices.filter((d) =>
    d.last_seen_at && now - new Date(d.last_seen_at).getTime() < STALE_MS,
  ).length;

  return (
    <div className="absolute left-3 top-3 z-10">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
            className="mb-1 w-48 overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-xl backdrop-blur"
          >
            <div className="border-b border-border/40 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <LayoutDashboard className="h-3 w-3" />
                {t("ops.title")}
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border/40">
              <StatTile label={t("ops.active")}   value={active}   dot="bg-emerald-500" />
              <StatTile label={t("ops.moving")}   value={moving}   dot="bg-amber-500" />
              <StatTile label={t("ops.offline")}  value={offline}  dot="bg-slate-400" />
              <StatTile label="GPS Live"           value={liveGps}  dot="bg-amber-400" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Button
        variant="outline" size="sm" onClick={onToggle}
        className="h-7 gap-1 bg-card/95 px-2 text-xs backdrop-blur shadow-md"
      >
        <LayoutDashboard className="h-3 w-3" />
        {open ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function StatTile({ label, value, unit, dot }: {
  label: string; value: number | string; unit?: string; dot: string;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-1">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className="mt-0.5 font-mono text-lg font-bold leading-none">
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Emergency banner
// ─────────────────────────────────────────────

function EmergencyBanner({
  alerts, agents, onZoom,
}: {
  alerts: EmergencyAlert[]; agents: Agent[];
  onZoom: (lat: number, lng: number) => void;
}) {
  const t = useTranslations("map");
  if (alerts.length === 0) return null;

  const latest    = alerts[0];
  const agentName = latest.agent_id
    ? agents.find((a) => a.id === latest.agent_id)?.full_name ?? "Agent"
    : "Unknown";

  return (
    <div className="absolute inset-x-0 top-0 z-20 mx-3 mt-3">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 shadow-lg backdrop-blur"
      >
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
        </span>
        <p className="flex-1 text-sm font-semibold text-red-600 dark:text-red-400">
          {t("emergency.banner", { agent: agentName, count: alerts.length })}
        </p>
        {latest.lat && latest.lng && (
          <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs"
            onClick={() => onZoom(latest.lat!, latest.lng!)}>
            <Crosshair className="h-3 w-3" />
            {t("emergency.zoom")}
          </Button>
        )}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Agent popup — Name · Role · Phone · Status only
// ─────────────────────────────────────────────

function AgentPopup({
  agent, now, onClose, trailMinutes, onTrailMinutesChange,
}: {
  agent: Agent; now: number; onClose: () => void;
  trailMinutes: 15 | 30 | 60; onTrailMinutesChange: (m: 15 | 30 | 60) => void;
}) {
  const t        = useTranslations("map");
  const roleMeta = agent.agent_role ? AGENT_ROLE_META[agent.agent_role] : null;
  const sinceActive = agent.last_active
    ? now - new Date(agent.last_active).getTime() : Infinity;
  const isStale  = sinceActive > STALE_MS;

  if (!agent.current_lat || !agent.current_lng) return null;

  return (
    <AdvancedMarker position={{ lat: agent.current_lat, lng: agent.current_lng }} zIndex={2000}>
      <div className="pointer-events-none flex flex-col items-center select-none">
        <div className="pointer-events-auto min-w-[220px] max-w-[260px] overflow-hidden rounded-xl border border-border/60 bg-white/95 shadow-xl backdrop-blur-sm dark:bg-slate-900/95">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
            <Avatar className="h-9 w-9 shrink-0">
              {agent.photo_url && <AvatarImage src={agent.photo_url} alt={agent.full_name} className="object-cover" />}
              <AvatarFallback className="text-xs">{initials(agent.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{agent.full_name}</p>
              <p className="font-mono text-xs text-muted-foreground">{agent.agent_code}</p>
            </div>
            <button
              onClick={onClose} aria-label="Close"
              className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status + Role badges */}
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
            <AgentStatusBadge status={agent.status} />
            {roleMeta && (
              <Badge className={cn("border border-transparent text-[9px] font-bold uppercase tracking-widest", roleMeta.badge)}>
                {roleMeta.label}
              </Badge>
            )}
          </div>

          {/* Info rows */}
          <div className="space-y-1.5 px-3 pb-2 text-xs text-muted-foreground">
            {/* Last active */}
            <div className={cn("flex items-center gap-1.5", isStale && "text-amber-600")}>
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{timeAgo(agent.last_active)}</span>
              {isStale && <span className="font-medium">(stale)</span>}
            </div>

            {/* Phone */}
            {agent.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">{agent.phone}</span>
              </div>
            )}
          </div>

          {/* Trail duration */}
          <div className="flex items-center gap-2 border-t border-border/40 px-3 py-2">
            <Clock className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            <span className="text-xs text-muted-foreground">Trail</span>
            <div className="ml-auto flex gap-1">
              {([15, 30, 60] as const).map((m) => (
                <button
                  key={m} onClick={() => onTrailMinutesChange(m)}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors",
                    trailMinutes === m
                      ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* Call button */}
          <div className="border-t border-border/40 px-3 pb-3 pt-2.5">
            <button
              onClick={() => {
                if (!agent.phone) { toast(t("popup.noPhone")); return; }
                window.location.href = `tel:${agent.phone}`;
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 active:bg-emerald-700"
            >
              <Phone className="h-4 w-4" />
              {t("popup.call")}
            </button>
          </div>
        </div>
        <div className="h-3 w-px bg-border/60" />
        <div className="h-14" />
      </div>
    </AdvancedMarker>
  );
}

// ─────────────────────────────────────────────
// Locate mode badge
// ─────────────────────────────────────────────

function LocateModeBadge({
  mode, isStale,
}: {
  mode: "gps" | "lbs" | "offline" | "unknown" | null;
  isStale: boolean;
}) {
  const effective = isStale ? "offline" : (mode ?? "unknown");
  const cfg = {
    gps:     { label: "GPS",     cls: "bg-emerald-500/10 text-emerald-400" },
    lbs:     { label: "LBS",     cls: "bg-amber-500/10 text-amber-400" },
    offline: { label: "OFFLINE", cls: "bg-red-500/10 text-red-400" },
    unknown: { label: "UNKNOWN", cls: "bg-slate-500/10 text-slate-400" },
  } as const;
  const { label, cls } = cfg[effective] ?? cfg.unknown;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider", cls)}>
      <span className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        effective === "gps"     ? "bg-emerald-400"
        : effective === "lbs"   ? "bg-amber-400"
        : effective === "offline" ? "bg-red-400"
        : "bg-slate-400",
      )} />
      {label}
    </span>
  );
}

/** Format a UTC timestamp for display in Asia/Bangkok (GMT+7). */
function formatBangkokTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      day:      "2-digit",
      month:    "short",
      year:     "numeric",
      hour:     "2-digit",
      minute:   "2-digit",
      second:   "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}:${get("second")} GMT+7`;
  } catch { return "—"; }
}

function formatStopMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes < 0) return "—";
  if (minutes === 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─────────────────────────────────────────────
// GPS Device popup — Device info · no agent data
// ─────────────────────────────────────────────

function GpsDevicePopup({
  device, now, onClose,
}: {
  device: GpsDeviceForMap; now: number; onClose: () => void;
}) {
  if (!device.last_lat || !device.last_lng) return null;

  const speed   = device.last_speed_kmh ?? 0;
  const battery = device.last_battery_pct;
  const sinceLastSeen = device.last_seen_at
    ? now - new Date(device.last_seen_at).getTime() : Infinity;
  const isStale = sinceLastSeen > STALE_MS;

  const battClass =
    battery === null ? "text-muted-foreground"
      : battery > 50  ? "text-emerald-600"
      : battery > 20  ? "text-amber-500"
      : "text-red-500";

  return (
    <AdvancedMarker position={{ lat: device.last_lat, lng: device.last_lng }} zIndex={2000}>
      <div className="pointer-events-none flex flex-col items-center select-none">
        <div className="pointer-events-auto min-w-[220px] max-w-[260px] overflow-hidden rounded-xl border border-border/60 bg-white/95 shadow-xl backdrop-blur-sm dark:bg-slate-900/95">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <Satellite className="h-4 w-4 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {device.cred_name ?? device.notes ?? `GPS903-${device.gps903_device_id ?? "?"}`}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {device.cred_imei ?? device.imei ?? "—"}
              </p>
              {device.cred_phone && (
                <p className="font-mono text-[10px] text-muted-foreground/70">{device.cred_phone}</p>
              )}
              {(device.cred_provider ?? device.provider) && (
                <p className="font-mono text-[10px] text-muted-foreground/70">{device.cred_provider ?? device.provider}</p>
              )}
              {/* Locate mode badge — below IMEI */}
              <div className="mt-1">
                <LocateModeBadge mode={device.last_locate_mode ?? null} isStale={isStale} />
              </div>
            </div>
            <button
              onClick={onClose} aria-label="Close"
              className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Telemetry rows */}
          <div className="px-3 pb-3 text-xs text-muted-foreground">
            {/* Battery */}
            <div className={cn("flex items-center gap-1.5", battClass)}>
              <BatteryMedium className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono">{battery !== null ? `${battery}%` : "—"}</span>
            </div>

            <div className="my-1.5 border-t border-border/30" />

            {/* Speed */}
            <div className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 shrink-0" style={{ color: speedColor(speed) }} />
              <span className="font-mono" style={{ color: speedColor(speed) }}>
                {speed.toFixed(1)} km/h
              </span>
            </div>

            {/* Position time — Bangkok (GMT+7) */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-sky-500" />
              <span className="font-mono">{formatBangkokTime(device.last_position_time)}</span>
            </div>

            {/* Stop time */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="font-mono">{formatStopMinutes(device.last_stop_minutes)}</span>
            </div>

            {/* Last seen — Bangkok (GMT+7); amber when stale */}
            <div className={cn("mt-1.5 flex items-center gap-1.5", isStale && "text-amber-600")}>
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono">{formatBangkokTime(device.last_seen_at)}</span>
              {isStale && <span className="font-medium">(stale)</span>}
            </div>

            <div className="my-1.5 border-t border-border/30" />

            {/* ACC Status (ignition) */}
            <div className="flex items-center gap-1.5">
              <Zap className={cn(
                "h-3.5 w-3.5 shrink-0",
                device.last_ignition === true ? "text-emerald-500" : "text-muted-foreground/50",
              )} />
              <span className={cn(
                "font-mono font-medium",
                device.last_ignition === true  ? "text-emerald-600 dark:text-emerald-400"
                : device.last_ignition === false ? "text-muted-foreground"
                : "text-muted-foreground/50",
              )}>
                {device.last_ignition === null ? "—" : device.last_ignition ? "ACC ON" : "ACC OFF"}
              </span>
            </div>

            {/* Case */}
            {device.case_number && (
              <>
                <div className="my-1.5 border-t border-border/30" />
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono font-medium">{device.case_number}</span>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Connector — aligned above the diamond marker (h-9 rotated = ~12.7px diagonal) */}
        <div className="h-3 w-px bg-border/60" />
        <div className="h-12" />
      </div>
    </AdvancedMarker>
  );
}

function headingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// ─────────────────────────────────────────────
// Geofence info sidebar
// ─────────────────────────────────────────────

function GeofenceSidebar({
  fence, isAdmin, onClose, onDelete,
}: {
  fence: Geofence; isAdmin: boolean;
  onClose: () => void; onDelete: (id: string) => void;
}) {
  const t = useTranslations("map");
  const [pending, startTransition] = useTransition();

  return (
    <div className="absolute right-3 top-3 z-10 w-52 rounded-xl border border-border/60 bg-card/95 p-3 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: fence.color }} />
          <p className="truncate text-sm font-semibold">{fence.name}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      {fence.description && <p className="mt-1 text-xs text-muted-foreground">{fence.description}</p>}
      <p className="mt-1.5 text-xs text-muted-foreground">{fence.coordinates.length} {t("fence.points")}</p>
      {isAdmin && (
        <Button
          variant="ghost" size="sm" disabled={pending}
          className="mt-2 h-7 gap-1 text-xs text-destructive hover:text-destructive w-full justify-start"
          onClick={() => startTransition(async () => { await onDelete(fence.id); })}
        >
          <Trash2 className="h-3 w-3" />
          {t("fence.delete")}
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// No-API-key fallback row
// ─────────────────────────────────────────────

function AgentRow({ agent }: { agent: Agent }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3 text-left">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {agent.photo_url && <img src={agent.photo_url} alt="" className="h-full w-full rounded-full object-cover" />}
          <AvatarFallback className="text-xs">{initials(agent.full_name)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{agent.full_name}</p>
          <p className="font-mono text-xs text-muted-foreground">{agent.agent_code} · {agent.area}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {agent.agent_role && <AgentRoleBadge role={agent.agent_role} />}
        <AgentStatusBadge status={agent.status} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main LiveMap
// ─────────────────────────────────────────────

interface LiveMapProps {
  initialAgents:        Agent[];
  initialGeofences:     Geofence[];
  emergencyAlerts:      EmergencyAlert[];
  initialGeofenceEvents: GeofenceEventFeed[];
  initialGpsDevices:    GpsDeviceForMap[];
  isAdmin:              boolean;
}

export function LiveMap({
  initialAgents,
  initialGeofences,
  emergencyAlerts: initialAlerts,
  initialGeofenceEvents,
  initialGpsDevices,
  isAdmin,
}: LiveMapProps) {
  const t       = useTranslations("map");
  const tStatus = useTranslations("status.agent");
  const apiKey  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const supabase = createClient();

  // ── Agent state ──
  const [agents, setAgents]               = useState<Agent[]>(initialAgents);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // ── GPS device state ──
  const [gpsDevices, setGpsDevices]               = useState<GpsDeviceForMap[]>(initialGpsDevices);
  const [selectedGpsDevice, setSelectedGpsDevice] = useState<GpsDeviceForMap | null>(null);

  // ── Layer toggles ──
  const [showAgentLayer, setShowAgentLayer]   = useState(true);
  const [showGpsLayer,   setShowGpsLayer]     = useState(true);

  // ── Misc UI state ──
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [now, setNow]           = useState(0);

  // ── Geofences ──
  const [geofences, setGeofences]       = useState<Geofence[]>(initialGeofences);
  const [selectedFence, setSelectedFence] = useState<Geofence | null>(null);

  // ── Emergency ──
  const [emergencyAlerts] = useState<EmergencyAlert[]>(initialAlerts);
  const emergencyMode = emergencyAlerts.some((a) => a.status === "active");

  // ── Geofence events ──
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEventFeed[]>(initialGeofenceEvents);
  const [showEventLog, setShowEventLog]     = useState(false);
  const emergencyAgentIds = new Set(
    emergencyAlerts.filter((a) => a.status === "active").map((a) => a.agent_id).filter(Boolean),
  );

  // ── Trails ──
  const [showTrails, setShowTrails]     = useState(false);
  const [trailMinutes, setTrailMinutes] = useState<15 | 30 | 60>(15);

  // ── Geofence drawing ──
  const [drawMode, setDrawMode]         = useState(false);
  const [drawPoints, setDrawPoints]     = useState<Array<{ lat: number; lng: number }>>([]);
  const [fenceName, setFenceName]       = useState("");
  const [fenceDesc, setFenceDesc]       = useState("");
  const [fenceColor, setFenceColor]     = useState(FENCE_COLORS[0]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePending, startSaveTransition] = useTransition();

  // ── Filter state ──
  const [opsPanelOpen, setOpsPanelOpen] = useState(true);
  const [filtersOpen, setFiltersOpen]   = useState(false);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter]     = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [roleFilter, setRoleFilter]     = useState("all");

  // ── Emergency zoom ──
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom]     = useState<number | null>(null);

  // ── Clock ──
  useEffect(() => {
    setNow(Date.now());
    setLastSync(new Date());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Agent polling ──
  async function refresh() {
    const { data } = await supabase
      .from("agents")
      .select("*")
      .neq("status", "offline")
      .not("current_lat", "is", null);
    if (data) setAgents(data as Agent[]);
    setLastSync(new Date());
  }

  // ── GPS device polling ──
  async function refreshGps() {
    const { data } = await supabase
      .from("gps_devices")
      .select("*, cases(case_number), gps903_credentials(device_name, imei, phone_number, provider)")
      .not("last_lat", "is", null)
      .is("deleted_at", null);
    if (data) {
      type RawGpsRow = GpsDeviceForMap & {
        cases: { case_number: string } | null;
        gps903_credentials: { device_name: string | null; imei: string | null; phone_number: string | null; provider: string | null } | null;
      };
      setGpsDevices(
        (data as unknown as RawGpsRow[]).map((row) => ({
          ...row,
          case_number:   row.cases?.case_number ?? null,
          cred_name:     row.gps903_credentials?.device_name ?? null,
          cred_imei:     row.gps903_credentials?.imei ?? null,
          cred_phone:    row.gps903_credentials?.phone_number ?? null,
          cred_provider: row.gps903_credentials?.provider ?? null,
        })),
      );
    }
  }

  useEffect(() => {
    const id = setInterval(() => { void refresh(); void refreshGps(); }, GPS_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Agent realtime ──
  useEffect(() => {
    const channel = supabase
      .channel("live-agents-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setAgents((prev) => prev.filter((a) => a.id !== (payload.old as Agent).id));
          return;
        }
        const updated = payload.new as Agent;
        const visible = updated.status !== "offline" && updated.current_lat !== null;
        setAgents((prev) => {
          const exists = prev.some((a) => a.id === updated.id);
          if (!exists && visible) return [...prev, updated];
          if (exists && !visible) return prev.filter((a) => a.id !== updated.id);
          if (exists && visible) return prev.map((a) => (a.id === updated.id ? updated : a));
          return prev;
        });
        setSelectedAgent((prev) => prev?.id === updated.id ? updated : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GPS device realtime ──
  useEffect(() => {
    const channel = supabase
      .channel("live-gps-devices")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "gps_devices" }, (payload) => {
        const updated = payload.new as GpsDeviceForMap;
        if (!updated.last_lat) return;
        setGpsDevices((prev) => {
          const exists = prev.some((d) => d.id === updated.id);
          if (exists) return prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d));
          return [...prev, updated];
        });
        setSelectedGpsDevice((prev) => prev?.id === updated.id ? { ...prev, ...updated } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Geofence events realtime ──
  useEffect(() => {
    const channel = supabase
      .channel("geofence-events-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "geofence_events" }, (payload) => {
        const raw = payload.new as {
          id: string; agent_id: string; geofence_id: string;
          event_type: "enter" | "exit"; occurred_at: string;
        };
        setAgents((currentAgents) => {
          setGeofences((currentFences) => {
            const agentName = currentAgents.find((a) => a.id === raw.agent_id)?.full_name ?? "Agent";
            const fenceName = currentFences.find((f) => f.id === raw.geofence_id)?.name ?? "zone";
            const event: GeofenceEventFeed = {
              id: raw.id, agent_id: raw.agent_id, geofence_id: raw.geofence_id,
              event_type: raw.event_type, occurred_at: raw.occurred_at,
              agentName, fenceName,
            };
            setGeofenceEvents((prev) => [event, ...prev].slice(0, 50));
            toast(
              raw.event_type === "enter"
                ? t("fence.events.entered", { agent: agentName, fence: fenceName })
                : t("fence.events.exited", { agent: agentName, fence: fenceName }),
              { icon: raw.event_type === "enter" ? "🟢" : "🔴" },
            );
            return currentFences;
          });
          return currentAgents;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filters ──
  const areas = useMemo(
    () => Array.from(new Set(agents.map((a) => a.area).filter(Boolean))) as string[],
    [agents],
  );

  const VEHICLE_TYPES: Array<AgentVehicleType> = ["car", "motorcycle", "foot"];

  const filtered = agents.filter((a) => {
    if (areaFilter !== "all" && a.area !== areaFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (vehicleFilter !== "all" && a.vehicle_type !== vehicleFilter) return false;
    if (roleFilter !== "all" && a.agent_role !== roleFilter) return false;
    if (search && !`${a.full_name} ${a.nickname ?? ""} ${a.agent_code}`.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const defaultCenter = useMemo(() => {
    const withCoords = filtered.filter((a) => a.current_lat && a.current_lng);
    if (withCoords.length === 0) return DEFAULT_MAP_CENTER;
    return {
      lat: withCoords.reduce((s, a) => s + (a.current_lat ?? 0), 0) / withCoords.length,
      lng: withCoords.reduce((s, a) => s + (a.current_lng ?? 0), 0) / withCoords.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (!drawMode || !e.detail.latLng) return;
    const { lat, lng } = e.detail.latLng;
    setDrawPoints((prev) => [...prev, { lat, lng }]);
  }, [drawMode]);

  const handleEmergencyZoom = useCallback((lat: number, lng: number) => {
    setMapCenter({ lat, lng }); setMapZoom(16);
  }, []);

  async function handleSaveFence() {
    if (drawPoints.length < 3 || !fenceName.trim()) return;
    startSaveTransition(async () => {
      const result = await createGeofence({
        name: fenceName.trim(), description: fenceDesc.trim() || null,
        color: fenceColor, coordinates: drawPoints,
      });
      if (result.error) { toast.error(result.error); return; }
      if (result.fence) setGeofences((prev) => [...prev, result.fence!]);
      setDrawPoints([]); setFenceName(""); setFenceDesc(""); setDrawMode(false); setShowSaveDialog(false);
      toast.success(t("fence.saved"));
    });
  }

  async function handleDeleteFence(id: string) {
    const result = await deleteGeofence(id);
    if (result.error) { toast.error(result.error); return; }
    setGeofences((prev) => prev.filter((f) => f.id !== id));
    setSelectedFence(null);
    toast.success(t("fence.deleted"));
  }

  // ── Control bar ──
  const controlBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={t("searchPlaceholder")} value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 w-36 text-xs"
      />

      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-2 overflow-hidden"
          >
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("areaAll")}</SelectItem>
                {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("statusAll")}</SelectItem>
                {AGENT_STATUSES.map((k) => <SelectItem key={k} value={k}>{tStatus(k)}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("vehicleAll")}</SelectItem>
                {VEHICLE_TYPES.map((v) => <SelectItem key={v} value={v} className="capitalize">{v.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("roleAll")}</SelectItem>
                {(["field_agent", "supervisor", "team_leader", "operations"] as AgentRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{AGENT_ROLE_META[r].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
        )}
      </AnimatePresence>

      <Button variant="ghost" size="sm" onClick={() => setFiltersOpen((f) => !f)}
        className={cn("h-8 gap-1.5 text-xs", filtersOpen && "bg-accent")}>
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {t("filters")}
      </Button>

      {/* Layer toggles */}
      <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/80 px-1 py-0.5">
        <button
          onClick={() => { setShowAgentLayer((v) => !v); if (showAgentLayer) setSelectedAgent(null); }}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
            showAgentLayer ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
          )}
          title="Toggle agent layer"
        >
          <Users className="h-3 w-3" />
          Agents{" "}
          <span className="font-mono tabular-nums">{filtered.length}</span>
        </button>
        <button
          onClick={() => { setShowGpsLayer((v) => !v); if (showGpsLayer) setSelectedGpsDevice(null); }}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
            showGpsLayer ? "bg-amber-500/10 text-amber-600" : "text-muted-foreground hover:bg-accent",
          )}
          title="Toggle GPS device layer"
        >
          <Satellite className="h-3 w-3" />
          GPS{" "}
          <span className="font-mono tabular-nums">{gpsDevices.length}</span>
        </button>
      </div>

      {/* Trail controls */}
      <div className="flex items-center gap-1">
        <Button variant={showTrails ? "secondary" : "outline"} size="sm" className="h-8 gap-1.5 text-xs"
          onClick={() => setShowTrails((v) => !v)}>
          <Clock className="h-3.5 w-3.5" />
          {t("trail.toggle")}
        </Button>
        {showTrails && (
          <Select value={String(trailMinutes)} onValueChange={(v) => setTrailMinutes(Number(v) as 15 | 30 | 60)}>
            <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="60">60 min</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Geofence draw */}
      {isAdmin && (
        <Button
          variant={drawMode ? "secondary" : "outline"} size="sm"
          className={cn("h-8 gap-1.5 text-xs", drawMode && "ring-2 ring-amber-400")}
          onClick={() => {
            if (drawMode) {
              if (drawPoints.length >= 3) setShowSaveDialog(true);
              else { setDrawMode(false); setDrawPoints([]); }
            } else {
              setDrawMode(true); setSelectedAgent(null); setSelectedFence(null); setSelectedGpsDevice(null);
            }
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
          {drawMode ? (drawPoints.length >= 3 ? t("fence.finish") : t("fence.drawing")) : t("fence.draw")}
        </Button>
      )}

      {drawMode && drawPoints.length > 0 && (
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
          onClick={() => { setDrawMode(false); setDrawPoints([]); }}>
          <X className="h-3.5 w-3.5" />
          {t("fence.cancel")}
        </Button>
      )}

      <Button variant="outline" size="sm"
        onClick={() => { void refresh(); void refreshGps(); }}
        className="h-8 gap-1.5 text-xs">
        <RefreshCw className="h-3.5 w-3.5" />
        {t("sync")}
      </Button>

      {/* Live indicator */}
      <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="relative flex h-1.5 w-1.5">
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
            emergencyMode ? "bg-red-500" : "bg-success")} />
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full",
            emergencyMode ? "bg-red-500" : "bg-success")} />
        </span>
        <span className="font-mono">{filtered.length}</span>
        <span>
          {lastSync
            ? t("agentCount", { count: filtered.length, time: timeAgo(lastSync) })
                .replace(/^\d+/, "").trim()
            : null}
        </span>
      </div>
    </div>
  );

  // ── No API key fallback ──
  if (!apiKey) {
    return (
      <div className="space-y-4">
        {controlBar}
        <div className="flex h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 text-center">
          <MapPinOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">{t("noApiKeyTitle")}</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">{t("noApiKeyDescription")}</p>
          <div className="mt-6 grid w-full max-w-2xl gap-2 px-4">
            {filtered.map((a) => <AgentRow key={a.id} agent={a} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {controlBar}

      <div className={cn(
        "relative h-[70vh] min-h-[440px] overflow-hidden rounded-xl border border-border/60",
        drawMode && "[&_.gm-style]:cursor-crosshair",
      )}>
        <APIProvider apiKey={apiKey}>
          {emergencyMode && (
            <EmergencyBanner
              alerts={emergencyAlerts.filter((a) => a.status === "active")}
              agents={agents}
              onZoom={handleEmergencyZoom}
            />
          )}

          <OpsPanel
            agents={agents} gpsDevices={gpsDevices}
            open={opsPanelOpen} onToggle={() => setOpsPanelOpen((v) => !v)}
            now={now}
          />

          {selectedFence && !drawMode && (
            <GeofenceSidebar
              fence={selectedFence} isAdmin={isAdmin}
              onClose={() => setSelectedFence(null)}
              onDelete={handleDeleteFence}
            />
          )}

          {drawMode && (
            <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center">
              <div className="rounded-full border border-amber-400/50 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-700 backdrop-blur dark:text-amber-400">
                {drawPoints.length === 0 ? t("fence.clickToStart") : t("fence.clickToAdd", { count: drawPoints.length })}
              </div>
            </div>
          )}

          <Map
            mapId={MAP_ID}
            defaultCenter={mapCenter ?? defaultCenter}
            defaultZoom={mapZoom ?? 12}
            center={mapCenter ?? undefined}
            zoom={mapZoom ?? undefined}
            onCameraChanged={() => { setMapCenter(null); setMapZoom(null); }}
            gestureHandling="greedy"
            disableDefaultUI={false}
            className="h-full w-full"
            onClick={drawMode ? handleMapClick : undefined}
          >
            {/* ── Layer A: Agents ── */}
            {showAgentLayer && filtered
              .filter((a) => a.current_lat && a.current_lng)
              .map((a) => (
                <AgentMarker
                  key={a.id} agent={a}
                  isEmergency={emergencyAgentIds.has(a.id)}
                  isSelected={selectedAgent?.id === a.id}
                  now={now}
                  onSelect={(agent) => { setSelectedAgent(agent); setSelectedGpsDevice(null); }}
                />
              ))}

            {/* Agent trails */}
            {showAgentLayer && selectedAgent?.id && (
              <TrailLayer agentId={selectedAgent.id} durationMinutes={trailMinutes} />
            )}
            {showAgentLayer && showTrails && !selectedAgent && filtered.map((a) => (
              <TrailLayer key={a.id} agentId={a.id} durationMinutes={trailMinutes} />
            ))}

            {/* ── Layer B: GPS Devices ── */}
            {showGpsLayer && gpsDevices
              .filter((d) => d.last_lat && d.last_lng)
              .map((d) => (
                <GpsDeviceMarker
                  key={d.id} device={d}
                  isSelected={selectedGpsDevice?.id === d.id}
                  now={now}
                  onSelect={(device) => { setSelectedGpsDevice(device); setSelectedAgent(null); }}
                />
              ))}

            {/* Geofences */}
            <GeofenceLayer
              geofences={geofences} drawPoints={drawPoints}
              selectedFence={selectedFence}
              onFenceClick={(f) => { if (!drawMode) setSelectedFence((prev) => prev?.id === f.id ? null : f); }}
            />

            {/* Agent popup */}
            {showAgentLayer && selectedAgent && (
              <AgentPopup
                agent={selectedAgent} now={now}
                onClose={() => setSelectedAgent(null)}
                trailMinutes={trailMinutes}
                onTrailMinutesChange={setTrailMinutes}
              />
            )}

            {/* GPS Device popup */}
            {showGpsLayer && selectedGpsDevice && (
              <GpsDevicePopup
                device={selectedGpsDevice} now={now}
                onClose={() => setSelectedGpsDevice(null)}
              />
            )}
          </Map>
        </APIProvider>
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium">Layer A — Agents:</span>
        {([
          { label: t("speed.stopped"), color: "#64748b" },
          { label: t("speed.slow"),    color: "#22c55e" },
          { label: t("speed.moving"),  color: "#f59e0b" },
          { label: t("speed.fast"),    color: "#ef4444" },
        ] as const).map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="ml-4 font-medium">Layer B — GPS Devices:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rotate-45 rounded-sm bg-amber-500" />
          Active
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rotate-45 rounded-sm bg-slate-500" />
          Stale (&gt;10 min)
        </span>
        <span className="ml-auto text-muted-foreground/60">{t("trailNote")}</span>
      </div>

      {/* Geofence events log */}
      <div className="rounded-xl border border-border/60 bg-card">
        <button
          onClick={() => setShowEventLog((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent/40"
        >
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{t("fence.events.title")}</span>
          {geofenceEvents.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
              {geofenceEvents.length}
            </span>
          )}
          <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform", showEventLog && "rotate-180")} />
        </button>
        {showEventLog && (
          <div className="border-t border-border/60 divide-y divide-border/40">
            {geofenceEvents.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">{t("fence.events.none")}</p>
            ) : (
              geofenceEvents.slice(0, 15).map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 px-4 py-2">
                  {ev.event_type === "enter"
                    ? <LogIn  className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    : <LogOut className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                  <div className="min-w-0 flex-1 text-xs">
                    <span className="font-medium">{ev.agentName}</span>
                    <span className="mx-1 text-muted-foreground/60">·</span>
                    <span className="text-muted-foreground">{ev.fenceName}</span>
                  </div>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/60">
                    {timeAgo(ev.occurred_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Geofence save dialog */}
      <Dialog open={showSaveDialog} onOpenChange={(v) => { if (!v) setShowSaveDialog(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("fence.saveTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("fence.name")}</Label>
              <Input value={fenceName} onChange={(e) => setFenceName(e.target.value)} placeholder={t("fence.namePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fence.description")}</Label>
              <Input value={fenceDesc} onChange={(e) => setFenceDesc(e.target.value)} placeholder={t("fence.descPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fence.color")}</Label>
              <div className="flex gap-2">
                {FENCE_COLORS.map((c) => (
                  <button key={c} onClick={() => setFenceColor(c)}
                    className={cn("h-6 w-6 rounded-full transition-transform", fenceColor === c && "scale-125 ring-2 ring-white ring-offset-2")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("fence.pointCount", { count: drawPoints.length })}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowSaveDialog(false)}>{t("fence.back")}</Button>
              <Button className="flex-1" disabled={!fenceName.trim() || savePending} onClick={handleSaveFence}>{t("fence.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
