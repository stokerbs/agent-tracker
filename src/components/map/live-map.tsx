"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import {
  BatteryCharging,
  BatteryMedium,
  MapPinOff,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { AgentStatusBadge } from "@/components/shared/status-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AGENT_STATUS_META,
  DEFAULT_MAP_CENTER,
  GPS_REFRESH_MS,
} from "@/lib/constants";
import { batteryColor, initials, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Agent, AgentStatus } from "@/lib/types";

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "detective-pulse-ops-map";
const AGENT_STATUSES = Object.keys(AGENT_STATUS_META) as AgentStatus[];

export function LiveMap({ initialAgents }: { initialAgents: Agent[] }) {
  const t = useTranslations("map");
  const tStatus = useTranslations("status.agent");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const supabase = createClient();

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

  useEffect(() => {
    const channel = supabase
      .channel("live-agents")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agents" },
        (payload) => {
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
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const areas = useMemo(
    () => Array.from(new Set(agents.map((a) => a.area).filter(Boolean))) as string[],
    [agents],
  );

  const filtered = agents.filter((a) => {
    if (areaFilter !== "all" && a.area !== areaFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (
      search &&
      !`${a.full_name} ${a.nickname ?? ""} ${a.agent_code}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const center = useMemo(() => {
    const withCoords = filtered.filter((a) => a.current_lat && a.current_lng);
    if (withCoords.length === 0) return DEFAULT_MAP_CENTER;
    return {
      lat: withCoords.reduce((s, a) => s + (a.current_lat ?? 0), 0) / withCoords.length,
      lng: withCoords.reduce((s, a) => s + (a.current_lng ?? 0), 0) / withCoords.length,
    };
  }, [filtered]);

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
              <SelectTrigger className="h-8 w-32 text-xs">
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
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("statusAll")}</SelectItem>
                {AGENT_STATUSES.map((k) => (
                  <SelectItem key={k} value={k}>{tStatus(k)}</SelectItem>
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

      <Button variant="outline" size="sm" onClick={refresh} className="h-8 gap-1.5 text-xs">
        <RefreshCw className="h-3.5 w-3.5" />
        {t("sync")}
      </Button>

      <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
        </span>
        <span className="font-mono">{filtered.length}</span>
        <span>{t("agentCount", { count: filtered.length, time: timeAgo(lastSync) }).replace(/^\d+/, "").trim()}</span>
      </div>
    </div>
  );

  if (!apiKey) {
    return (
      <div className="space-y-4">
        {controlBar}
        <div className="flex h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 text-center">
          <MapPinOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-sm">{t("noApiKeyTitle")}</p>
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
      <div className="h-[64vh] overflow-hidden rounded-xl border border-border/60">
        <APIProvider apiKey={apiKey}>
          <Map
            mapId={MAP_ID}
            defaultCenter={center}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI={false}
            className="h-full w-full"
          >
            {filtered
              .filter((a) => a.current_lat && a.current_lng)
              .map((a) => (
                <AdvancedMarker
                  key={a.id}
                  position={{ lat: a.current_lat!, lng: a.current_lng! }}
                  onClick={() => setSelected(a)}
                >
                  <AgentPin status={a.status} />
                </AdvancedMarker>
              ))}

            {selected && selected.current_lat && selected.current_lng && (
              <InfoWindow
                position={{ lat: selected.current_lat, lng: selected.current_lng }}
                onCloseClick={() => setSelected(null)}
              >
                <div className="min-w-[200px] p-1 font-sans text-slate-900">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{selected.full_name}</p>
                    <span className="font-mono text-xs text-slate-500">{selected.agent_code}</span>
                  </div>
                  <div className="mt-1.5">
                    <AgentStatusBadge status={selected.status} />
                  </div>
                  <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                    <p>
                      {t("battery")}: <strong>{selected.battery_pct ?? "—"}%</strong>
                      {selected.is_charging ? " ⚡" : ""}
                    </p>
                    {selected.area && <p>Area: {selected.area}</p>}
                    <p>{t("updated")}: {timeAgo(selected.last_active)}</p>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}

function AgentPin({ status }: { status: AgentStatus }) {
  const meta = AGENT_STATUS_META[status];
  return (
    <div className="relative">
      <span
        className={cn(
          "absolute inset-0 rounded-full animate-pulse-ring opacity-50",
          meta.dot,
        )}
      />
      <div
        className={cn(
          "relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-lg",
          meta.dot,
        )}
      >
        <span className="h-2 w-2 rounded-full bg-white" />
      </div>
    </div>
  );
}

function AgentRow({ agent }: { agent: Agent }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3 text-left">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {agent.photo_url && <AvatarImage src={agent.photo_url} />}
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
            agent.is_charging ? "text-success" : batteryColor(agent.battery_pct),
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
