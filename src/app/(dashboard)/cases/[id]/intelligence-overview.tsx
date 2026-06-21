import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/constants";
import { decryptField } from "@/lib/security/encryption";
import { IntelligenceOverviewCards } from "./intelligence-overview-cards";
import type { GpsDevice, TargetVehicle } from "@/lib/types";

const GPS_ONLINE_MS = 15 * 60 * 1000;

interface Props {
  caseId: string;
  targetName: string | null;
  gpsDevices: GpsDevice[];
  todayEntryCount: number;
  unreadMessageCount: number;
}

export async function IntelligenceOverview({
  caseId,
  targetName,
  gpsDevices,
  todayEntryCount,
  unreadMessageCount,
}: Props) {
  const supabase = await createClient();

  const [
    { data: rawPhotos },
    { data: rawVehicles },
    { data: rawLocations },
    { data: rawVehiclePhotos },
  ] = await Promise.all([
    supabase.from("target_photos").select("id, storage_path, is_primary").eq("case_id", caseId).order("is_primary", { ascending: false }),
    supabase.from("target_vehicles").select("id, make, model, color, license_plate_enc, is_primary, photo_url").eq("case_id", caseId).order("is_primary", { ascending: false }),
    supabase.from("target_locations").select("id, location_type, location_name, address_enc").eq("case_id", caseId).order("created_at"),
    supabase.from("vehicle_photos").select("id, vehicle_id, storage_path, is_primary").eq("case_id", caseId).order("is_primary", { ascending: false }).order("created_at"),
  ]);

  type RawPhoto = { id: string; storage_path: string; is_primary: boolean };
  type RawVehicle = Pick<TargetVehicle, "id" | "make" | "model" | "color" | "license_plate_enc" | "is_primary"> & { photo_url?: string | null };
  type RawLocation = { id: string; location_type: string; location_name: string | null; address_enc: string | null };
  type RawVehiclePhoto = { id: string; vehicle_id: string; storage_path: string; is_primary: boolean };

  const photos = (rawPhotos ?? []) as RawPhoto[];
  const vehicles = (rawVehicles ?? []) as RawVehicle[];
  const locations = (rawLocations ?? []) as RawLocation[];
  const vehiclePhotoRows = (rawVehiclePhotos ?? []) as RawVehiclePhoto[];

  const primaryVehicle = vehicles.find((v) => v.is_primary) ?? vehicles[0] ?? null;

  // Gather all intelligence-bucket paths to sign in one batch
  const targetPhotoPaths = photos.map((p) => p.storage_path);
  const vehicleHeroPath = (primaryVehicle as RawVehicle)?.photo_url ?? null;
  const primaryVehiclePhotoPaths = vehiclePhotoRows
    .filter((p) => p.vehicle_id === primaryVehicle?.id)
    .map((p) => p.storage_path);

  const allPaths = [
    ...targetPhotoPaths,
    ...(vehicleHeroPath ? [vehicleHeroPath] : []),
    ...primaryVehiclePhotoPaths,
  ];

  const signedMap: Record<string, string> = {};
  if (allPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKETS.intelligence)
      .createSignedUrls(allPaths, 3600);
    (signed ?? []).forEach((s, i) => { signedMap[allPaths[i]] = s.signedUrl ?? ""; });
  }

  // Build target photo gallery (all photos, primary first)
  const targetPhotoGallery = photos
    .map((p) => ({ url: signedMap[p.storage_path] ?? "", alt: "Target photo" }))
    .filter((p) => p.url);

  // Decrypt vehicle plate
  const vehiclePlate = primaryVehicle?.license_plate_enc
    ? decryptField(primaryVehicle.license_plate_enc)
    : null;

  // Build vehicle gallery: gallery photos take priority; fall back to hero url
  const vehicleAlt = [primaryVehicle?.color, primaryVehicle?.make, primaryVehicle?.model].filter(Boolean).join(" ");
  let vehicleGallery: { url: string; alt: string }[] = [];
  if (primaryVehiclePhotoPaths.length > 0) {
    vehicleGallery = primaryVehiclePhotoPaths
      .map((p) => ({ url: signedMap[p] ?? "", alt: vehicleAlt }))
      .filter((p) => p.url);
  }
  if (vehicleGallery.length === 0 && vehicleHeroPath && signedMap[vehicleHeroPath]) {
    vehicleGallery = [{ url: signedMap[vehicleHeroPath], alt: vehicleAlt }];
  }

  const vehicleThumb = vehicleGallery[0]?.url ?? null;

  // Build locations list
  const decryptedLocations = locations.map((l) => ({
    type: l.location_type,
    name: l.location_name ?? (l.address_enc ? decryptField(l.address_enc) : null) ?? "—",
  }));

  // GPS stats
  const now = Date.now();
  const anyOnline = gpsDevices.some(
    (d) => d.last_seen_at && now - new Date(d.last_seen_at).getTime() < GPS_ONLINE_MS,
  );
  const lastGpsSeen =
    gpsDevices
      .filter((d) => d.last_seen_at)
      .sort((a, b) => new Date(b.last_seen_at!).getTime() - new Date(a.last_seen_at!).getTime())[0]
      ?.last_seen_at ?? null;

  return (
    <IntelligenceOverviewCards
      targetName={targetName}
      targetPhotos={targetPhotoGallery}
      primaryVehicle={
        primaryVehicle
          ? {
              make: primaryVehicle.make ?? null,
              model: primaryVehicle.model ?? null,
              color: primaryVehicle.color ?? null,
              licensePlate: vehiclePlate,
              totalCount: vehicles.length,
            }
          : null
      }
      vehicleThumb={vehicleThumb}
      vehicleGallery={vehicleGallery}
      locations={decryptedLocations}
      gpsOnline={anyOnline}
      lastGpsSeen={lastGpsSeen}
      hasGpsDevices={gpsDevices.length > 0}
      todayEntries={todayEntryCount}
      unreadMessages={unreadMessageCount}
    />
  );
}

export function IntelligenceOverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[136px] animate-pulse rounded-xl border border-border/50 bg-muted/20" />
      ))}
    </div>
  );
}
