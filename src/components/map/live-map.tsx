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
  InfoWindow,
  Map,
  Polygon,
  Polyline,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import {
  AlertTriangle,
  BatteryCharging,
  BatteryMedium,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crosshair,
  Gauge,
  LayoutDashboard,
  MapPinOff,
  Pencil,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AgentStatusBadge } from "@/components/shared/status-badges";
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
  AGENT_STATUS_META,
  DEFAULT_MAP_CENTER,
  GPS_REFRESH_MS,
} from "@/lib/constants";
import { batteryColor, initials, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { createGeofence, deleteGeofence } from "@/app/(dashboard)/map/actions";
import type {
  Agent,
  AgentStatus,
  AgentVehicleType,
  EmergencyAlert,
  Geofence,
} from "@/lib/types";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "detective-pulse-ops-map";
const AGENT_STATUSES = Object.keys(AGENT_STATUS_META) as AgentStatus[];
const STALE_MS = 10 * 60 * 1000; // 10 minutes → stale
const VERY_STALE_MS = 30 * 60 * 1000; // 30 minutes → very stale

const FENCE_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
];

// ─────────────────────────────────────────────
// Speed utilities
// ─────────────────────────────────────────────

function speedColor(kmh: number): string {
  if (kmh < 1) return "#64748b";   // stopped — slate
  if (kmh < 20) return "#22c55e";  // slow — green
  if (kmh < 60) return "#f59e0b";  // moving — amber
  return "#ef4444";                 // high speed — red
}

function speedRingClass(kmh: number): string {
  if (kmh < 1) return "border-slate-400";
  if (kmh < 20) return "border-green-500";
  if (kmh < 60) return "border-amber-500";
  return "border-red-500";
}

function mapStatus(agent: Agent, now: number): "online" | "moving" | "idle" | "offline" {
  const sinceActive = agent.last_active
    ? now - new Date(agent.last_active).getTime()
    : Infinity;
  if (agent.status === "offline" || sinceActive > STALE_MS) return "offline";
  if ((agent.speed_kmh ?? 0) > 1) return "moving";
  if (sinceActive < STALE_MS) return "idle";
  return "online";
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
      const eased = 1 - (1 - t) ** 3; // cubic ease-out
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
// Vehicle icons (top-down, pointing north)
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
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
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
    case "supervisor":
      return (
        <svg {...shared}>
          <path d="M12 3l8 4v5c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V7l8-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "emergency":
      return (
        <svg {...shared} stroke="none">
          <path fill="#ef4444" d="M12 2l9 5v6c0 5.5-4 10.5-9 12-5-1.5-9-6.5-9-12V7l9-5z" />
          <rect fill="white" x="10.5" y="6" width="3" height="7" rx="1" />
          <rect fill="white" x="10.5" y="15" width="3" height="3" rx="1" />
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

interface AgentMarkerProps {
  agent: Agent;
  isEmergency: boolean;
  isSelected: boolean;
  now: number;
  onSelect: (a: Agent) => void;
}

function AgentMarker({ agent, isEmergency, isSelected, now, onSelect }: AgentMarkerProps) {
  const pos = useAnimatedPosition(agent.current_lat, agent.current_lng);
  if (!pos) return null;

  const speed = agent.speed_kmh ?? 0;
  const heading = agent.heading ?? 0;
  const isMoving = speed > 1;
  const sinceActive = agent.last_active
    ? now - new Date(agent.last_active).getTime()
    : Infinity;
  const isStale = sinceActive > STALE_MS;
  const isVeryStale = sinceActive > VERY_STALE_MS;

  return (
    <AdvancedMarker
      position={pos}
      onClick={() => onSelect(agent)}
      zIndex={isEmergency ? 1000 : isSelected ? 500 : isMoving ? 100 : 10}
    >
      <div className="relative cursor-pointer select-none" title={agent.full_name}>
        {/* Emergency flash ring */}
        {isEmergency && (
          <span className="absolute inset-[-4px] rounded-full bg-red-500/60 animate-ping" />
        )}

        {/* Main badge */}
        <div
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] bg-card shadow-lg transition-all duration-300",
            speedRingClass(isStale ? 0 : speed),
            isSelected && "ring-2 ring-white ring-offset-1",
            isEmergency && "bg-red-50",
          )}
        >
          {/* Vehicle icon, rotated by heading when moving */}
          <div
            className="flex items-center justify-center transition-transform duration-1000"
            style={{ transform: isMoving ? `rotate(${heading}deg)` : "none" }}
          >
            <VehicleIcon
              type={agent.vehicle_type}
              size={20}
              color={isEmergency ? "#ef4444" : isVeryStale ? "#94a3b8" : "#1e293b"}
            />
          </div>
        </div>

        {/* Status dot (bottom-right) */}
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
            isStale || agent.status === "offline"
              ? "bg-slate-400"
              : isMoving
              ? "bg-amber-500"
              : "bg-emerald-500",
          )}
        />

        {/* Stale warning dot (top-right) */}
        {isStale && !isVeryStale && (
          <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 border-2 border-white" />
        )}
      </div>
    </AdvancedMarker>
  );
}

