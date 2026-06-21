"use client";

import { MapPin, Radio, User, Car } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ImageLightbox, type LightboxImage } from "@/components/shared/image-lightbox";
import { cn, timeAgo } from "@/lib/utils";

export interface OverviewVehicle {
  make: string | null;
  model: string | null;
  color: string | null;
  licensePlate: string | null;
  totalCount: number;
}

export interface OverviewLocation {
  type: string;
  name: string;
}

interface Props {
  targetName: string | null;
  targetPhotos: LightboxImage[];
  primaryVehicle: OverviewVehicle | null;
  vehicleThumb: string | null;
  vehicleGallery: LightboxImage[];
  locations: OverviewLocation[];
  gpsOnline: boolean;
  lastGpsSeen: string | null;
  hasGpsDevices: boolean;
  todayEntries: number;
  unreadMessages: number;
}

type Accent = "cyan" | "amber" | "muted" | "green";

const BORDER: Record<Accent, string> = {
  cyan:  "border-cyan-500/25",
  amber: "border-amber-500/25",
  muted: "border-border/50",
  green: "border-emerald-500/25",
};

const ICON_COL: Record<Accent, string> = {
  cyan:  "text-cyan-400",
  amber: "text-amber-500",
  muted: "text-muted-foreground",
  green: "text-emerald-400",
};

function DossierCard({
  icon,
  label,
  accent,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  accent: Accent;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[136px] flex-col gap-2.5 rounded-xl border bg-card p-3",
        BORDER[accent],
        onClick && "cursor-pointer active:opacity-80",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className={cn("flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest", ICON_COL[accent])}>
        {icon}
        {label}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {children}
      </div>
    </div>
  );
}

function openSection(section: string) {
  document.dispatchEvent(new CustomEvent("case:openSection", { detail: { section } }));
}

