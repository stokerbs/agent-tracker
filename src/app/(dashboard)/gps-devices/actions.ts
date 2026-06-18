"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { getOrRefreshCredentialSession, gps903GetTracking, applyPositionToDevice } from "@/lib/gps903";

/** Trigger an immediate GPS903 poll for a single device. */
export async function pollDeviceNow(deviceId: string) {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { data: device } = await svc
    .from("gps_devices")
    .select("gps903_device_id")
    .eq("id", deviceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!device?.gps903_device_id) return { error: "Device has no GPS903 Device ID configured" };

  // Look up active credential by gps903_device_id
  const { data: credential } = await svc
    .from("gps903_credentials")
    .select("id, imei, device_password, gps903_device_id")
    .eq("gps903_device_id", device.gps903_device_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!credential) {
    return {
      error:
        "No active GPS903 credential found for this device. " +
        "Add credentials in GPS Credentials.",
    };
  }

  const session = await getOrRefreshCredentialSession(svc, credential);
  if (!session) {
    await svc.from("gps_devices").update({
      last_polled_at: new Date().toISOString(),
      last_poll_ok:   false,
    }).eq("id", deviceId);
    return { error: "GPS903 login failed — check device credentials in GPS Credentials" };
  }

  const pos = await gps903GetTracking(session, credential.gps903_device_id);

  if (!pos) {
    await svc.from("gps_devices").update({
      last_polled_at:   new Date().toISOString(),
      last_poll_ok:     false,
      last_locate_mode: "offline",
    }).eq("id", deviceId);
    return { error: "GPS903 returned no position for this device" };
  }

  await applyPositionToDevice(svc, deviceId, pos);

  revalidatePath("/gps-devices");
  revalidatePath(`/gps-devices/${deviceId}`);
  return { ok: true, lat: pos.lat, lng: pos.lng, speed: pos.speed };
}

/** Grant a profile access to view a GPS device. */
export async function grantDeviceAccess(deviceId: string, profileId: string) {
  const actor = await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { error } = await svc
    .from("gps_device_access")
    .upsert(
      { gps_device_id: deviceId, profile_id: profileId, granted_by: actor.id },
      { onConflict: "gps_device_id,profile_id", ignoreDuplicates: true },
    );

  if (error) return { error: handleDbError(error, "gps_device_access") };

  revalidatePath(`/gps-devices/${deviceId}`);
  return { ok: true };
}

/** Revoke a profile's access to view a GPS device. */
export async function revokeDeviceAccess(deviceId: string, profileId: string) {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { error } = await svc
    .from("gps_device_access")
    .delete()
    .eq("gps_device_id", deviceId)
    .eq("profile_id", profileId);

  if (error) return { error: handleDbError(error, "gps_device_access") };

  revalidatePath(`/gps-devices/${deviceId}`);
  return { ok: true };
}

/** Link or unlink an agent from a GPS device. */
export async function relinkAgent(deviceId: string, agentId: string | null) {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { error } = await svc
    .from("gps_devices")
    .update({ agent_id: agentId })
    .eq("id", deviceId)
    .is("deleted_at", null);

  if (error) return { error: handleDbError(error, "gps_devices") };

  revalidatePath("/gps-devices");
  revalidatePath(`/gps-devices/${deviceId}`);
  return { ok: true };
}
