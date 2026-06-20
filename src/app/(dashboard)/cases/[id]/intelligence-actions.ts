"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { BUCKETS } from "@/lib/constants";
import { encryptField, createLicensePlateBlindIndex, normalizeLicensePlate } from "@/lib/security/encryption";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  FileValidationError,
  validateDocumentUpload,
  validateImageUpload,
  validateVideoUpload,
} from "@/lib/security/file-validation";
import type { EvidenceType, LocationType } from "@/lib/types";

function revalidate(caseId: string) {
  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/field/${caseId}`);
}

function detectEvidenceType(mime: string): EvidenceType {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

// ─── Target profile ────────────────────────────────────────────────────────────

export async function updateTargetProfile(caseId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const alias    = (formData.get("target_alias") as string | null)?.trim() || null;
  const gender   = (formData.get("target_gender") as string | null) || null;
  const ageRaw   = formData.get("target_age") as string | null;
  const notes    = (formData.get("target_notes") as string | null)?.trim() || null;

  const update: Record<string, unknown> = {
    target_gender: gender,
    target_age: ageRaw ? parseInt(ageRaw, 10) : null,
    target_alias_enc: alias ? encryptField(alias) : null,
    target_notes_enc: notes ? encryptField(notes) : null,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("cases").update(update).eq("id", caseId);
  if (error) throw new Error(handleDbError(error, "updateTargetProfile"));
  revalidate(caseId);
}

// ─── Target photos ─────────────────────────────────────────────────────────────

export async function uploadTargetPhoto(caseId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");
  validateImageUpload(file);

  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `${caseId}/photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const supabase = await createClient();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKETS.intelligence)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadErr) throw new Error(handleDbError(uploadErr as any, "uploadTargetPhoto"));

  const { error: dbErr } = await supabase.from("target_photos").insert({
    case_id: caseId,
    storage_path: path,
    is_primary: false,
    uploaded_by: profile.id,
  });
  if (dbErr) throw new Error(handleDbError(dbErr, "uploadTargetPhoto.insert"));

  revalidate(caseId);
}

export async function setPrimaryPhoto(photoId: string, caseId: string) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const supabase = await createClient();
  await supabase.from("target_photos").update({ is_primary: false }).eq("case_id", caseId);
  const { error } = await supabase.from("target_photos").update({ is_primary: true }).eq("id", photoId);
  if (error) throw new Error(handleDbError(error, "setPrimaryPhoto"));
  revalidate(caseId);
}

export async function deleteTargetPhoto(photoId: string, caseId: string, storagePath: string) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const supabase = await createClient();
  await supabase.storage.from(BUCKETS.intelligence).remove([storagePath]);
  const { error } = await supabase.from("target_photos").delete().eq("id", photoId);
  if (error) throw new Error(handleDbError(error, "deleteTargetPhoto"));
  revalidate(caseId);
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export async function createVehicle(caseId: string, formData: FormData): Promise<string> {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const plate = (formData.get("license_plate") as string | null)?.trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("target_vehicles").insert({
    case_id: caseId,
    make:  (formData.get("make")  as string | null)?.trim() || null,
    model: (formData.get("model") as string | null)?.trim() || null,
    color: (formData.get("color") as string | null)?.trim() || null,
    license_plate_enc:  plate ? encryptField(plate) : null,
    license_plate_bidx: plate ? createLicensePlateBlindIndex(normalizeLicensePlate(plate)) : null,
    notes: (formData.get("notes") as string | null)?.trim() || null,
    is_primary: formData.get("is_primary") === "true",
    created_by: profile.id,
  }).select("id").single();
  if (error) throw new Error(handleDbError(error, "createVehicle"));
  revalidate(caseId);
  return data.id;
}

export async function updateVehicle(vehicleId: string, caseId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const plate = (formData.get("license_plate") as string | null)?.trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("target_vehicles").update({
    make:  (formData.get("make")  as string | null)?.trim() || null,
    model: (formData.get("model") as string | null)?.trim() || null,
    color: (formData.get("color") as string | null)?.trim() || null,
    license_plate_enc:  plate ? encryptField(plate) : null,
    license_plate_bidx: plate ? createLicensePlateBlindIndex(normalizeLicensePlate(plate)) : null,
    notes: (formData.get("notes") as string | null)?.trim() || null,
    is_primary: formData.get("is_primary") === "true",
  }).eq("id", vehicleId);
  if (error) throw new Error(handleDbError(error, "updateVehicle"));
  revalidate(caseId);
}

