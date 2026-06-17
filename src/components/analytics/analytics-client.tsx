"use client";

import { useEffect, useRef, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  Polyline,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Gauge, Clock, Route, Zap, Loader2, MapPinOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/types";

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";
const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 }; // Bangkok

interface HistoryPoint {
  lat: number;
  lng: number;
  speed_kmh: number | null;
  recorded_at: string;
}

interface HeatPoint {
  lat: number;
  lng: number;
}

interface ShiftMetrics {
  distanceKm: number;
  durationMs: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  pingCount: number;
}

// ── Haversine ─────────────────────────────────────────────────────────────

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeMetrics(points: HistoryPoint[]): ShiftMetrics {
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineKm(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng,
    );
  }
  const first = new Date(points[0].recorded_at).getTime();
  const last = new Date(points[points.length - 1].recorded_at).getTime();
  const speeds = points.map((p) => p.speed_kmh ?? 0).filter((s) => s > 0);
  return {
    distanceKm,
    durationMs: last - first,
    avgSpeedKmh: speeds.length
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : 0,
    maxSpeedKmh: speeds.length ? Math.max(...speeds) : 0,
    pingCount: points.length,
  };
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function toChartData(points: HistoryPoint[]) {
  const step = Math.max(1, Math.ceil(points.length / 300));
  return points
    .filter((_, i) => i % step === 0)
    .map((p) => ({
      time: new Date(p.recorded_at).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      speed: Math.round((p.speed_kmh ?? 0) * 10) / 10,
    }));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgoStr() {
  return new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

// ── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("text-muted-foreground/50", accent)}>{icon}</span>
      </div>
      <p className={cn("mt-2 font-mono text-2xl font-semibold", accent)}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Route layer (inside <Map>) ───────────────────────────────────────────────

function RouteLayer({ points }: { points: HistoryPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 48);
  }, [map, points]);

  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <>
      <Polyline
        path={points.map((p) => ({ lat: p.lat, lng: p.lng }))}
        strokeColor="#3B82F6"
        strokeWeight={3}
        strokeOpacity={0.85}
      />
      <AdvancedMarker position={{ lat: first.lat, lng: first.lng }} zIndex={10}>
        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow" title="Start" />
      </AdvancedMarker>
      <AdvancedMarker position={{ lat: last.lat, lng: last.lng }} zIndex={10}>
        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-red-500 shadow" title="End" />
      </AdvancedMarker>
    </>
  );
}

// ── Heatmap layer (inside <Map>) ─────────────────────────────────────────────

function HeatmapLayerInner({ points }: { points: HeatPoint[] }) {
  const map = useMap();
  const vizLib = useMapsLibrary("visualization");
  const layerRef = useRef<any>(null); // HeatmapLayer types incomplete in @types/google.maps

  useEffect(() => {
    if (!map || !vizLib || points.length === 0) return;

    layerRef.current?.setMap(null);
    const Ctor = (vizLib as any).HeatmapLayer; // visualization lib types incomplete
    layerRef.current = new Ctor({
      data: points.map((p) => new google.maps.LatLng(p.lat, p.lng)),
      map,
      radius: 25,
      opacity: 0.75,
    });

    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 40);

    return () => {
      layerRef.current?.setMap(null);
    };
  }, [map, vizLib, points]);

  return null;
}

// ── Main component ───────────────────────────────────────────────────────────

