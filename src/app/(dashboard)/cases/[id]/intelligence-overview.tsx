import { User, Car, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/constants";
import { decryptField } from "@/lib/security/encryption";
import { cn, timeAgo } from "@/lib/utils";
import type { GpsDevice, TargetPhoto, TargetVehicle, TargetLocation, TimelineEntry } from "@/lib/types";

const GPS_ONLINE_MS = 15 * 60 * 1000;

type RawEntry = TimelineEntry & { agents?: { full_name: string; nickname?: string | null } | null };

interface Props {
  caseId: string;
  targetName: string | null;
  gpsDevices: GpsDevice[];
  timelineEntries: RawEntry[];
}

export async function IntelligenceOverview({ caseId, targetName, gpsDevices, timelineEntries }: Props) {
  const t = await getTranslations("cases.detail.intel");
  const supabase = await createClient();

  const [{ data: rawPhotos }, { data: rawVehicles }, { data: rawLocations }] = await Promise.all([
    supabase.from("target_photos").select("id, storage_path, is_primary").eq("case_id", caseId).order("is_primary", { ascending: false }),
    supabase.from("target_vehicles").select("id, make, model, color, license_plate_enc, is_primary").eq("case_id", caseId).order("is_primary", { ascending: false }),
    supabase.from("target_locations").select("id, location_type, location_name, label, address_enc").eq("case_id", caseId).order("created_at"),
  ]);

  const photos = (rawPhotos ?? []) as Pick<TargetPhoto, "id" | "storage_path" | "is_primary">[];
  const vehicles = (rawVehicles ?? []) as Pick<TargetVehicle, "id" | "make" | "model" | "color" | "license_plate_enc" | "is_primary">[];
  const locations = (rawLocations ?? []) as Pick<TargetLocation, "id" | "location_type" | "location_name" | "label" | "address_enc">[];

  // Sign one photo URL
  const primaryPhoto = photos.find((p) => p.is_primary) ?? photos[0] ?? null;
  let primaryPhotoUrl: string | null = null;
  if (primaryPhoto) {
    const { data: signed } = await supabase.storage
      .from(BUCKETS.intelligence)
      .createSignedUrl(primaryPhoto.storage_path, 3600);
    primaryPhotoUrl = signed?.signedUrl ?? null;
  }

  // Decrypt primary vehicle plate
  const primaryVehicle = vehicles.find((v) => v.is_primary) ?? vehicles[0] ?? null;
  const vehiclePlate = primaryVehicle?.license_plate_enc
    ? decryptField(primaryVehicle.license_plate_enc)
    : null;

  // Decrypt location addresses
  const decryptedLocations = locations.map((l) => ({
    ...l,
    address: l.address_enc ? decryptField(l.address_enc) : null,
  }));

  // Last known location (same logic as ops-dashboard)
  const latestLocationEntry = timelineEntries.find((e) => e.location);
  const latestGpsDevice = gpsDevices
    .filter((d) => d.last_lat !== null && d.last_position_time !== null)
    .sort((a, b) => new Date(b.last_position_time!).getTime() - new Date(a.last_position_time!).getTime())[0] ?? null;

  const gpsMs = latestGpsDevice ? new Date(latestGpsDevice.last_position_time!).getTime() : 0;
  const tlMs = latestLocationEntry
    ? new Date(`${latestLocationEntry.entry_date}T${latestLocationEntry.entry_time}`).getTime()
    : 0;

  let locationText: string | null = null;
  let locationTime: Date | null = null;

  if (gpsMs > 0 || tlMs > 0) {
    locationText = latestLocationEntry?.location ?? null;
    locationTime = new Date(Math.max(gpsMs, tlMs));
  }

  const now = Date.now();
  const anyOnline = gpsDevices.some(
    (d) => d.last_seen_at && now - new Date(d.last_seen_at).getTime() < GPS_ONLINE_MS,
  );

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* ── Card 1: Target ───────────────────────────────────────────── */}
      <DossierCard label={t("target")} icon={<User className="h-3.5 w-3.5" />} accent="cyan">
        <div className="flex items-center gap-3">
          {primaryPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryPhotoUrl}
              alt="Target"
              className="h-14 w-14 shrink-0 rounded-lg border border-border/50 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-muted">
              <User className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{targetName ?? "—"}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {photos.length > 0 ? t("nPhotos", { count: photos.length }) : t("noPhotos")}
            </p>
          </div>
        </div>
      </DossierCard>

      {/* ── Card 2: Vehicle ──────────────────────────────────────────── */}
      <DossierCard label={t("vehicle")} icon={<Car className="h-3.5 w-3.5" />} accent="amber">
        {primaryVehicle ? (
          <>
            <p className="text-sm font-semibold leading-tight">
              {[primaryVehicle.color, primaryVehicle.make, primaryVehicle.model]
                .filter(Boolean)
                .join(" ") || "—"}
            </p>
            {vehiclePlate && (
              <p className="mt-1 font-mono text-xs tracking-wider text-muted-foreground">
                {vehiclePlate}
              </p>
            )}
            {vehicles.length > 1 && (
              <p className="mt-1 text-[10px] text-muted-foreground/60">
                {t("nMoreVehicles", { n: vehicles.length - 1 })}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noVehicle")}</p>
        )}
      </DossierCard>

      {/* ── Card 3: Locations ────────────────────────────────────────── */}
      <DossierCard label={t("locations")} icon={<MapPin className="h-3.5 w-3.5" />} accent="muted">
        {decryptedLocations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noLocations")}</p>
        ) : (
          <div className="space-y-1.5">
            {decryptedLocations.slice(0, 3).map((l) => (
              <div key={l.id}>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {l.location_type}
                </p>
                <p className="text-xs font-medium leading-tight">
                  {l.location_name ?? l.address ?? "—"}
                </p>
              </div>
            ))}
            {decryptedLocations.length > 3 && (
              <p className="text-[10px] text-muted-foreground/50">
                +{decryptedLocations.length - 3} more
              </p>
            )}
          </div>
        )}
      </DossierCard>

      {/* ── Card 4: Last Known Location ──────────────────────────────── */}
      <DossierCard label={t("lastKnown")} icon={<MapPin className="h-3.5 w-3.5" />} accent="green">
        {locationText ? (
          <>
            <p className="text-sm font-semibold leading-tight">{locationText}</p>
            {locationTime && (
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {locationTime.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Bangkok",
                })}{" "}
                hrs · {timeAgo(locationTime)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("lastKnown")}</p>
        )}
        {gpsDevices.length > 0 && (
          <span
            className={cn(
              "mt-auto inline-flex items-center gap-1.5 text-[10px] font-semibold",
              anyOnline ? "text-emerald-400" : "text-amber-500",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                anyOnline ? "bg-emerald-400 shadow-[0_0_4px_#34d399]" : "bg-amber-500",
              )}
            />
            {anyOnline ? t("gpsOnline") : t("gpsOffline")}
          </span>
        )}
      </DossierCard>
    </div>
  );
}

export function IntelligenceOverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[120px] animate-pulse rounded-xl border border-border/50 bg-muted/20" />
      ))}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

type Accent = "cyan" | "green" | "amber" | "muted";

const BORDER: Record<Accent, string> = {
  cyan:  "border-cyan-500/25",
  green: "border-emerald-500/25",
  amber: "border-amber-500/25",
  muted: "border-border/50",
};

const ICON_COL: Record<Accent, string> = {
  cyan:  "text-cyan-400",
  green: "text-emerald-400",
  amber: "text-amber-500",
  muted: "text-muted-foreground",
};

function DossierCard({
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
    <div className={cn("flex min-h-[120px] flex-col gap-2.5 rounded-xl border bg-card p-3.5", BORDER[accent])}>
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
