"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { BatteryMedium, MapPinOff, RefreshCw } from "lucide-react";
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
import type { Agent, AgentStatus } from "@/lib/types";

const MAP_ID = "detective-pulse-ops-map";
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

  const areas = useMemo(
    () => Array.from(new Set(agents.map((a) => a.area).filter(Boolean))) as string[],
    [agents],
  );

  const filtered = agents.filter((a) => {
    if (areaFilter !== "all" && a.area !== areaFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search && !`${a.full_name} ${a.nickname ?? ""} ${a.agent_code}`.toLowerCase().includes(search.toLowerCase()))
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

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-40"
      />
      <Select value={areaFilter} onValueChange={setAreaFilter}>
        <SelectTrigger className="h-9 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("areaAll")}</SelectItem>
          {areas.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-9 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("statusAll")}</SelectItem>
          {AGENT_STATUSES.map((k) => (
            <SelectItem key={k} value={k}>
              {tStatus(k)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        {t("sync")}
      </Button>
    </div>
  );

  if (!apiKey) {
    return (
      <div className="space-y-4">
        {controls}
        <div className="flex h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed text-center">
          <MapPinOff className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">{t("noApiKeyTitle")}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        {controls}
        <p className="text-xs text-muted-foreground">
          {t("agentCount", { count: filtered.length, time: timeAgo(lastSync) })}
        </p>
      </div>

      <div className="h-[64vh] overflow-hidden rounded-xl border">
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
                <div className="min-w-[200px] p-1 text-slate-900">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{selected.full_name}</p>
                    <span className="text-xs text-slate-500">
                      {selected.agent_code}
                    </span>
                  </div>
                  <div className="mt-1">
                    <AgentStatusBadge status={selected.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {t("battery")}: {selected.battery_pct ?? "—"}% · {selected.area}
                  </p>
                  <p className="text-xs text-slate-600">
                    {t("updated")}: {timeAgo(selected.last_active)}
                  </p>
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
        className={`absolute inset-0 rounded-full ${meta.dot} animate-pulse-ring opacity-60`}
      />
      <div
        className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-md ${meta.dot}`}
      >
        <span className="h-2 w-2 rounded-full bg-white" />
      </div>
    </div>
  );
}

function AgentRow({ agent }: { agent: Agent }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3 text-left">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {agent.photo_url && <AvatarImage src={agent.photo_url} />}
          <AvatarFallback>{initials(agent.full_name)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">
            {agent.full_name}{" "}
            <span className="text-xs text-muted-foreground">
              {agent.agent_code}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {agent.area} · {agent.current_lat?.toFixed(4)},{" "}
            {agent.current_lng?.toFixed(4)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-1 text-xs ${batteryColor(agent.battery_pct)}`}>
          <BatteryMedium className="h-4 w-4" />
          {agent.battery_pct ?? "—"}%
        </span>
        <AgentStatusBadge status={agent.status} />
      </div>
    </div>
  );
}
