"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { gps903Login, gps903GetTracking } from "@/lib/gps903";

export interface CredentialFormData {
  device_name:      string;
  imei:             string;
  device_password:  string;
  gps903_device_id: number;
  is_active:        boolean;
}

export async function createCredential(
  form: CredentialFormData,
): Promise<{ ok?: boolean; error?: string }> {
  const actor = await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { error } = await svc.from("gps903_credentials").insert({
    device_name:      form.device_name.trim(),
    imei:             form.imei.trim(),
    device_password:  form.device_password,
    gps903_device_id: form.gps903_device_id,
    is_active:        form.is_active,
    created_by:       actor.id,
  });

  if (error) return { error: handleDbError(error, "gps903_credentials") };
  revalidatePath("/gps903-credentials");
  return { ok: true };
}

export async function updateCredential(
  id: string,
  form: Partial<CredentialFormData>,
): Promise<{ ok?: boolean; error?: string }> {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const patch: Record<string, unknown> = {};
  if (form.device_name   !== undefined) patch.device_name      = form.device_name.trim();
  if (form.imei          !== undefined) patch.imei             = form.imei.trim();
  if (form.gps903_device_id !== undefined) patch.gps903_device_id = form.gps903_device_id;
  if (form.is_active     !== undefined) patch.is_active        = form.is_active;
  // Only update password if a non-empty value was provided
  if (form.device_password) patch.device_password = form.device_password;

  const { error } = await svc
    .from("gps903_credentials")
    .update(patch)
    .eq("id", id);

  if (error) return { error: handleDbError(error, "gps903_credentials") };
  revalidatePath("/gps903-credentials");
  return { ok: true };
}

export async function deleteCredential(id: string): Promise<{ ok?: boolean; error?: string }> {
  await requireRole(["admin"]);
  const svc = createServiceClient();

  const { error } = await svc
    .from("gps903_credentials")
    .delete()
    .eq("id", id);

  if (error) return { error: handleDbError(error, "gps903_credentials") };
  revalidatePath("/gps903-credentials");
  return { ok: true };
}

export async function toggleCredentialActive(
  id: string,
  active: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { error } = await svc
    .from("gps903_credentials")
    .update({ is_active: active })
    .eq("id", id);

  if (error) return { error: handleDbError(error, "gps903_credentials") };
  revalidatePath("/gps903-credentials");
  return { ok: true };
}

/**
 * Force a fresh login (bypasses session cache) and GetTracking probe.
 * Returns live position on success so the UI can confirm the device is reachable.
 */
export async function testCredential(id: string): Promise<{
  ok?: boolean;
  lat?: number;
  lng?: number;
  speed?: number;
  battery?: number | null;
  error?: string;
}> {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { data: cred } = await svc
    .from("gps903_credentials")
    .select("id, imei, device_password, gps903_device_id")
    .eq("id", id)
    .maybeSingle();

  if (!cred) return { error: "Credential not found" };

  const session = await gps903Login(cred.imei, cred.device_password);
  if (!session) {
    return { error: "Login failed — check IMEI and device password" };
  }

  // Update session cache with the fresh login
  await svc.from("gps903_credential_sessions").upsert({
    credential_id:  cred.id,
    session_cookie: session,
    expires_at:     new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    updated_at:     new Date().toISOString(),
  });

  const pos = await gps903GetTracking(session, cred.gps903_device_id);
  if (!pos) {
    return { error: "Login succeeded but device returned no position — may be offline" };
  }

  return { ok: true, lat: pos.lat, lng: pos.lng, speed: pos.speed, battery: pos.battery };
}