export async function uploadVehiclePhoto(vehicleId: string, caseId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");
  validateImageUpload(file);

  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `${caseId}/vehicles/${vehicleId}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const supabase = await createClient();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKETS.intelligence)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (uploadErr) throw new Error(handleDbError(uploadErr as any, "uploadVehiclePhoto"));

  const { error } = await supabase.from("target_vehicles").update({ photo_url: path }).eq("id", vehicleId);
  if (error) throw new Error(handleDbError(error, "uploadVehiclePhoto.update"));
  revalidate(caseId);
}

export async function deleteVehicle(vehicleId: string, caseId: string) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data } = await supabase.from("target_vehicles").select("photo_url").eq("id", vehicleId).single();
  if (data?.photo_url) await supabase.storage.from(BUCKETS.intelligence).remove([data.photo_url]);

  const { error } = await supabase.from("target_vehicles").delete().eq("id", vehicleId);
  if (error) throw new Error(handleDbError(error, "deleteVehicle"));
  revalidate(caseId);
}

// ─── Vehicle photos (gallery) ─────────────────────────────────────────────────

export async function addVehiclePhoto(vehicleId: string, caseId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");
  validateImageUpload(file);

  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `${caseId}/vehicles/${vehicleId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const supabase = await createClient();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKETS.intelligence)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadErr) throw new Error(handleDbError(uploadErr as any, "addVehiclePhoto"));

  // Auto-primary if this is the first photo for this vehicle
  const { count } = await supabase
    .from("vehicle_photos")
    .select("*", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId);
  const isPrimary = (count ?? 0) === 0;

  const { error: dbErr } = await supabase.from("vehicle_photos").insert({
    vehicle_id: vehicleId,
    case_id: caseId,
    storage_path: path,
    is_primary: isPrimary,
    uploaded_by: profile.id,
  });
  if (dbErr) throw new Error(handleDbError(dbErr, "addVehiclePhoto.insert"));

  // Keep target_vehicles.photo_url synced with the primary
  if (isPrimary) {
    await supabase.from("target_vehicles").update({ photo_url: path }).eq("id", vehicleId);
  }

  revalidate(caseId);
}

export async function setPrimaryVehiclePhoto(photoId: string, vehicleId: string, caseId: string, storagePath: string) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const supabase = await createClient();
  await supabase.from("vehicle_photos").update({ is_primary: false }).eq("vehicle_id", vehicleId);
  const { error } = await supabase.from("vehicle_photos").update({ is_primary: true }).eq("id", photoId);
  if (error) throw new Error(handleDbError(error, "setPrimaryVehiclePhoto"));

  // Sync the denormalized photo_url
  await supabase.from("target_vehicles").update({ photo_url: storagePath }).eq("id", vehicleId);

  revalidate(caseId);
}

export async function deleteVehiclePhoto(photoId: string, vehicleId: string, caseId: string, storagePath: string) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("vehicle_photos")
    .select("is_primary")
    .eq("id", photoId)
    .maybeSingle();

  await supabase.storage.from(BUCKETS.intelligence).remove([storagePath]);
  const { error } = await supabase.from("vehicle_photos").delete().eq("id", photoId);
  if (error) throw new Error(handleDbError(error, "deleteVehiclePhoto"));

  // If deleted photo was primary, promote the next oldest
  if (photo?.is_primary) {
    const { data: next } = await supabase
      .from("vehicle_photos")
      .select("id, storage_path")
      .eq("vehicle_id", vehicleId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase.from("vehicle_photos").update({ is_primary: true }).eq("id", next.id);
      await supabase.from("target_vehicles").update({ photo_url: next.storage_path }).eq("id", vehicleId);
    } else {
      await supabase.from("target_vehicles").update({ photo_url: null }).eq("id", vehicleId);
    }
  }

  revalidate(caseId);
}

