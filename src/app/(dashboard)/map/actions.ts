"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
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
  await logAudit({
    actorId: profile.id,
    action: "GEOFENCE_CREATE",
    entity: "geofences",
    entityId: (data as Geofence)?.id ?? null,
    metadata: { name: input.name },
  });
  revalidatePath("/map");
  return { fence: data as Geofence };
}

export async function deleteGeofence(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const actor = await requireRole(["admin"]);
  const svc = createServiceClient();

  const { error } = await svc
    .from("geofences")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  await logAudit({
    actorId: actor.id,
    action: "GEOFENCE_DELETE",
    entity: "geofences",
    entityId: id,
  });
  revalidatePath("/map");
  return { ok: true };
}