export function AnalyticsClient({ agents }: { agents: Agent[] }) {
  const t = useTranslations("analytics");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const supabase = createClient();

  // Shift state — dates initialised client-side to avoid SSR/hydration mismatch
  const [shiftAgentId, setShiftAgentId] = useState(agents[0]?.id ?? "");
  const [shiftDate, setShiftDate] = useState("");
  const [shiftPoints, setShiftPoints] = useState<HistoryPoint[] | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);

  // Heatmap state
  const [heatAgentId, setHeatAgentId] = useState("all");
  const [heatStart, setHeatStart] = useState("");
  const [heatEnd, setHeatEnd] = useState("");
  const [heatPoints, setHeatPoints] = useState<HeatPoint[] | null>(null);
  const [heatLoading, setHeatLoading] = useState(false);

  // today is kept in state so max= attributes never differ between SSR and client
  const [today, setToday] = useState("");

  // Set date defaults once in browser only
  useEffect(() => {
    const t = todayStr();
    setToday(t);
    setShiftDate(t);
    setHeatStart(sevenDaysAgoStr());
    setHeatEnd(t);
  }, []);

  async function loadShift() {
    if (!shiftAgentId) return;
    setShiftLoading(true);
    setShiftPoints(null);
    const { data } = await supabase
      .from("agent_location_history")
      .select("lat,lng,speed_kmh,recorded_at")
      .eq("agent_id", shiftAgentId)
      .gte("recorded_at", `${shiftDate}T00:00:00`)
      .lte("recorded_at", `${shiftDate}T23:59:59`)
      .order("recorded_at", { ascending: true })
      .limit(2000);
    setShiftPoints((data as HistoryPoint[]) ?? []);
    setShiftLoading(false);
  }

  async function loadHeatmap() {
    setHeatLoading(true);
    setHeatPoints(null);
    let query = supabase
      .from("agent_location_history")
      .select("lat,lng")
      .gte("recorded_at", `${heatStart}T00:00:00`)
      .lte("recorded_at", `${heatEnd}T23:59:59`)
      .limit(50000);
    if (heatAgentId !== "all") {
      query = query.eq("agent_id", heatAgentId);
    }
    const { data } = await query;
    setHeatPoints((data as HeatPoint[]) ?? []);
    setHeatLoading(false);
  }

  const metrics = shiftPoints?.length ? computeMetrics(shiftPoints) : null;
  const chartData = shiftPoints ? toChartData(shiftPoints) : [];

  return (
    <Tabs defaultValue="shift" className="space-y-4">
      <TabsList>
        <TabsTrigger value="shift">{t("tabs.shift")}</TabsTrigger>
        <TabsTrigger value="heatmap">{t("tabs.heatmap")}</TabsTrigger>
      </TabsList>

      {/* ── Shift Summary tab ─────────────────────────────────────────── */}
      <TabsContent value="shift" className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("agent")}</Label>
            <Select value={shiftAgentId} onValueChange={setShiftAgentId}>
              <SelectTrigger className="h-9 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name}
                    <span className="ml-1.5 font-mono text-muted-foreground">
                      {a.agent_code}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("date")}</Label>
            <input
              type="date"
              value={shiftDate}
              max={today || undefined}
              onChange={(e) => setShiftDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <Button
            size="sm"
            onClick={loadShift}
            disabled={shiftLoading || !shiftAgentId}
            className="h-9"
          >
            {shiftLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              t("load")
            )}
          </Button>
        </div>

        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard
              label={t("metrics.distance")}
              value={`${metrics.distanceKm.toFixed(1)}`}
              sub="km"
              icon={<Route className="h-4 w-4" />}
              accent="text-blue-500"
            />
            <MetricCard
              label={t("metrics.duration")}
              value={fmtDuration(metrics.durationMs)}
              icon={<Clock className="h-4 w-4" />}
              accent="text-violet-500"
            />
            <MetricCard
              label={t("metrics.avgSpeed")}
              value={`${metrics.avgSpeedKmh.toFixed(1)}`}
              sub="km/h"
              icon={<Gauge className="h-4 w-4" />}
              accent="text-emerald-500"
            />
            <MetricCard
              label={t("metrics.maxSpeed")}
              value={`${metrics.maxSpeedKmh.toFixed(1)}`}
              sub="km/h"
              icon={<Zap className="h-4 w-4" />}
              accent="text-amber-500"
            />
            <MetricCard
              label={t("metrics.pings")}
              value={String(metrics.pingCount)}
              icon={<MapPinOff className="h-4 w-4" />}
            />
          </div>
        )}

        {/* Speed chart */}
        {chartData.length > 1 && (
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              {t("chart.title")}
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  unit=" km/h"
                  width={52}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  formatter={(v) => [`${v} km/h`, t("chart.speed")]}
                />
                <Area
                  type="monotone"
                  dataKey="speed"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#speedGrad)"
                  dot={false}
                  activeDot={{ r: 3, fill: "#3B82F6" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Map */}
        {shiftPoints !== null && (
          <div className="overflow-hidden rounded-xl border border-border/60">
            {shiftPoints.length < 2 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                {t("noData")}
              </div>
            ) : !apiKey ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                {t("noApiKey")}
              </div>
            ) : (
              <APIProvider apiKey={apiKey}>
                <Map
                  mapId={MAP_ID}
                  defaultCenter={DEFAULT_CENTER}
                  defaultZoom={12}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  className="h-[400px] w-full"
                >
                  <RouteLayer points={shiftPoints} />
                </Map>
              </APIProvider>
            )}
          </div>
        )}
      </TabsContent>

      {/* ── Heatmap tab ────────────────────────────────────────────────── */}
      <TabsContent value="heatmap" className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("agent")}</Label>
            <Select value={heatAgentId} onValueChange={setHeatAgentId}>
              <SelectTrigger className="h-9 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allAgents")}</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name}
                    <span className="ml-1.5 font-mono text-muted-foreground">
                      {a.agent_code}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("dateStart")}</Label>
            <input
              type="date"
              value={heatStart}
              max={heatEnd}
              onChange={(e) => setHeatStart(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("dateEnd")}</Label>
            <input
              type="date"
              value={heatEnd}
              max={today || undefined}
              onChange={(e) => setHeatEnd(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <Button
            size="sm"
            onClick={loadHeatmap}
            disabled={heatLoading}
            className="h-9"
          >
            {heatLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              t("load")
            )}
          </Button>

          {heatPoints !== null && heatPoints.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("heatmap.points", { count: heatPoints.length.toLocaleString() })}
            </span>
          )}
        </div>

        {/* Map */}
        {heatPoints !== null && (
          <div className="overflow-hidden rounded-xl border border-border/60">
            {heatPoints.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                {t("noHeatData")}
              </div>
            ) : !apiKey ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                {t("noApiKey")}
              </div>
            ) : (
              <APIProvider apiKey={apiKey}>
                <Map
                  mapId={MAP_ID}
                  defaultCenter={DEFAULT_CENTER}
                  defaultZoom={12}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  className="h-[520px] w-full"
                >
                  <HeatmapLayerInner points={heatPoints} />
                </Map>
              </APIProvider>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