// ─── Locations ────────────────────────────────────────────────────────────────

function parseGoogleMapsCoords(url: string): { lat: number; lng: number } | null {
  const atMatch = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  return null;
}

export async function resolveGoogleMapsUrl(
  url: string,
): Promise<{ lat: number | null; lng: number | null }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const coords = parseGoogleMapsCoords(res.url);
    return { lat: coords?.lat ?? null, lng: coords?.lng ?? null };
  } catch {
    return { lat: null, lng: null };
  }
}

export async function createLocation(caseId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const latRaw = formData.get("lat") as string | null;
  const lngRaw = formData.get("lng") as string | null;
  const mapsUrl = (formData.get("maps_url") as string | null)?.trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("target_locations").insert({
    case_id: caseId,
    location_type: (formData.get("location_type") as LocationType) ?? "other",
    location_name: (formData.get("location_name") as string | null)?.trim() || null,
    maps_url: mapsUrl,
    lat: latRaw ? parseFloat(latRaw) : null,
    lng: lngRaw ? parseFloat(lngRaw) : null,
    notes: (formData.get("notes") as string | null)?.trim() || null,
    created_by: profile.id,
  });
  if (error) throw new Error(handleDbError(error, "createLocation"));
  revalidate(caseId);
}

export async function updateLocation(locationId: string, caseId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const latRaw = formData.get("lat") as string | null;
  const lngRaw = formData.get("lng") as string | null;
  const mapsUrl = (formData.get("maps_url") as string | null)?.trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("target_locations").update({
    location_type: (formData.get("location_type") as LocationType) ?? "other",
    location_name: (formData.get("location_name") as string | null)?.trim() || null,
    maps_url: mapsUrl,
    lat: latRaw ? parseFloat(latRaw) : null,
    lng: lngRaw ? parseFloat(lngRaw) : null,
    notes: (formData.get("notes") as string | null)?.trim() || null,
  }).eq("id", locationId);
  if (error) throw new Error(handleDbError(error, "updateLocation"));
  revalidate(caseId);
}

export async function deleteLocation(locationId: string, caseId: string) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data } = await supabase.from("target_locations").select("photo_url").eq("id", locationId).single();
  if (data?.photo_url) await supabase.storage.from(BUCKETS.intelligence).remove([data.photo_url]);

  const { error } = await supabase.from("target_locations").delete().eq("id", locationId);
  if (error) throw new Error(handleDbError(error, "deleteLocation"));
  revalidate(caseId);
}

// ─── Intelligence documents ───────────────────────────────────────────────────
// Stored in the evidence table with category = 'intelligence'.
// Uses the evidence bucket (private, existing RLS: staff full, assigned agents read).

export async function uploadIntelDocument(caseId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");

  try {
    if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      await validateImageUpload(file);
    } else if ((ALLOWED_VIDEO_TYPES as readonly string[]).includes(file.type)) {
      await validateVideoUpload(file);
    } else {
      await validateDocumentUpload(file);
    }
  } catch (err) {
    if (err instanceof FileValidationError) throw new Error(err.message);
    throw err;
  }

  const ext  = file.name.split(".").pop() ?? "bin";
  const path = `${caseId}/${crypto.randomUUID()}.${ext}`;

  const supabase = await createClient();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKETS.evidence)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) throw new Error(handleDbError(uploadErr as any, "uploadIntelDocument:storage"));

  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const { error } = await supabase.from("evidence").insert({
    case_id: caseId,
    type: detectEvidenceType(file.type),
    category: "intelligence",
    storage_path: path,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
    notes,
    uploaded_by: profile.id,
  });
  if (error) throw new Error(handleDbError(error, "uploadIntelDocument:insert"));
  revalidate(caseId);
}

export async function deleteIntelDocument(evidenceId: string, caseId: string, storagePath: string) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) throw new Error("Unauthorized");

  const supabase = await createClient();
  await supabase.storage.from(BUCKETS.evidence).remove([storagePath]);
  const { error } = await supabase.from("evidence").delete().eq("id", evidenceId);
  if (error) throw new Error(handleDbError(error, "deleteIntelDocument"));
  revalidate(caseId);
}
