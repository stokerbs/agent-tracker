import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/constants";
import { decryptField } from "@/lib/security/encryption";
import { Button } from "@/components/ui/button";
import { FieldIntelClient } from "@/components/field/field-intel-client";
import type { TargetPhoto, TargetVehicle, TargetLocation } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("cases").select("case_number").eq("id", id).single();
  return { title: data ? `Intel · ${data.case_number}` : "Intelligence" };
}

export default async function FieldIntelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const t = await getTranslations("field.intel");
  const supabase = await createClient();

  // Verify the current user (as an agent) is assigned to this case
  const { data: caseRaw } = await supabase
    .from("cases")
    .select("id, case_number, case_type, client_name, target_name_enc, target_phone_enc, target_alias_enc, target_gender, target_age, target_notes_enc")
    .eq("id", id)
    .single();

  if (!caseRaw) notFound();

  const [
    { data: targetPhotosRaw },
    { data: targetVehiclesRaw },
    { data: targetLocationsRaw },
  ] = await Promise.all([
    supabase.from("target_photos").select("*").eq("case_id", id).order("created_at"),
    supabase.from("target_vehicles").select("*").eq("case_id", id).order("created_at"),
    supabase.from("target_locations").select("*").eq("case_id", id).order("created_at"),
  ]);

  const allPaths = [
    ...((targetPhotosRaw ?? []) as TargetPhoto[]).map((p) => p.storage_path),
    ...((targetVehiclesRaw ?? []) as TargetVehicle[]).filter((v) => v.photo_url).map((v) => v.photo_url as string),
  ];
  const signedMap: Record<string, string> = {};
  if (allPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKETS.intelligence)
      .createSignedUrls(allPaths, 3600);
    (signed ?? []).forEach((s, i) => { signedMap[allPaths[i]] = s.signedUrl ?? ""; });
  }

  const photos: TargetPhoto[] = ((targetPhotosRaw ?? []) as TargetPhoto[]).map((p) => ({
    ...p,
    signedUrl: signedMap[p.storage_path] ?? "",
  }));
  const vehicles: TargetVehicle[] = ((targetVehiclesRaw ?? []) as TargetVehicle[]).map((v) => ({
    ...v,
    licensePlate: v.license_plate_enc ? decryptField(v.license_plate_enc) : null,
    photoSignedUrl: v.photo_url ? (signedMap[v.photo_url] ?? null) : null,
  }));
  const locations: TargetLocation[] = ((targetLocationsRaw ?? []) as TargetLocation[]).map((l) => ({
    ...l,
    address: l.address_enc ? decryptField(l.address_enc) : null,
  }));

  const c = caseRaw as any;
  const profileData = {
    name:   c.target_name_enc   ? decryptField(c.target_name_enc)   : null,
    alias:  c.target_alias_enc  ? decryptField(c.target_alias_enc)  : null,
    phone:  c.target_phone_enc  ? decryptField(c.target_phone_enc)  : null,
    gender: c.target_gender     ?? null,
    age:    c.target_age        ?? null,
    notes:  c.target_notes_enc  ? decryptField(c.target_notes_enc)  : null,
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/field">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <p className="font-mono text-sm font-bold text-primary">{c.case_number}</p>
          <p className="text-xs text-muted-foreground">{t("title")}</p>
        </div>
      </div>

      <FieldIntelClient
        caseId={id}
        profile={profileData}
        photos={photos}
        vehicles={vehicles}
        locations={locations}
      />
    </div>
  );
}