// ─────────────────────────────────────────────
// Trail layer (Polylines inside <Map>)
// ─────────────────────────────────────────────

function TrailLayer({
  agentId,
  durationMinutes,
}: {
  agentId: string;
  durationMinutes: 15 | 30 | 60;
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

  const n = path.length;
  const t1 = Math.max(1, Math.floor(n / 3));
  const t2 = Math.max(2, Math.floor((2 * n) / 3));

  // Three segments with increasing opacity (oldest → newest)
  return (
    <>
      {t1 >= 2 && (
        <Polyline
          path={path.slice(0, t1)}
          strokeColor="#3B82F6"
          strokeOpacity={0.2}
          strokeWeight={3}
        />
      )}
      {t2 - t1 >= 2 && (
        <Polyline
          path={path.slice(t1 - 1, t2)}
          strokeColor="#3B82F6"
          strokeOpacity={0.5}
          strokeWeight={3}
        />
      )}
      {n - t2 >= 2 && (
        <Polyline
          path={path.slice(t2 - 1)}
          strokeColor="#3B82F6"
          strokeOpacity={0.9}
          strokeWeight={4}
        />
      )}
      {/* Start dot */}
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
  geofences,
  drawPoints,
  selectedFence,
  onFenceClick,
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

      {/* In-progress drawing */}
      {drawPoints.length >= 2 && (
        <>
          <Polyline
            path={
              drawPoints.length >= 3
                ? [...drawPoints, drawPoints[0]]
                : drawPoints
            }
            strokeColor="#f59e0b"
            strokeOpacity={0.8}
            strokeWeight={2}
          />
          {drawPoints.map((pt, i) => (
            <AdvancedMarker key={i} position={pt} zIndex={200}>
              <div
                className={cn(
                  "h-3 w-3 rounded-full border-2 border-white shadow",
                  i === 0 ? "bg-amber-600" : "bg-amber-400",
                )}
              />
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
// Operations dashboard panel
// ─────────────────────────────────────────────

function OpsPanel({
  agents,
  open,
  onToggle,
  now,
}: {
  agents: Agent[];
  open: boolean;
  onToggle: () => void;
  now: number;
}) {
  const t = useTranslations("map");
  const active = agents.filter((a) => {
    const s = mapStatus(a, now);
    return s !== "offline";
  }).length;
  const moving = agents.filter((a) => (a.speed_kmh ?? 0) > 1).length;
  const offline = agents.filter((a) => {
    const s = mapStatus(a, now);
    return s === "offline";
  }).length;
  const movingSpeeds = agents
    .filter((a) => (a.speed_kmh ?? 0) > 1)
    .map((a) => a.speed_kmh ?? 0);
  const avgSpeed =
    movingSpeeds.length > 0
      ? Math.round(movingSpeeds.reduce((s, v) => s + v, 0) / movingSpeeds.length)
      : 0;

  return (
    <div className="absolute left-3 top-3 z-10">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="mb-1 w-48 overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-xl backdrop-blur"
          >
            <div className="border-b border-border/40 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <LayoutDashboard className="h-3 w-3" />
                {t("ops.title")}
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border/40">
              <StatTile
                label={t("ops.active")}
                value={active}
                dot="bg-emerald-500"
              />
              <StatTile
                label={t("ops.moving")}
                value={moving}
                dot="bg-amber-500"
              />
              <StatTile
                label={t("ops.offline")}
                value={offline}
                dot="bg-slate-400"
              />
              <StatTile
                label={t("ops.avgSpeed")}
                value={`${avgSpeed}`}
                unit="km/h"
                dot="bg-blue-500"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="h-7 gap-1 bg-card/95 px-2 text-xs backdrop-blur shadow-md"
      >
        <LayoutDashboard className="h-3 w-3" />
        {open ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  dot,
}: {
  label: string;
  value: number | string;
  unit?: string;
  dot: string;
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
  alerts,
  agents,
  onZoom,
}: {
  alerts: EmergencyAlert[];
  agents: Agent[];
  onZoom: (lat: number, lng: number) => void;
}) {
  const t = useTranslations("map");
  if (alerts.length === 0) return null;

  const latest = alerts[0];
  const agentName =
    latest.agent_id
      ? agents.find((a) => a.id === latest.agent_id)?.full_name ?? "Agent"
      : "Unknown";

  return (
    <div className="absolute inset-x-0 top-0 z-20 mx-3 mt-3">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
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
          <Button
            size="sm"
            variant="destructive"
            className="h-7 gap-1 text-xs"
            onClick={() => onZoom(latest.lat!, latest.lng!)}
          >
            <Crosshair className="h-3 w-3" />
            {t("emergency.zoom")}
          </Button>
        )}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
// InfoWindow content
// ─────────────────────────────────────────────

function AgentInfoContent({
  agent,
  now,
}: {
  agent: Agent;
  now: number;
}) {
  const t = useTranslations("map");
  const speed = agent.speed_kmh ?? 0;
  const sinceActive = agent.last_active
    ? now - new Date(agent.last_active).getTime()
    : Infinity;
  const isStale = sinceActive > STALE_MS;
  const ms = mapStatus(agent, now);

  return (
    <div className="min-w-[220px] p-1 font-sans text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          {agent.photo_url && <img src={agent.photo_url} alt="" className="h-full w-full rounded-full object-cover" />}
          <AvatarFallback className="text-xs">{initials(agent.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{agent.full_name}</p>
          <p className="font-mono text-xs text-slate-500">{agent.agent_code}</p>
        </div>
      </div>

      {/* Status */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <AgentStatusBadge status={agent.status} />
        <Badge
          className={cn(
            "border text-[9px] font-bold uppercase tracking-widest",
            ms === "moving"
              ? "border-amber-400/30 bg-amber-500/10 text-amber-600"
              : ms === "offline"
              ? "border-slate-400/30 bg-slate-500/10 text-slate-500"
              : "border-emerald-400/30 bg-emerald-500/10 text-emerald-600",
          )}
        >
          {ms}
        </Badge>
      </div>

      <div className="mt-2.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
        {/* Speed */}
        <div className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 shrink-0" style={{ color: speedColor(speed) }} />
          <span style={{ color: speedColor(speed) }} className="font-mono font-semibold">
            {speed.toFixed(1)} km/h
          </span>
          {agent.heading != null && speed > 1 && (
            <span className="ml-1 text-slate-400">
              {headingLabel(agent.heading)}
            </span>
          )}
        </div>

        {/* Last update */}
        <div className={cn("flex items-center gap-1.5", isStale && "text-amber-600")}>
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{timeAgo(agent.last_active)}</span>
          {isStale && <span className="font-medium">(stale)</span>}
        </div>

        {/* Battery */}
        <div
          className={cn(
            "flex items-center gap-1.5",
            agent.is_charging ? "text-emerald-600" : batteryColor(agent.battery_pct),
          )}
        >
          {agent.is_charging ? (
            <BatteryCharging className="h-3.5 w-3.5" />
          ) : (
            <BatteryMedium className="h-3.5 w-3.5" />
          )}
          <span className="font-mono">{agent.battery_pct ?? "—"}%</span>
          {agent.is_charging && <Zap className="h-3 w-3" />}
        </div>

        {/* Area */}
        {agent.area && (
          <p className="truncate">
            <span className="text-slate-400">{t("area")}: </span>
            {agent.area}
          </p>
        )}

        {/* Vehicle type */}
        {agent.vehicle_type && (
          <p className="capitalize">
            <span className="text-slate-400">{t("vehicle")}: </span>
            {agent.vehicle_type.replace("_", " ")}
          </p>
        )}
      </div>
    </div>
  );
}

function headingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// ─────────────────────────────────────────────
// Geofence info panel (floating)
// ─────────────────────────────────────────────

function GeofenceSidebar({
  fence,
  isAdmin,
  onClose,
  onDelete,
}: {
  fence: Geofence;
  isAdmin: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("map");
  const [pending, startTransition] = useTransition();

  return (
    <div className="absolute right-3 top-3 z-10 w-52 rounded-xl border border-border/60 bg-card/95 p-3 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: fence.color }}
          />
          <p className="truncate text-sm font-semibold">{fence.name}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      {fence.description && (
        <p className="mt-1 text-xs text-muted-foreground">{fence.description}</p>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {fence.coordinates.length} {t("fence.points")}
      </p>
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 gap-1 text-xs text-destructive hover:text-destructive w-full justify-start"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await onDelete(fence.id);
            });
          }}
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
          <p className="font-mono text-xs text-muted-foreground">
            {agent.agent_code} · {agent.area}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            agent.is_charging ? "text-emerald-500" : batteryColor(agent.battery_pct),
          )}
        >
          {agent.is_charging ? (
            <BatteryCharging className="h-4 w-4" />
          ) : (
            <BatteryMedium className="h-4 w-4" />
          )}
          <span className="font-mono">{agent.battery_pct ?? "—"}%</span>
        </span>
        <AgentStatusBadge status={agent.status} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main LiveMap component
// ─────────────────────────────────────────────

interface LiveMapProps {
  initialAgents: Agent[];
  initialGeofences: Geofence[];
  emergencyAlerts: EmergencyAlert[];
  isAdmin: boolean;
}

export function LiveMap({
  initialAgents,
  initialGeofences,
  emergencyAlerts: initialAlerts,
  isAdmin,
}: LiveMapProps) {
  const t = useTranslations("map");
  const tStatus = useTranslations("status.agent");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const supabase = createClient();

  // ── Agent state ──
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [now, setNow] = useState(() => Date.now());

  // ── Geofences ──
  const [geofences, setGeofences] = useState<Geofence[]>(initialGeofences);
  const [selectedFence, setSelectedFence] = useState<Geofence | null>(null);

  // ── Emergency ──
  const [emergencyAlerts] = useState<EmergencyAlert[]>(initialAlerts);
  const emergencyMode = emergencyAlerts.some((a) => a.status === "active");
  const emergencyAgentIds = new Set(
    emergencyAlerts.filter((a) => a.status === "active").map((a) => a.agent_id).filter(Boolean),
  );

  // ── Trails ──
  const [showTrails, setShowTrails] = useState(false);
  const [trailMinutes, setTrailMinutes] = useState<15 | 30 | 60>(15);

  // ── Geofence drawing ──
  const [drawMode, setDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [fenceName, setFenceName] = useState("");
  const [fenceDesc, setFenceDesc] = useState("");
  const [fenceColor, setFenceColor] = useState(FENCE_COLORS[0]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePending, startSaveTransition] = useTransition();

  // ── UI state ──
  const [opsPanelOpen, setOpsPanelOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");

  // ── Zoom target for emergency ──
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState<number | null>(null);

  // ── Tick clock every 30s for "X ago" labels ──
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Polling refresh ──
  async function refresh() {
    const { data } = await supabase
      .from("agents")
      .select("*")
      .neq("status", "offline")
      .not("current_lat", "is", null);
    if (data) setAgents(data as Agent[]);
    setLastSync(new Date());
  }

  useEffect(() => {
    const id = setInterval(refresh, GPS_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase
      .channel("live-agents-v2")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agents" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setAgents((prev) => prev.filter((a) => a.id !== (payload.old as Agent).id));
            return;
          }
          const updated = payload.new as Agent;
          const visible =
            updated.status !== "offline" && updated.current_lat !== null;
          setAgents((prev) => {
            const exists = prev.some((a) => a.id === updated.id);
            if (!exists && visible) return [...prev, updated];
            if (exists && !visible) return prev.filter((a) => a.id !== updated.id);
            if (exists && visible)
              return prev.map((a) => (a.id === updated.id ? updated : a));
            return prev;
          });
          // Update selectedAgent if it was the one updated
          setSelectedAgent((prev) =>
            prev?.id === updated.id ? updated : prev,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filters ──
  const areas = useMemo(
    () =>
      Array.from(new Set(agents.map((a) => a.area).filter(Boolean))) as string[],
    [agents],
  );

  const VEHICLE_TYPES: Array<AgentVehicleType> = [
    "car", "motorcycle", "foot", "supervisor", "emergency",
  ];

  const filtered = agents.filter((a) => {
    if (areaFilter !== "all" && a.area !== areaFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (vehicleFilter !== "all" && a.vehicle_type !== vehicleFilter) return false;
    if (
      search &&
      !`${a.full_name} ${a.nickname ?? ""} ${a.agent_code}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const defaultCenter = useMemo(() => {
    const withCoords = filtered.filter((a) => a.current_lat && a.current_lng);
    if (withCoords.length === 0) return DEFAULT_MAP_CENTER;
    return {
      lat:
        withCoords.reduce((s, a) => s + (a.current_lat ?? 0), 0) /
        withCoords.length,
      lng:
        withCoords.reduce((s, a) => s + (a.current_lng ?? 0), 0) /
        withCoords.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Map click handler (drawing mode) ──
  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!drawMode || !e.detail.latLng) return;
      const { lat, lng } = e.detail.latLng; // LatLngLiteral — plain numbers
      setDrawPoints((prev) => [...prev, { lat, lng }]);
    },
    [drawMode],
  );

  // ── Emergency zoom ──
  const handleEmergencyZoom = useCallback((lat: number, lng: number) => {
    setMapCenter({ lat, lng });
    setMapZoom(16);
  }, []);

  // ── Geofence save ──
  async function handleSaveFence() {
    if (drawPoints.length < 3 || !fenceName.trim()) return;
    startSaveTransition(async () => {
      const result = await createGeofence({
        name: fenceName.trim(),
        description: fenceDesc.trim() || null,
        color: fenceColor,
        coordinates: drawPoints,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.fence) setGeofences((prev) => [...prev, result.fence!]);
      setDrawPoints([]);
      setFenceName("");
      setFenceDesc("");
      setDrawMode(false);
      setShowSaveDialog(false);
      toast.success(t("fence.saved"));
    });
  }

  async function handleDeleteFence(id: string) {
    const result = await deleteGeofence(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setGeofences((prev) => prev.filter((f) => f.id !== id));
    setSelectedFence(null);
    toast.success(t("fence.deleted"));
  }

  // ── Control bar ──
  const controlBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 w-36 text-xs"
      />

      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-2 overflow-hidden"
          >
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("areaAll")}</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("statusAll")}</SelectItem>
                {AGENT_STATUSES.map((k) => (
                  <SelectItem key={k} value={k}>{tStatus(k)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("vehicleAll")}</SelectItem>
                {VEHICLE_TYPES.map((v) => (
                  <SelectItem key={v} value={v} className="capitalize">
                    {v.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setFiltersOpen((f) => !f)}
        className={cn("h-8 gap-1.5 text-xs", filtersOpen && "bg-accent")}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {t("filters")}
      </Button>

      {/* Trail controls */}
      <div className="flex items-center gap-1">
        <Button
          variant={showTrails ? "secondary" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setShowTrails((v) => !v)}
        >
          <Clock className="h-3.5 w-3.5" />
          {t("trail.toggle")}
        </Button>
        {showTrails && (
          <Select
            value={String(trailMinutes)}
            onValueChange={(v) => setTrailMinutes(Number(v) as 15 | 30 | 60)}
          >
            <SelectTrigger className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="60">60 min</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Geofence draw (admin only) */}
      {isAdmin && (
        <Button
          variant={drawMode ? "secondary" : "outline"}
          size="sm"
          className={cn("h-8 gap-1.5 text-xs", drawMode && "ring-2 ring-amber-400")}
          onClick={() => {
            if (drawMode) {
              if (drawPoints.length >= 3) setShowSaveDialog(true);
              else { setDrawMode(false); setDrawPoints([]); }
            } else {
              setDrawMode(true);
              setSelectedAgent(null);
              setSelectedFence(null);
            }
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
          {drawMode
            ? drawPoints.length >= 3
              ? t("fence.finish")
              : t("fence.drawing")
            : t("fence.draw")}
        </Button>
      )}

      {drawMode && drawPoints.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
          onClick={() => { setDrawMode(false); setDrawPoints([]); }}
        >
          <X className="h-3.5 w-3.5" />
          {t("fence.cancel")}
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={refresh} className="h-8 gap-1.5 text-xs">
        <RefreshCw className="h-3.5 w-3.5" />
        {t("sync")}
      </Button>

      {/* Live indicator */}
      <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              emergencyMode ? "bg-red-500" : "bg-success",
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-1.5 w-1.5 rounded-full",
              emergencyMode ? "bg-red-500" : "bg-success",
            )}
          />
        </span>
        <span className="font-mono">{filtered.length}</span>
        <span>
          {t("agentCount", {
            count: filtered.length,
            time: timeAgo(lastSync),
          })
            .replace(/^\d+/, "")
            .trim()}
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
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            {t("noApiKeyDescription")}
          </p>
          <div className="mt-6 grid w-full max-w-2xl gap-2 px-4">
            {filtered.map((a) => (
              <AgentRow key={a.id} agent={a} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {controlBar}

      <div
        className={cn(
          "relative h-[70vh] min-h-[440px] overflow-hidden rounded-xl border border-border/60",
          drawMode && "[&_.gm-style]:cursor-crosshair",
        )}
      >
        <APIProvider apiKey={apiKey}>
          {/* Emergency banner overlays the map */}
          {emergencyMode && (
            <EmergencyBanner
              alerts={emergencyAlerts.filter((a) => a.status === "active")}
              agents={agents}
              onZoom={handleEmergencyZoom}
            />
          )}

          {/* Ops dashboard panel */}
          <OpsPanel
            agents={agents}
            open={opsPanelOpen}
            onToggle={() => setOpsPanelOpen((v) => !v)}
            now={now}
          />

          {/* Selected geofence info */}
          {selectedFence && !drawMode && (
            <GeofenceSidebar
              fence={selectedFence}
              isAdmin={isAdmin}
              onClose={() => setSelectedFence(null)}
              onDelete={handleDeleteFence}
            />
          )}

          {/* Draw mode hint */}
          {drawMode && (
            <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center">
              <div className="rounded-full border border-amber-400/50 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-700 backdrop-blur dark:text-amber-400">
                {drawPoints.length === 0
                  ? t("fence.clickToStart")
                  : t("fence.clickToAdd", { count: drawPoints.length })}
              </div>
            </div>
          )}

          <Map
            mapId={MAP_ID}
            defaultCenter={mapCenter ?? defaultCenter}
            defaultZoom={mapZoom ?? 12}
            center={mapCenter ?? undefined}
            zoom={mapZoom ?? undefined}
            onCameraChanged={() => {
              // Reset programmatic center/zoom after it's applied once
              setMapCenter(null);
              setMapZoom(null);
            }}
            gestureHandling="greedy"
            disableDefaultUI={false}
            className="h-full w-full"
            onClick={drawMode ? handleMapClick : undefined}
          >
            {/* Agent markers */}
            {filtered
              .filter((a) => a.current_lat && a.current_lng)
              .map((a) => (
                <AgentMarker
                  key={a.id}
                  agent={a}
                  isEmergency={emergencyAgentIds.has(a.id)}
                  isSelected={selectedAgent?.id === a.id}
                  now={now}
                  onSelect={setSelectedAgent}
                />
              ))}

            {/* Trail for selected agent */}
            {showTrails && selectedAgent?.id && (
              <TrailLayer
                agentId={selectedAgent.id}
                durationMinutes={trailMinutes}
              />
            )}

            {/* Trails for all agents when no specific selection */}
            {showTrails && !selectedAgent && filtered.map((a) => (
              <TrailLayer
                key={a.id}
                agentId={a.id}
                durationMinutes={trailMinutes}
              />
            ))}

            {/* Geofences */}
            <GeofenceLayer
              geofences={geofences}
              drawPoints={drawPoints}
              selectedFence={selectedFence}
              onFenceClick={(f) => {
                if (!drawMode) setSelectedFence((prev) =>
                  prev?.id === f.id ? null : f,
                );
              }}
            />

            {/* Info window */}
            {selectedAgent &&
              selectedAgent.current_lat &&
              selectedAgent.current_lng && (
                <InfoWindow
                  position={{
                    lat: selectedAgent.current_lat,
                    lng: selectedAgent.current_lng,
                  }}
                  onCloseClick={() => setSelectedAgent(null)}
                >
                  <AgentInfoContent agent={selectedAgent} now={now} />
                </InfoWindow>
              )}
          </Map>
        </APIProvider>
      </div>

      {/* Speed legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium">{t("speedLegend")}:</span>
        {(
          [
            { label: t("speed.stopped"), color: "#64748b" },
            { label: t("speed.slow"), color: "#22c55e" },
            { label: t("speed.moving"), color: "#f59e0b" },
            { label: t("speed.fast"), color: "#ef4444" },
          ] as const
        ).map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {label}
          </span>
        ))}
        <span className="ml-auto text-muted-foreground/60">{t("trailNote")}</span>
      </div>

      {/* Geofence save dialog */}
      <Dialog
        open={showSaveDialog}
        onOpenChange={(v) => {
          if (!v) { setShowSaveDialog(false); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("fence.saveTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("fence.name")}</Label>
              <Input
                value={fenceName}
                onChange={(e) => setFenceName(e.target.value)}
                placeholder={t("fence.namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fence.description")}</Label>
              <Input
                value={fenceDesc}
                onChange={(e) => setFenceDesc(e.target.value)}
                placeholder={t("fence.descPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fence.color")}</Label>
              <div className="flex gap-2">
                {FENCE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFenceColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full transition-transform",
                      fenceColor === c && "scale-125 ring-2 ring-white ring-offset-2",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("fence.pointCount", { count: drawPoints.length })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowSaveDialog(false)}
              >
                {t("fence.back")}
              </Button>
              <Button
                className="flex-1"
                disabled={!fenceName.trim() || savePending}
                onClick={handleSaveFence}
              >
                {t("fence.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
