"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Briefcase,
  CheckCircle2,
  Clock,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Siren,
  UserX,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { addTimelineEntry } from "@/app/(dashboard)/timeline/actions";
import { updateAgentStatus } from "@/app/(dashboard)/agents/actions";
import { triggerSos } from "@/app/(dashboard)/emergency/actions";
import { AgentStatusBadge } from "@/components/shared/status-badges";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AGENT_STATUS_META } from "@/lib/constants";
import { cn, initials, timeAgo } from "@/lib/utils";
import type { Agent, AgentStatus, Case } from "@/lib/types";

const GPS_INTERVAL_MS = 55_000;
const SIGNIFICANT_MOVE_M = 10;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type GpsState = "idle" | "acquiring" | "active" | "error";

interface BatteryInfo {
  level: number;
  charging: boolean;
}

interface Props {
  agent: Agent | null;
  activeCases: Case[];
  noAgentMessage: string;
}

export function FieldClient({ agent: initialAgent, activeCases, noAgentMessage }: Props) {
  const t = useTranslations("field");
  const tStatus = useTranslations("status.agent");
  const STATUSES = Object.keys(AGENT_STATUS_META) as AgentStatus[];

  const [agent, setAgent] = useState<Agent | null>(initialAgent);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [lastPos, setLastPos] = useState<GeolocationCoordinates | null>(null);
  const [lastPingAt, setLastPingAt] = useState<Date | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  const [pingPending, setPingPending] = useState(false);
  const [now, setNow] = useState(Date.now);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // ── Clock tick for "X ago" labels ──
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // ── Battery API ──
  useEffect(() => {
    if (typeof navigator === "undefined" || !("getBattery" in navigator)) return;
    (navigator as any).getBattery().then((b: any) => {
      function update() {
        setBattery({ level: Math.round(b.level * 100), charging: b.charging });
      }
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);
      return () => {
        b.removeEventListener("levelchange", update);
        b.removeEventListener("chargingchange", update);
      };
    }).catch(() => {});
  }, []);

  // ── GPS ping ──
  const sendPing = useCallback(async (coords: GeolocationCoordinates, forcedStatus?: AgentStatus) => {
    if (!agent || pingPending) return;
    setPingPending(true);
    try {
      const body: Record<string, unknown> = {
        lat: coords.latitude,
        lng: coords.longitude,
        speed_kmh: coords.speed != null ? coords.speed * 3.6 : undefined,
        heading: coords.heading ?? undefined,
      };
      if (battery) {
        body.battery = battery.level;
        body.charging = battery.charging;
      }
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
  }, [agent, battery, pingPending, t]);

  // ── Start GPS watch ──
  useEffect(() => {
    if (!agent || !navigator.geolocation) {
      if (!navigator.geolocation) setGpsState("error");
      return;
    }
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
  }, [agent]);

  // ── Periodic ping ──
  useEffect(() => {
    if (!lastPos || !agent) return;

    async function maybePing() {
      if (!lastPos) return;
      const prev = lastSentPosRef.current;
      const moved = prev
        ? haversineM(prev.lat, prev.lng, lastPos.latitude, lastPos.longitude) > SIGNIFICANT_MOVE_M
        : true;
      if (moved) await sendPing(lastPos);
    }

    maybePing(); // first ping immediately on position acquired
    timerRef.current = setInterval(maybePing, GPS_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPos?.latitude, lastPos?.longitude, agent?.id]);

  // ── Status change ──
  const [statusPending, startStatus] = useTransition();

  function handleStatusChange(newStatus: AgentStatus) {
    if (!agent) return;
    startStatus(async () => {
      const res = await updateAgentStatus(agent.id, newStatus);
      if (res?.error) { toast.error(res.error); return; }
      setAgent((prev) => prev ? { ...prev, status: newStatus } : prev);
      // If we have GPS, include the status in the next ping immediately
      if (lastPos) sendPing(lastPos, newStatus);
    });
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 py-16 text-center">
        <UserX className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{noAgentMessage}</p>
      </div>
    );
  }

  const gpsColor =
    gpsState === "active" ? "text-emerald-500" :
    gpsState === "acquiring" ? "text-amber-500" : "text-red-500";

  return (
    <div className="space-y-4">
      {/* ── Identity + status ── */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-14 w-14 text-base">
            <AvatarFallback className="font-semibold">{initials(agent.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{agent.full_name}</p>
            <p className="text-xs text-muted-foreground font-mono">{agent.agent_code}</p>
            {agent.area && <p className="text-xs text-muted-foreground mt-0.5">{agent.area}</p>}
          </div>
          <AgentStatusBadge status={agent.status} />
        </CardContent>
      </Card>

      {/* ── Status selector ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">{t("myStatus")}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STATUSES.map((s) => {
              const meta = AGENT_STATUS_META[s];
              const active = agent.status === s;
              return (
                <button
                  key={s}
                  disabled={statusPending || agent.status === s}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    "flex min-h-[48px] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-card hover:bg-accent/40 text-foreground",
                  )}
                >
                  {statusPending && active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    tStatus(s)
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── GPS & signal ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Navigation className={cn("h-3.5 w-3.5", gpsColor)} />
            {t("gpsSignal")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {gpsState === "active" && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              )}
              <span className={cn("font-medium", gpsColor)}>
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
              className="h-8 gap-1.5 text-xs"
              disabled={!lastPos || pingPending}
              onClick={() => lastPos && sendPing(lastPos)}
            >
              {pingPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {t("ping")}
            </Button>
          </div>

          {lastPos && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono">
                {lastPos.latitude.toFixed(5)}, {lastPos.longitude.toFixed(5)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{lastPingAt ? t("lastPing", { time: timeAgo(lastPingAt) }) : t("noPing")}</span>
            </div>
            {battery && (
              <div className="flex items-center gap-1.5">
                {battery.charging ? (
                  <BatteryCharging className="h-3.5 w-3.5 text-emerald-500" />
                ) : battery.level > 60 ? (
                  <BatteryFull className="h-3.5 w-3.5 text-emerald-500" />
                ) : battery.level > 25 ? (
                  <BatteryMedium className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <BatteryLow className="h-3.5 w-3.5 text-red-500" />
                )}
                <span>{battery.level}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Active cases ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Briefcase className="h-3.5 w-3.5" />
            {t("activeCases")} ({activeCases.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {activeCases.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noActiveCases")}</p>
          ) : (
            <div className="space-y-2">
              {activeCases.map((c) => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-primary">{c.case_number}</p>
                    {c.client_name && (
                      <p className="text-xs text-muted-foreground truncate">{c.client_name}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0 text-xs capitalize">
                    {c.status.replace("_", " ")}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 gap-3">
        <LogEntryDialog cases={activeCases} />
        <SosDialog lat={lastPos?.latitude} lng={lastPos?.longitude} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Log Entry Dialog
// ─────────────────────────────────────────────

function LogEntryDialog({ cases }: { cases: Case[] }) {
  const t = useTranslations("field");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selectedCase, setSelectedCase] = useState(cases[0]?.id ?? "");

  function onSubmit(formData: FormData) {
    start(async () => {
      if (!selectedCase) { toast.error(t("log.noCase")); return; }
      formData.set("case_id", selectedCase);
      const today = new Date();
      formData.set("entry_date", today.toISOString().slice(0, 10));
      formData.set("entry_time", today.toTimeString().slice(0, 5));
      const res = await addTimelineEntry(formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("log.success"));
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex min-h-[56px] flex-col gap-0.5 h-auto py-3">
          <Clock className="h-5 w-5" />
          <span className="text-xs">{t("log.button")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("log.title")}</DialogTitle>
          <DialogDescription>{t("log.description")}</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          {cases.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("log.case")}</Label>
              <Select value={selectedCase} onValueChange={setSelectedCase}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_number}{c.client_name ? ` · ${c.client_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {cases.length === 0 && (
            <input type="hidden" name="case_id" value="" />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="log-location">{t("log.location")}</Label>
            <Input id="log-location" name="location" placeholder={t("log.locationPlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-entry">{t("log.entry")}</Label>
            <Textarea
              id="log-entry"
              name="entry"
              rows={4}
              placeholder={t("log.entryPlaceholder")}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("log.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// SOS Dialog
// ─────────────────────────────────────────────

function SosDialog({ lat, lng }: { lat?: number; lng?: number }) {
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
          className="flex min-h-[56px] flex-col gap-0.5 h-auto py-3 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Siren className="h-5 w-5" />
          <span className="text-xs">{t("sos.button")}</span>
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
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />}
            {tSos("sendButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
