"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Briefcase,
  Clock,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  Navigation,
  Paperclip,
  Plus,
  RefreshCw,
  Siren,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { addTimelineEntry } from "@/app/(dashboard)/timeline/actions";
import { uploadEvidence } from "@/app/(dashboard)/evidence/actions";
import { updateAgentStatus } from "@/app/(dashboard)/agents/actions";
import { triggerSos } from "@/app/(dashboard)/emergency/actions";
import { AgentRoleBadge, AgentStatusBadge } from "@/components/shared/status-badges";
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

function todayBangkok() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}
function nowBangkok() {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type GpsState = "idle" | "acquiring" | "active" | "error";

interface BatteryInfo {
  level: number;
  charging: boolean;
}

type FilePreview = { file: File; previewUrl: string | null; kind: "photo" | "video" | "file" };

function kindForFile(f: File): FilePreview["kind"] {
  if (f.type.startsWith("image/")) return "photo";
  if (f.type.startsWith("video/")) return "video";
  return "file";
}

interface Props {
  agent: Agent | null;
  activeCases: Case[];
  noAgentMessage: string;
}

export function FieldClient({ agent: initialAgent, activeCases, noAgentMessage }: Props) {
  const t = useTranslations("field");
  const tStatus = useTranslations("status.agent");
  const STATUSES = (Object.keys(AGENT_STATUS_META) as AgentStatus[]).filter(
    (s) => s !== "emergency",
  );

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

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

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
  }, [agent, battery, pingPending, t]);

  useEffect(() => {
    if (!agent || !navigator.geolocation) {
      if (!navigator.geolocation) setGpsState("error");
      return;
    }
    setGpsState("acquiring");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { setGpsState("active"); setLastPos(pos.coords); setAccuracy(Math.round(pos.coords.accuracy)); },
      () => setGpsState("error"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [agent]);

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
    maybePing();
    timerRef.current = setInterval(maybePing, GPS_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPos?.latitude, lastPos?.longitude, agent?.id]);

  const [statusPending, startStatus] = useTransition();
  function handleStatusChange(newStatus: AgentStatus) {
    if (!agent) return;
    startStatus(async () => {
      const res = await updateAgentStatus(agent.id, newStatus);
      if (res?.error) { toast.error(res.error); return; }
      setAgent((prev) => prev ? { ...prev, status: newStatus } : prev);
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
    <div className="space-y-4 pb-6">
      {/* Identity */}
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
          <div className="flex flex-col items-end gap-1">
            {agent.agent_role && <AgentRoleBadge role={agent.agent_role} />}
            <AgentStatusBadge status={agent.status} />
          </div>
        </CardContent>
      </Card>

      {/* Status selector */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">{t("myStatus")}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STATUSES.map((s) => {
              const active = agent.status === s;
              return (
                <button
                  key={s}
                  disabled={statusPending || active}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    "flex min-h-[48px] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-card hover:bg-accent/40 text-foreground",
                  )}
                >
                  {statusPending && active ? <Loader2 className="h-4 w-4 animate-spin" /> : tStatus(s)}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* GPS */}
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
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
              disabled={!lastPos || pingPending} onClick={() => lastPos && sendPing(lastPos)}>
              {pingPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t("ping")}
            </Button>
          </div>
          {lastPos && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono">{lastPos.latitude.toFixed(5)}, {lastPos.longitude.toFixed(5)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{lastPingAt ? t("lastPing", { time: timeAgo(lastPingAt) }) : t("noPing")}</span>
            </div>
            {battery && (
              <div className="flex items-center gap-1.5">
                {battery.charging ? <BatteryCharging className="h-3.5 w-3.5 text-emerald-500" />
                  : battery.level > 60 ? <BatteryFull className="h-3.5 w-3.5 text-emerald-500" />
                  : battery.level > 25 ? <BatteryMedium className="h-3.5 w-3.5 text-amber-500" />
                  : <BatteryLow className="h-3.5 w-3.5 text-red-500" />}
                <span>{battery.level}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active cases */}
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
                <Link key={c.id} href={`/cases/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:bg-accent/40">
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-primary">{c.case_number}</p>
                    {c.client_name && <p className="text-xs text-muted-foreground truncate">{c.client_name}</p>}
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

      {/* ── Add Observation — primary action ── */}
      <AddObservationDialog cases={activeCases} lastPos={lastPos} gpsState={gpsState} />

      {/* ── SOS ── */}
      <SosDialog lat={lastPos?.latitude} lng={lastPos?.longitude} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Add Observation Dialog
// ─────────────────────────────────────────────

interface ObsDialogProps {
  cases: Case[];
  lastPos: GeolocationCoordinates | null;
  gpsState: GpsState;
}

function AddObservationDialog({ cases, lastPos, gpsState }: ObsDialogProps) {
  const t = useTranslations("field");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [selectedCase, setSelectedCase] = useState(cases[0]?.id ?? "");
  const [entry, setEntry] = useState("");
  const [date, setDate] = useState(todayBangkok());
  const [time, setTime] = useState(nowBangkok());
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<FilePreview[]>([]);

  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset form with fresh defaults each time the dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCase(cases[0]?.id ?? "");
      setEntry("");
      setDate(todayBangkok());
      setTime(nowBangkok());
      setLocation("");
      setFiles([]);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open, cases]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const previews: FilePreview[] = Array.from(list).map((f) => ({
      file: f,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      kind: kindForFile(f),
    }));
    setFiles((prev) => [...prev, ...previews]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      const p = prev[idx];
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function useGps() {
    if (!lastPos) return;
    setLocation(`${lastPos.latitude.toFixed(5)}, ${lastPos.longitude.toFixed(5)}`);
  }

  function handleClose() {
    files.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    setOpen(false);
  }

  function handleSubmit() {
    if (!entry.trim() || !selectedCase) return;
    start(async () => {
      const fd = new FormData();
      fd.set("case_id", selectedCase);
      fd.set("entry_date", date);
      fd.set("entry_time", time);
      fd.set("entry", entry.trim());
      if (location.trim()) fd.set("location", location.trim());

      const res = await addTimelineEntry(fd);
      if (res?.error) { toast.error(res.error); return; }

      if (files.length > 0 && res.id) {
        const results = await Promise.all(
          files.map(({ file }) => {
            const efd = new FormData();
            efd.set("case_id", selectedCase);
            efd.set("file", file);
            efd.set("timeline_entry_id", res.id!);
            return uploadEvidence(efd);
          }),
        );
        const failed = results.filter((r) => r?.error).length;
        if (failed > 0) {
          toast.warning(`Saved. ${failed} file(s) failed to upload.`);
        } else {
          toast.success(`${t("log.success")} · ${files.length} file${files.length > 1 ? "s" : ""} attached`);
        }
      } else {
        toast.success(t("log.success"));
      }

      files.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      setOpen(false);
      router.refresh();
    });
  }

  const photos = files.filter((f) => f.kind === "photo");
  const videos = files.filter((f) => f.kind === "video");
  const docs   = files.filter((f) => f.kind === "file");
  const gpsReady = gpsState === "active" && lastPos != null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2 h-12 text-base font-semibold" size="lg">
          <Plus className="h-5 w-5" />
          {t("log.button")}
        </Button>
      </DialogTrigger>

      {/* Bottom-sheet on mobile, centered modal on sm+ */}
      <DialogContent className="
        bottom-0 left-0 right-0 top-auto max-w-full translate-x-0 translate-y-0
        rounded-t-2xl rounded-b-none p-0
        sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2
        sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl
      ">
        <DialogHeader className="px-4 pb-2 pt-5">
          <DialogTitle className="text-base">{t("log.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("log.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto px-4 pb-2" style={{ maxHeight: "calc(80dvh - 130px)" }}>
          {/* Case selector */}
          {cases.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("log.case")}</Label>
              <Select value={selectedCase} onValueChange={setSelectedCase} disabled={pending}>
                <SelectTrigger className="h-9">
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

          {/* Observation textarea — primary field, autofocus */}
          <div className="space-y-1">
            <Label htmlFor="obs-entry" className="text-xs text-muted-foreground">{t("log.entry")}</Label>
            <Textarea
              id="obs-entry"
              ref={textareaRef}
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              rows={4}
              placeholder={t("log.entryPlaceholder")}
              disabled={pending}
              className="resize-none"
            />
          </div>

          {/* Date + Time row */}
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="h-9 text-sm" disabled={pending} />
            </div>
            <div className="w-28 space-y-1">
              <Label className="text-xs text-muted-foreground">Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="h-9 text-sm" disabled={pending} />
            </div>
          </div>

          {/* Location + GPS */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="obs-location" className="text-xs text-muted-foreground">{t("log.location")}</Label>
              {gpsReady && (
                <button
                  type="button"
                  onClick={useGps}
                  disabled={pending}
                  className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <Navigation className="h-2.5 w-2.5" />
                  Use GPS · ±{Math.round(lastPos!.accuracy)}m
                </button>
              )}
            </div>
            <Input
              id="obs-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("log.locationPlaceholder")}
              className="h-9 text-sm"
              disabled={pending}
            />
          </div>

          {/* File previews */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, idx) => (
                <div key={idx} className="relative">
                  {f.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.previewUrl} alt={f.file.name}
                      className="h-16 w-16 rounded-lg border object-cover" />
                  ) : f.kind === "video" ? (
                    <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border bg-violet-500/10 text-[9px] text-violet-400">
                      <Film className="h-4 w-4" />
                      <span className="max-w-[56px] truncate px-1">{f.file.name}</span>
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border bg-muted text-[9px] text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                      <span className="max-w-[56px] truncate px-1">{f.file.name}</span>
                    </div>
                  )}
                  <button type="button" onClick={() => removeFile(idx)}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => photoRef.current?.click()} disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50">
              <ImageIcon className="h-3 w-3" />
              {photos.length > 0 ? `${photos.length} Photo${photos.length > 1 ? "s" : ""}` : "Photos"}
            </button>
            <button type="button" onClick={() => videoRef.current?.click()} disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-500/20 disabled:opacity-50">
              <Film className="h-3 w-3" />
              {videos.length > 0 ? `${videos.length} Video${videos.length > 1 ? "s" : ""}` : "Videos"}
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-slate-500/30 bg-slate-500/10 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-500/20 disabled:opacity-50">
              <Paperclip className="h-3 w-3" />
              {docs.length > 0 ? `${docs.length} File${docs.length > 1 ? "s" : ""}` : "Files"}
            </button>
            <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" multiple className="sr-only"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={fileRef} type="file" accept="application/pdf" multiple className="sr-only"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>
        </div>

        {/* Save — full width, sticky at bottom */}
        <div className="border-t px-4 pb-6 pt-3 sm:pb-4">
          <Button
            type="button"
            className="w-full gap-2 h-11"
            onClick={handleSubmit}
            disabled={pending || !entry.trim() || !selectedCase}
          >
            {pending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><Plus className="h-4 w-4" /> Save Observation</>
            )}
          </Button>
        </div>
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
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder={tSos("notesPlaceholder")} rows={3} />
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
