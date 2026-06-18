"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import type { GpsProvider } from "@/lib/types";

const GPS_PROVIDERS: GpsProvider[] = ["AIS", "TRUE", "DTAC", "GPS903"];

function parseProvider(v: FormDataEntryValue | null): GpsProvider | null {
  const s = String(v ?? "").trim();
  return (GPS_PROVIDERS as string[]).includes(s) ? (s as GpsProvider) : null;
}

function parseImei(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^\d{15}$/.test(s)) throw new Error("IMEI must be exactly 15 digits");
  return s;
}

function parsePhone(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function createGpsDevice(caseId: string, formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  let imei: string | null;
  try {
    imei = parseImei(formData.get("imei"));
  } catch (e) {
    return { error: (e as Error).message };
  }

  const agentIdRaw     = String(formData.get("agent_id") ?? "").trim();
  const gps903DeviceId = parseInt(String(formData.get("gps903_device_id") ?? ""), 10);
  const payload = {
    case_id:          caseId,
    imei,
    phone_number:     parsePhone(formData.get("phone_number")),
    provider:         parseProvider(formData.get("provider")),
    notes:            String(formData.get("notes") ?? "").trim() || null,
    agent_id:         agentIdRaw && agentIdRaw !== "none" ? agentIdRaw : null,
    gps903_device_id: isNaN(gps903DeviceId) ? null : gps903DeviceId,
    created_by:       profile.id,
  };

  const { error } = await supabase.from("gps_devices").insert(payload);
  if (error) return { error: handleDbError(error, "gps_devices") };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "gps_device_created",
    entity: "gps_devices",
    metadata: { case_id: caseId, imei: payload.imei, phone_number: payload.phone_number },
  });

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

export async function updateGpsDevice(deviceId: string, caseId: string, formData: FormData) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  let imei: string | null;
  try {
    imei = parseImei(formData.get("imei"));
  } catch (e) {
    return { error: (e as Error).message };
  }

  const agentIdRaw     = String(formData.get("agent_id") ?? "").trim();
  const gps903DeviceId = parseInt(String(formData.get("gps903_device_id") ?? ""), 10);
  const payload = {
    imei,
    phone_number:     parsePhone(formData.get("phone_number")),
    provider:         parseProvider(formData.get("provider")),
    notes:            String(formData.get("notes") ?? "").trim() || null,
    agent_id:         agentIdRaw && agentIdRaw !== "none" ? agentIdRaw : null,
    gps903_device_id: isNaN(gps903DeviceId) ? null : gps903DeviceId,
  };

  const { error } = await supabase
    .from("gps_devices")
    .update(payload)
    .eq("id", deviceId)
    .is("deleted_at", null);
  if (error) return { error: handleDbError(error, "gps_devices") };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "gps_device_updated",
    entity: "gps_devices",
    entity_id: deviceId,
    metadata: { case_id: caseId, imei: payload.imei },
  });

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

export async function softDeleteGpsDevice(deviceId: string, caseId: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("gps_devices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", deviceId)
    .is("deleted_at", null);
  if (error) return { error: handleDbError(error, "gps_devices") };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "gps_device_deleted",
    entity: "gps_devices",
    entity_id: deviceId,
    metadata: { case_id: caseId },
  });

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
