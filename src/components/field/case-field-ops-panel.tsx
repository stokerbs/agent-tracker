"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Siren,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateAgentStatus } from "@/app/(dashboard)/agents/actions";
import { triggerSos } from "@/app/(dashboard)/emergency/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AGENT_STATUS_META } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import type { Agent, AgentStatus } from "@/lib/types";

const GPS_INTERVAL_MS = 55_000;
const SIGNIFICANT_MOVE_M = 10;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type GpsState = "idle" | "acquiring" | "active" | "error";
interface BatteryInfo { level: number; charging: boolean; }

interface Props {
  agent: Agent;
}

export function CaseFieldOpsPanel({ agent: initialAgent }: Props) {
  const t = useTranslations("field");
  const tStatus = useTranslations("status.agent");

  const STATUSES = (Object.keys(AGENT_STATUS_META) as AgentStatus[]).filter(
    (s) => s !== "emergency",
  );

  const [agent, setAgent] = useState(initialAgent);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [lastPos, setLastPos] = useState<GeolocationCoordinates | null>(null);
  const [lastPingAt, setLastPingAt] = useState<Date | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  const [pingPending, setPingPending] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // Tick every 15 s so "last ping X ago" stays fresh
  const [, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Battery API
  useEffect(() => {
    if (typeof navigator === "undefined" || !("getBattery" in navigator)) return;
    (navigator as any).getBattery().then((b: any) => {
      function update() { setBattery({ level: Math.round(b.level * 100), charging: b.charging }); }
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);
    }).catch(() => {});
  }, []);

  // Location ping
  const sendPing = useCallback(
    async (coords: GeolocationCoordinates, forcedStatus?: AgentStatus) => {
      if (pingPending) return;
      setPingPending(true);
      try {
        const body: Record<string, unknown> = {
          lat: coords.latitude,
          lng: coords.longitude,
          speed_kmh: coords.speed != null ? coords.speed * 3.6 : undefined,
          heading: coords.heading ?? undefined,
        };
        if (battery) { body.battery = battery.level; body.charging = battery.charging; }
        if (forcedStatus) body.status = forcedStatus;
        const res = await fetch("/api/agents/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        lastSentPosRef.current = { lat: coords.latitude, lng: coords.longitude };
        setLastPingAt(new Date());
      } catch {
        toast.error(t("pingFailed"));
      } finally {
        setPingPending(false);
      }
    },
    [battery, pingPending, t],
  );

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) { setGpsState("error"); return; }
    setGpsState("acquiring");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsState("active");
        setLastPos(pos.coords);
        setAccuracy(Math.round(pos.coords.accuracy));
      },
      () => setGpsState("error"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Auto-ping on significant movement
  useEffect(() => {
    if (!lastPos) return;
    async function maybePing() {
      if (!lastPos) return;
      const prev = lastSentPosRef.current;
      const moved = prev
        ? haversineM(prev.lat, prev.lng, lastPos.latitude, lastPos.longitude) > SIGNIFICANT_MOVE_M
        : true;
      if (moved) await sendPing(lastPos);
    }
    maybePing();
    timerRef.current = setInterval(maybePing, GPS_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPos?.latitude, lastPos?.longitude]);

  // Status change
  const [statusPending, startStatus] = useTransition();
  function handleStatusChange(newStatus: AgentStatus) {
    startStatus(async () => {
      const res = await updateAgentStatus(agent.id, newStatus);
      if (res?.error) { toast.error(res.error); return; }
      setAgent((prev) => ({ ...prev, status: newStatus }));
      if (lastPos) sendPing(lastPos, newStatus);
    });
  }

  const gpsColor =
    gpsState === "active" ? "text-emerald-500" :
    gpsState === "acquiring" ? "text-amber-500" :
    "text-red-500";

  return (
    <div className="space-y-4">
      {/* Status selector */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("myStatus")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STATUSES.map((s) => {
            const active = agent.status === s;
            return (
              <button
                key={s}
                disabled={statusPending || active}
                onClick={() => handleStatusChange(s)}
                className={cn(
                  "flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 bg-card hover:bg-accent/40 text-foreground",
                )}
              >
                {statusPending && active
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : tStatus(s)}
              </button>
            );
          })}
        </div>
      </div>

      {/* GPS status */}
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className={cn("h-3.5 w-3.5 shrink-0", gpsColor)} />
            {gpsState === "active" && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
            <span className={cn("text-xs font-medium", gpsColor)}>
              {gpsState === "active" ? t("gpsActive") :
               gpsState === "acquiring" ? t("gpsAcquiring") :
               gpsState === "idle" ? t("gpsIdle") : t("gpsError")}
            </span>
            {accuracy != null && gpsState === "active" && (
              <span className="text-xs text-muted-foreground">±{accuracy}m</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={!lastPos || pingPending}
            onClick={() => lastPos && sendPing(lastPos)}
          >
            {pingPending
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />}
            {t("ping")}
          </Button>
        </div>

        {lastPos && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="font-mono">
              {lastPos.latitude.toFixed(5)}, {lastPos.longitude.toFixed(5)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{lastPingAt ? t("lastPing", { time: timeAgo(lastPingAt) }) : t("noPing")}</span>
          </div>
          {battery && (
            <div className="flex items-center gap-1">
              {battery.charging
                ? <BatteryCharging className="h-3 w-3 text-emerald-500" />
                : battery.level > 60
                  ? <BatteryFull className="h-3 w-3 text-emerald-500" />
                  : battery.level > 25
                    ? <BatteryMedium className="h-3 w-3 text-amber-500" />
                    : <BatteryLow className="h-3 w-3 text-red-500" />}
              <span>{battery.level}%</span>
            </div>
          )}
        </div>
      </div>

      {/* SOS */}
      <SosPanel lat={lastPos?.latitude} lng={lastPos?.longitude} />
    </div>
  );
}

function SosPanel({ lat, lng }: { lat?: number; lng?: number }) {
  const t = useTranslations("field");
  const tSos = useTranslations("emergency.sos");
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  function fire() {
    start(async () => {
      const res = await triggerSos({ lat, lng, notes: notes || undefined });
      if (res?.error) { toast.error(res.error); return; }
      toast.success(tSos("toast.success"));
      setOpen(false);
      setNotes("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Siren className="h-4 w-4" />
          {t("sos.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Siren className="h-5 w-5" /> {tSos("dialogTitle")}
          </DialogTitle>
          <DialogDescription>{tSos("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={tSos("notesPlaceholder")}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button variant="destructive" onClick={fire} disabled={pending}>
            {pending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Siren className="h-4 w-4" />}
            {tSos("sendButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
