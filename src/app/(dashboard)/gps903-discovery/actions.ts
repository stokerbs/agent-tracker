"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { getOrRefreshCredentialSession, gps903GetTracking } from "@/lib/gps903";
import type { Gps903Device } from "@/lib/types";

/**
 * Sync all active GPS903 credentials into the gps903_devices catalog.
 * For each credential: login → GetTracking → upsert catalog row with last_seen.
 */
export async function syncGps903Devices(): Promise<{
  ok?: boolean;
  count?: number;
  error?: string;
}> {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { data: credentials, error: credErr } = await svc
    .from("gps903_credentials")
    .select("id, imei, device_password, gps903_device_id, device_name")
    .eq("is_active", true);

  if (credErr) return { error: handleDbError(credErr, "gps903_credentials") };

  if (!credentials?.length) {
    return {
      error:
        "No active GPS903 credentials found. " +
        "Add at least one device in GPS Credentials before syncing.",
    };
  }

  const now = new Date().toISOString();

  const rows = await Promise.all(
    credentials.map(async (cred) => {
      const session = await getOrRefreshCredentialSession(svc, cred);
      let lastSeen: string | null = null;

      if (session) {
        const tracking = await gps903GetTracking(session, cred.gps903_device_id);
        if (tracking?.fixTime) {
          try {
            lastSeen = new Date(tracking.fixTime).toISOString();
          } catch {
            /* keep null */
          }
        }
      }

      return {
        gps903_device_id: cred.gps903_device_id,
        device_name:      cred.device_name,
        imei:             cred.imei,
        model:            null as string | null,
        last_seen:        lastSeen,
        synced_at:        now,
        updated_at:       now,
      };
    }),
  );

  const { error } = await svc
    .from("gps903_devices")
    .upsert(rows, { onConflict: "gps903_device_id" });

  if (error) return { error: handleDbError(error, "gps903_devices") };

  revalidatePath("/gps903-discovery");
  return { ok: true, count: rows.length };
}

export async function importDeviceToCase(
  gps903DeviceId: number,
  caseId: string,
  agentId: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  const profile = await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { data: catalog } = await svc
    .from("gps903_devices")
    .select("imei, device_name")
    .eq("gps903_device_id", gps903DeviceId)
    .maybeSingle();

  if (!catalog) return { error: "Device not found in catalog — run a Sync first" };

  // Prevent duplicate link to the same case
  const { data: existing } = await svc
    .from("gps_devices")
    .select("id")
    .eq("case_id", caseId)
    .eq("gps903_device_id", gps903DeviceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return { error: "This GPS903 device is already linked to this case" };

  const { error } = await svc.from("gps_devices").insert({
    case_id:          caseId,
    imei:             catalog.imei,
    provider:         "GPS903",
    gps903_device_id: gps903DeviceId,
    agent_id:         agentId,
    notes:            catalog.device_name,
    created_by:       profile.id,
  });

  if (error) return { error: handleDbError(error, "gps_devices") };

  revalidatePath("/gps903-discovery");
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/gps-devices");
  return { ok: true };
}

/** Returns the GPS903 device catalog for use in client-side import dialogs. */
export async function getGps903CatalogForImport(): Promise<
  Pick<Gps903Device, "gps903_device_id" | "device_name" | "imei" | "model" | "last_seen">[]
> {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { data } = await svc
    .from("gps903_devices")
    .select("gps903_device_id, device_name, imei, model, last_seen")
    .order("gps903_device_id");

  return (data ?? []) as Pick<
    Gps903Device,
    "gps903_device_id" | "device_name" | "imei" | "model" | "last_seen"
  >[];
}
