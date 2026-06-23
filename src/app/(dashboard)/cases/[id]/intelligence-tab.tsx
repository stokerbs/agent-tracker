import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/constants";
import { decryptField } from "@/lib/security/encryption";
import { TargetProfileCard } from "@/components/intelligence/target-profile-card";
import { TargetPhotosSection } from "@/components/intelligence/target-photos-section";
import { VehiclesSection } from "@/components/intelligence/vehicles-section";
import { LocationsSection } from "@/components/intelligence/locations-section";
import { DocumentsSection } from "@/components/intelligence/documents-section";
import { RelationshipsSection } from "@/components/intelligence/relationships-section";
import type { Evidence, TargetPhoto, TargetVehicle, TargetLocation, VehiclePhoto, TargetRelationship } from "@/lib/types";
import type { SocialMap } from "@/lib/socials";

interface TargetProfile {
  name: string | null;
  alias: string | null;
  phone: string | null;
  gender: string | null;
  age: number | null;
  notes: string | null;
  dob: string | null;
  nationality: string | null;
  occupation: string | null;
  email: string | null;
  socials: SocialMap;
}

interface Props {
  caseId: string;
  staff: boolean;
  targetProfile: TargetProfile;
}

/**
 * Intelligence tab content as an independent async server component.
 *
 * This tab is the heaviest part of the case page — 5 queries plus TWO
 * sequential signed-URL batch round-trips (intelligence bucket for photos,
 * evidence bucket for documents). It is also fully decoupled: no stat card or
 * tab-count in the page shell depends on its data. Rendering it inside a
 * <Suspense> boundary lets the page shell, tab bar, and other tabs paint
 * immediately while this streams in, instead of the signing round-trips
 * blocking first paint.
 */
export async function IntelligenceTab({ caseId, staff, targetProfile }: Props) {
  const supabase = await createClient();

  const [
    { data: targetPhotosRaw },
    { data: targetVehiclesRaw },
    { data: targetLocationsRaw },
    { data: intelDocsRaw },
    { data: vehiclePhotosRaw },
    { data: relationshipsRaw },
  ] = await Promise.all([
    supabase.from("target_photos").select("*").eq("case_id", caseId).order("created_at"),
    supabase.from("target_vehicles").select("*").eq("case_id", caseId).order("created_at"),
    supabase.from("target_locations").select("*").eq("case_id", caseId).order("created_at"),
    supabase.from("evidence").select("*").eq("case_id", caseId).eq("category", "intelligence").order("uploaded_at", { ascending: false }),
    supabase.from("vehicle_photos").select("*").eq("case_id", caseId).order("created_at"),
    supabase.from("target_relationships").select("*").eq("case_id", caseId).order("created_at"),
  ]);

  const relationships = ((relationshipsRaw ?? []) as TargetRelationship[]).map((r) => ({
    id: r.id,
    name: r.name_enc ? decryptField(r.name_enc) : null,
    relation: r.relation,
    notes: r.notes,
  }));

  const rawPhotos = (targetPhotosRaw ?? []) as TargetPhoto[];
  const rawVehicles = (targetVehiclesRaw ?? []) as TargetVehicle[];
  const rawLocations = (targetLocationsRaw ?? []) as TargetLocation[];
  const rawVehiclePhotos = (vehiclePhotosRaw ?? []) as VehiclePhoto[];

  // Sign intelligence-bucket paths (photos + vehicle/location hero shots) in one batch.
  const allIntelPaths = [
    ...rawPhotos.map((p) => p.storage_path),
    ...rawVehicles.filter((v) => v.photo_url).map((v) => v.photo_url as string),
    ...rawLocations.filter((l) => l.photo_url).map((l) => l.photo_url as string),
    ...rawVehiclePhotos.map((p) => p.storage_path),
  ];
  const intelSignedMap: Record<string, string> = {};
  if (allIntelPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKETS.intelligence)
      .createSignedUrls(allIntelPaths, 3600);
    (signed ?? []).forEach((s, i) => { intelSignedMap[allIntelPaths[i]] = s.signedUrl ?? ""; });
  }

  const targetPhotos: TargetPhoto[] = rawPhotos.map((p) => ({
    ...p,
    signedUrl: intelSignedMap[p.storage_path] ?? "",
  }));
  const targetVehicles: TargetVehicle[] = rawVehicles.map((v) => ({
    ...v,
    licensePlate: v.license_plate_enc ? decryptField(v.license_plate_enc) : null,
    photoSignedUrl: v.photo_url ? (intelSignedMap[v.photo_url] ?? null) : null,
  }));
  const targetLocations: TargetLocation[] = rawLocations.map((l) => ({
    ...l,
    address: l.address_enc ? decryptField(l.address_enc) : null,
    photoSignedUrl: l.photo_url ? (intelSignedMap[l.photo_url] ?? null) : null,
  }));
  const vehiclePhotos = rawVehiclePhotos.map((p) => ({
    ...p,
    signedUrl: intelSignedMap[p.storage_path] ?? "",
  }));

  // Intel documents live in the evidence bucket — sign separately.
  const rawIntelDocs = (intelDocsRaw ?? []) as Evidence[];
  const intelDocPaths = rawIntelDocs.map((d) => d.storage_path);
  const intelDocSignedMap: Record<string, string> = {};
  if (intelDocPaths.length > 0) {
    const { data: docSigned } = await supabase.storage
      .from(BUCKETS.evidence)
      .createSignedUrls(intelDocPaths, 3600);
    (docSigned ?? []).forEach((s, i) => { intelDocSignedMap[intelDocPaths[i]] = s.signedUrl ?? ""; });
  }
  const intelDocs = rawIntelDocs.map((d) => ({ ...d, signedUrl: intelDocSignedMap[d.storage_path] ?? "" }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <TargetProfileCard caseId={caseId} data={targetProfile} isStaff={staff} />
        <TargetPhotosSection caseId={caseId} photos={targetPhotos} isStaff={staff} />
      </div>
      <VehiclesSection caseId={caseId} vehicles={targetVehicles} vehiclePhotos={vehiclePhotos} isStaff={staff} />
      <LocationsSection caseId={caseId} locations={targetLocations} isStaff={staff} />
      <RelationshipsSection relationships={relationships} />
      <DocumentsSection caseId={caseId} documents={intelDocs} isStaff={staff} />
    </div>
  );
}

/** Lightweight skeleton shown while the intelligence tab streams in. */
export function IntelligenceTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl border bg-muted/40" />
        <div className="h-48 animate-pulse rounded-xl border bg-muted/40" />
      </div>
      <div className="h-32 animate-pulse rounded-xl border bg-muted/40" />
      <div className="h-32 animate-pulse rounded-xl border bg-muted/40" />
    </div>
  );
}
