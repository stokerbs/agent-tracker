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
  applyPositionToAgent,
} from "@/lib/gps903";

/** Trigger an immediate GPS903 poll for a single device. */
export async function pollDeviceNow(deviceId: string) {
  await requireRole(["admin", "supervisor"]);

  const username = process.env.GPS903_USERNAME;
  const password = process.env.GPS903_PASSWORD;
  if (!username || !password) return { error: "GPS903 credentials not configured" };

  const svc = createServiceClient();

  const { data: device } = await svc
    .from("gps_devices")
    .select("gps903_device_id, agent_id")
    .eq("id", deviceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!device?.gps903_device_id) return { error: "Device has no GPS903 Device ID configured" };
  if (!device?.agent_id)         return { error: "Device is not linked to an agent" };

  let session = await getOrRefreshSession(svc);
  if (!session) {
    await svc.from("gps_devices").update({
      last_polled_at: new Date().toISOString(),
      last_poll_ok:   false,
    }).eq("id", deviceId);
    return { error: "GPS903 login failed — check credentials" };
  }

  let pos = await gps903GetTracking(session, device.gps903_device_id as number);

  if (!pos) {
    const fresh = await gps903Login(username, password);
    if (fresh) {
      await cacheSession(svc, fresh);
      pos = await gps903GetTracking(fresh, device.gps903_device_id as number);
    }
  }

  await svc.from("gps_devices").update({
    last_polled_at: new Date().toISOString(),
    last_poll_ok:   pos !== null,
  }).eq("id", deviceId);

  if (!pos) return { error: "GPS903 returned no position for this device" };

  try {
    await applyPositionToAgent(svc, device.agent_id as string, pos);
  } catch (e) {
    return { error: String(e) };
  }

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
