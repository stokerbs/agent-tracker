"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import {
  getOrRefreshSession,
  gps903Login,
  cacheSession,
  gps903GetTracking,
  applyPositionToDevice,
} from "@/lib/gps903";

/** Trigger an immediate GPS903 poll for a single device. */
export async function pollDeviceNow(deviceId: string) {
  await requireRole(["admin", "supervisor"]);

  const imei           = process.env.GPS903_IMEI;
  const devicePassword = process.env.GPS903_DEVICE_PASSWORD;
  if (!imei || !devicePassword) return { error: "GPS903 IMEI credentials not configured" };

  const svc = createServiceClient();

  const { data: device } = await svc
    .from("gps_devices")
    .select("gps903_device_id")
    .eq("id", deviceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!device?.gps903_device_id) return { error: "Device has no GPS903 Device ID configured" };

  let session = await getOrRefreshSession(svc);
  if (!session) {
    await svc.from("gps_devices").update({
      last_polled_at: new Date().toISOString(),
      last_poll_ok:   false,
    }).eq("id", deviceId);
    return { error: "GPS903 login failed — check IMEI credentials" };
  }

  let pos = await gps903GetTracking(session, device.gps903_device_id as number);

  if (!pos) {
    const fresh = await gps903Login(imei, devicePassword);
    if (fresh) {
      await cacheSession(svc, fresh);
      pos = await gps903GetTracking(fresh, device.gps903_device_id as number);
    }
  }

  if (!pos) {
    await svc.from("gps_devices").update({
      last_polled_at: new Date().toISOString(),
      last_poll_ok:   false,
    }).eq("id", deviceId);
    return { error: "GPS903 returned no position for this device" };
  }

  await applyPositionToDevice(svc, deviceId, pos);

  revalidatePath("/gps-devices");
  revalidatePath(`/gps-devices/${deviceId}`);
  return { ok: true, lat: pos.lat, lng: pos.lng, speed: pos.speed };
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