export function IntelligenceOverviewCards({
  targetName,
  targetPhotos,
  primaryVehicle,
  vehicleThumb,
  vehicleGallery,
  locations,
  gpsOnline,
  lastGpsSeen,
  hasGpsDevices,
  todayEntries,
  unreadMessages,
}: Props) {
  const t = useTranslations("cases.detail.intel");
  const [targetLightbox, setTargetLightbox] = useState<number | null>(null);
  const [vehicleLightbox, setVehicleLightbox] = useState<number | null>(null);

  const primaryThumb = targetPhotos[0]?.url ?? null;
  const vehicleLabel = [primaryVehicle?.color, primaryVehicle?.make, primaryVehicle?.model]
    .filter(Boolean).join(" ") || null;

  // Home/work locations shown first, then others
  const HOME_FIRST = ["home", "residence", "บ้าน"];
  const WORK_FIRST = ["work", "office", "workplace", "ที่ทำงาน"];
  const sortedLocations = [...locations].sort((a, b) => {
    const aHome = HOME_FIRST.includes(a.type.toLowerCase());
    const aWork = WORK_FIRST.includes(a.type.toLowerCase());
    const bHome = HOME_FIRST.includes(b.type.toLowerCase());
    const bWork = WORK_FIRST.includes(b.type.toLowerCase());
    if (aHome && !bHome) return -1;
    if (bHome && !aHome) return 1;
    if (aWork && !bWork) return -1;
    if (bWork && !aWork) return 1;
    return 0;
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* ── Card 1: Target ─────────────────────────────────────────── */}
        <DossierCard
          label={t("target")}
          icon={<User className="h-3.5 w-3.5" />}
          accent="cyan"
          onClick={() => openSection("intelligence")}
        >
          <div className="flex items-start gap-2.5">
            {/* Photo — tap opens lightbox directly */}
            <button
              type="button"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (targetPhotos.length > 0) setTargetLightbox(0);
              }}
              aria-label="View target photos"
            >
              {primaryThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={primaryThumb}
                  alt="Target"
                  className="h-16 w-16 rounded-lg border border-border/40 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border/30 bg-muted/30">
                  <User className="h-7 w-7 text-muted-foreground/25" />
                </div>
              )}
            </button>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-sm font-semibold leading-tight">{targetName ?? "—"}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {targetPhotos.length > 0 ? t("nPhotos", { count: targetPhotos.length }) : t("noPhotos")}
              </p>
            </div>
          </div>
        </DossierCard>

        {/* ── Card 2: Vehicle ────────────────────────────────────────── */}
        <DossierCard
          label={t("vehicle")}
          icon={<Car className="h-3.5 w-3.5" />}
          accent="amber"
          onClick={() => openSection("intelligence")}
        >
          {primaryVehicle ? (
            <div className="flex items-start gap-2.5">
              {/* Vehicle photo — tap opens lightbox */}
              <button
                type="button"
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (vehicleGallery.length > 0) setVehicleLightbox(0);
                }}
                aria-label="View vehicle photos"
                disabled={vehicleGallery.length === 0}
              >
                {vehicleThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={vehicleThumb}
                    alt="Vehicle"
                    className="h-16 w-16 rounded-lg border border-border/40 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border/30 bg-muted/30">
                    <Car className="h-7 w-7 text-muted-foreground/25" />
                  </div>
                )}
              </button>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-sm font-semibold leading-tight">{vehicleLabel ?? "—"}</p>
                {primaryVehicle.licensePlate && (
                  <p className="mt-1 font-mono text-[11px] tracking-wider text-primary">
                    {primaryVehicle.licensePlate}
                  </p>
                )}
                {primaryVehicle.totalCount > 1 && (
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    {t("nVehicles", { count: primaryVehicle.totalCount })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noVehicle")}</p>
          )}
        </DossierCard>

        {/* ── Card 3: Locations ──────────────────────────────────────── */}
        <DossierCard
          label={t("locations")}
          icon={<MapPin className="h-3.5 w-3.5" />}
          accent="muted"
          onClick={() => openSection("intelligence")}
        >
          {sortedLocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noLocations")}</p>
          ) : (
            <div className="space-y-1.5">
              {sortedLocations.slice(0, 3).map((l, i) => (
                <div key={i}>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    {l.type}
                  </p>
                  <p className="text-xs font-medium leading-tight">{l.name}</p>
                </div>
              ))}
              {sortedLocations.length > 3 && (
                <p className="text-[10px] text-muted-foreground/50">
                  +{sortedLocations.length - 3} {t("nLocations", { count: 0 }).replace("0 ", "")}
                </p>
              )}
            </div>
          )}
        </DossierCard>

        {/* ── Card 4: Operational Status ─────────────────────────────── */}
        <DossierCard
          label={t("opsStatus")}
          icon={<Radio className="h-3.5 w-3.5" />}
          accent="green"
          onClick={hasGpsDevices ? () => openSection("gps") : undefined}
        >
          <div className="space-y-1.5">
            {/* GPS status */}
            {hasGpsDevices ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px] font-semibold",
                  gpsOnline ? "text-emerald-400" : "text-amber-500",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    gpsOnline
                      ? "bg-emerald-400 shadow-[0_0_4px_#34d399]"
                      : "bg-amber-500",
                  )}
                />
                {gpsOnline ? t("gpsOnline") : t("gpsOffline")}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">{t("noLocations")}</span>
            )}

            {/* Last GPS update */}
            {lastGpsSeen && (
              <p className="font-mono text-[10px] text-muted-foreground">
                {t("lastSeenGps", { time: timeAgo(new Date(lastGpsSeen)) })}
              </p>
            )}

            {/* Today's entries */}
            <p className={cn("text-[11px] font-medium", todayEntries > 0 ? "text-foreground" : "text-muted-foreground")}>
              {todayEntries > 0 ? t("todayEntries", { count: todayEntries }) : t("noEntries")}
            </p>

            {/* Unread messages */}
            {unreadMessages > 0 && (
              <p className="text-[11px] font-semibold text-primary">
                {t("unreadMsgs", { count: unreadMessages })}
              </p>
            )}
          </div>
        </DossierCard>
      </div>

      {/* Lightboxes */}
      {targetLightbox !== null && targetPhotos.length > 0 && (
        <ImageLightbox
          images={targetPhotos}
          initialIndex={targetLightbox}
          onClose={() => setTargetLightbox(null)}
        />
      )}
      {vehicleLightbox !== null && vehicleGallery.length > 0 && (
        <ImageLightbox
          images={vehicleGallery}
          initialIndex={vehicleLightbox}
          onClose={() => setVehicleLightbox(null)}
        />
      )}
    </>
  );
}
