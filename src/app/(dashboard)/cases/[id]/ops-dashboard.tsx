import { Camera, CalendarDays, Clock, Film, MapPin, MessageSquare, Paperclip, Satellite } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn, timeAgo } from "@/lib/utils";
import type { CaseMessageWithSender, Evidence, GpsDevice, LinkedEvidence, TimelineEntry } from "@/lib/types";

const GPS_ONLINE_MS = 15 * 60 * 1000; // 15 min

type RawEntry = TimelineEntry & { agents?: { full_name: string; nickname?: string | null } | null };

interface Props {
  gpsDevices: GpsDevice[];
  timelineEntries: RawEntry[];
  caseEvidence: Evidence[];
  caseMessages: CaseMessageWithSender[];
  unreadMessageCount: number;
  assignedAgentsCount: number;
  todayBKK: string;
  latestEntryEvidence: LinkedEvidence[];
}

export async function CaseOpsDashboard({
  gpsDevices,
  timelineEntries,
  caseEvidence,
  caseMessages,
  unreadMessageCount,
  assignedAgentsCount,
  todayBKK,
  latestEntryEvidence,
}: Props) {
  const t = await getTranslations("cases.detail.ops");
  const now = Date.now();

  // ── Card 1: Last Known Location ──────────────────────────────────────
  const latestLocationEntry = timelineEntries.find((e) => e.location);
  const latestGpsDevice = gpsDevices
    .filter((d) => d.last_lat !== null && d.last_position_time !== null)
    .sort((a, b) => new Date(b.last_position_time!).getTime() - new Date(a.last_position_time!).getTime())[0] ?? null;

  const gpsMs = latestGpsDevice ? new Date(latestGpsDevice.last_position_time!).getTime() : 0;
  const tlMs = latestLocationEntry
    ? new Date(`${latestLocationEntry.entry_date}T${latestLocationEntry.entry_time}`).getTime()
    : 0;

  let locationSource: "gps" | "timeline" | null = null;
  let locationText: string | null = null;
  let locationTime: Date | null = null;

  if (gpsMs > 0 || tlMs > 0) {
    if (gpsMs >= tlMs) {
      locationSource = "gps";
      locationText = latestLocationEntry?.location ?? null;
      locationTime = new Date(gpsMs);
    } else {
      locationSource = "timeline";
      locationText = latestLocationEntry!.location;
      locationTime = new Date(tlMs);
    }
  }

  // ── Card 2: GPS Status ───────────────────────────────────────────────
  const onlineCount = gpsDevices.filter(
    (d) => d.last_seen_at && now - new Date(d.last_seen_at).getTime() < GPS_ONLINE_MS,
  ).length;
  const latestGpsSeen = gpsDevices
    .filter((d) => d.last_seen_at)
    .sort((a, b) => new Date(b.last_seen_at!).getTime() - new Date(a.last_seen_at!).getTime())[0]
    ?.last_seen_at ?? null;

  // ── Card 3: Today's Activity ─────────────────────────────────────────
  const todayTimeline = timelineEntries.filter((e) => e.entry_date === todayBKK).length;
  const todayEvidence = caseEvidence.filter(
    (e) => new Date(e.uploaded_at).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) === todayBKK,
  ).length;

  // ── Card 4: Communications ───────────────────────────────────────────
  const lastMessage = caseMessages.length > 0 ? caseMessages[caseMessages.length - 1] : null;

  // ── Latest Observation ───────────────────────────────────────────────
  const latestEntry = timelineEntries[0] ?? null;
  const latestPhotos = latestEntryEvidence.filter((e) => e.type === "photo").length;
  const latestVideos = latestEntryEvidence.filter((e) => e.type === "video").length;
  const latestFiles  = latestEntryEvidence.filter((e) => e.type === "document").length;

  // GPS accent: green if any online, amber if devices exist but all offline, muted if none
  const gpsAccent = gpsDevices.length === 0 ? "muted" : onlineCount > 0 ? "green" : "amber";

  return (
    <div className="space-y-3">
      {/* ── 4 Ops Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

        {/* Card 1 — Last Known Location */}
        <OpsCard icon={<MapPin className="h-3.5 w-3.5" />} label={t("lastLocation")} accent="cyan">
          {locationText ? (
            <p className="text-base font-semibold leading-snug">{locationText}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noLocation")}</p>
          )}
          {locationTime && (
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
              {timeAgo(locationTime)}
            </p>
          )}
          {locationSource && (
            <span
              className={cn(
                "mt-auto inline-flex w-fit rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                locationSource === "gps"
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                  : "border-border/50 bg-muted/40 text-muted-foreground",
              )}
            >
              {locationSource === "gps" ? t("sourceGps") : t("sourceTimeline")}
            </span>
          )}
        </OpsCard>

        {/* Card 2 — GPS Status */}
        <OpsCard icon={<Satellite className="h-3.5 w-3.5" />} label={t("gpsStatus")} accent={gpsAccent}>
          {gpsDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noGps")}</p>
          ) : (
            <>
              <p className="text-base font-semibold font-mono leading-snug">
                {t("gpsOnline", { online: onlineCount, total: gpsDevices.length })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {latestGpsSeen ? t("updatedAgo", { time: timeAgo(latestGpsSeen) }) : "—"}
              </p>
            </>
          )}
        </OpsCard>

        {/* Card 3 — Today's Activity */}
        <OpsCard icon={<CalendarDays className="h-3.5 w-3.5" />} label={t("todayActivity")} accent={todayTimeline > 0 ? "primary" : "muted"}>
          {todayTimeline === 0 && todayEvidence === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noActivityToday")}</p>
          ) : (
            <>
              <p className="text-base font-semibold font-mono leading-snug">
                {t("timelineEntries", { count: todayTimeline })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t("evidenceFiles", { count: todayEvidence })}
              </p>
            </>
          )}
        </OpsCard>

        {/* Card 4 — Communications */}
        <OpsCard
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label={t("communications")}
          accent={unreadMessageCount > 0 ? "primary" : "muted"}
        >
          <p className={cn("text-base font-semibold font-mono leading-snug", unreadMessageCount > 0 && "text-primary")}>
            {unreadMessageCount > 0 ? t("unreadMessages", { count: unreadMessageCount }) : t("noUnread")}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t("assignedAgents", { count: assignedAgentsCount })}
          </p>
          {lastMessage && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {t("lastMessage", { time: timeAgo(lastMessage.created_at) })}
            </p>
          )}
        </OpsCard>
      </div>

      {/* ── Latest Observation ──────────────────────────────────────── */}
      {latestEntry ? (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              {t("latestObservation")}
            </span>
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              {latestEntry.entry_time.slice(0, 5)} · {latestEntry.entry_date}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-foreground/90 line-clamp-3">
            {latestEntry.entry}
          </p>

          {latestEntryEvidence.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-primary/10 pt-2">
              {latestPhotos > 0 && (
                <span className="flex items-center gap-1 text-xs text-blue-400">
                  <Camera className="h-3 w-3" />
                  {t("photosAttached", { count: latestPhotos })}
                </span>
              )}
              {latestVideos > 0 && (
                <span className="flex items-center gap-1 text-xs text-violet-400">
                  <Film className="h-3 w-3" />
                  {t("videosAttached", { count: latestVideos })}
                </span>
              )}
              {latestFiles > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="h-3 w-3" />
                  {t("filesAttached", { count: latestFiles })}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/50 px-4 py-3">
          <p className="text-sm text-muted-foreground">{t("noObservation")}</p>
        </div>
      )}
    </div>
  );
}

// ── Internal sub-components ──────────────────────────────────────────────────

type Accent = "cyan" | "green" | "amber" | "primary" | "muted";

const BORDER: Record<Accent, string> = {
  cyan:    "border-cyan-500/30",
  green:   "border-emerald-500/30",
  amber:   "border-amber-500/30",
  primary: "border-primary/30",
  muted:   "border-border/50",
};

const ICON_COLOR: Record<Accent, string> = {
  cyan:    "text-cyan-400",
  green:   "text-emerald-400",
  amber:   "text-amber-500",
  primary: "text-primary",
  muted:   "text-muted-foreground",
};

function OpsCard({
  icon,
  label,
  accent,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  accent: Accent;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-h-[112px] flex-col gap-2 rounded-xl border bg-card p-3.5", BORDER[accent])}>
      <div className={cn("flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest", ICON_COLOR[accent])}>
        {icon}
        {label}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-1">
        {children}
      </div>
    </div>
  );
}
