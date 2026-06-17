"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { Geofence } from "@/lib/types";

interface CreateGeofenceInput {
  name: string;
  description: string | null;
  color: string;
  coordinates: Array<{ lat: number; lng: number }>;
}

export async function createGeofence(
  input: CreateGeofenceInput,
): Promise<{ fence?: Geofence; error?: string }> {
  const profile = await requireRole(["admin"]);
  const svc = createServiceClient();

  const { data, error } = await svc
    .from("geofences")
    .insert({
      name: input.name,
      description: input.description,
      color: input.color,
      coordinates: input.coordinates,
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/map");
  return { fence: data as Geofence };
}

export async function deleteGeofence(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  await requireRole(["admin"]);
  const svc = createServiceClient();

  const { error } = await svc
    .from("geofences")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/map");
  return { ok: true };
}
