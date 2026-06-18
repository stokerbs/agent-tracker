"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { getOrRefreshSession, gps903GetDevicesByUserID } from "@/lib/gps903";
import type { Gps903Device } from "@/lib/types";

export async function syncGps903Devices(): Promise<{
  ok?: boolean;
  count?: number;
  error?: string;
}> {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const session = await getOrRefreshSession(svc);
  if (!session) return { error: "GPS903 login failed — check IMEI credentials" };

  const devices = await gps903GetDevicesByUserID(session);
  if (devices.length === 0)
    return { error: "No devices returned from GPS903 — check IMEI credentials or account has no devices" };

  const now = new Date().toISOString();
  const rows = devices.map((d) => {
    let lastSeen: string | null = null;
    if (d.lastSeen) {
      try { lastSeen = new Date(d.lastSeen).toISOString(); } catch { /* keep null */ }
    }
    return {
      gps903_device_id: d.gps903DeviceId,
      device_name:      d.deviceName,
      imei:             d.imei,
      model:            d.model,
      last_seen:        lastSeen,
      synced_at:        now,
      updated_at:       now,
    };
  });

  const { error } = await svc
    .from("gps903_devices")
    .upsert(rows, { onConflict: "gps903_device_id" });

  if (error) return { error: handleDbError(error, "gps903_devices") };

  revalidatePath("/gps903-discovery");
  return { ok: true, count: devices.length };
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
