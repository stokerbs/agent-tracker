"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import {
  gps903Login,
  gps903GetTracking,
  detectGps903DeviceId,
  runGps903Discovery,
  getOrRefreshCredentialSession,
} from "@/lib/gps903";

export interface CredentialFormData {
  device_name:       string;
  imei:              string;
  device_password:   string;
  gps903_device_id?: number | null; // optional — auto-detected via Test Connection
  phone_number?:     string | null;
  provider?:         string | null;
  is_active:         boolean;
}

export interface TestResult {
  ok?:          boolean;
  loginOk?:     boolean; // true when credentials are valid but device ID not yet detected
  device_id?:   number;  // auto-detected (and saved) GPS903 device ID
  lat?:         number;
  lng?:         number;
  speed?:       number;
  battery?:     number | null;
  locateMode?:  "gps" | "lbs" | "unknown";
  error?:       string;
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
    gps903_device_id: form.gps903_device_id ?? null,
    phone_number:     form.phone_number ?? null,
    provider:         form.provider ?? null,
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
  if (form.device_name      !== undefined) patch.device_name      = form.device_name.trim();
  if (form.imei             !== undefined) patch.imei             = form.imei.trim();
  if (form.gps903_device_id !== undefined) patch.gps903_device_id = form.gps903_device_id ?? null;
  if (form.phone_number     !== undefined) patch.phone_number     = form.phone_number ?? null;
  if (form.provider         !== undefined) patch.provider         = form.provider ?? null;
  if (form.is_active        !== undefined) patch.is_active        = form.is_active;
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

  const { error } = await svc.from("gps903_credentials").delete().eq("id", id);

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
 * Test raw IMEI/password credentials before a credential record exists in the DB.
 * Used by the Add Device dialog to validate credentials and auto-detect the device ID.
 * Returns the detected device ID so the form can auto-fill it before saving.
 */
export async function testRawCredential(
  imei: string,
  password: string,
): Promise<TestResult> {
  await requireRole(["admin", "supervisor"]);

  const session = await gps903Login(imei.trim(), password);
  if (!session) {
    return { error: "Login failed — check IMEI and device password" };
  }

  const deviceId = await detectGps903DeviceId(session, imei.trim());
  if (!deviceId) {
    return {
      loginOk: true,
      error:
        "Login succeeded but GPS903 Device ID could not be detected automatically. " +
        "Enter it manually in the Device ID field.",
    };
  }

  const pos = await gps903GetTracking(session, deviceId);
  return {
    ok:          true,
    device_id:   deviceId,
    lat:         pos?.lat,
    lng:         pos?.lng,
    speed:       pos?.speed,
    battery:     pos?.battery ?? null,
    locateMode:  pos?.locateMode,
  };
}

/**
 * Test an existing saved credential by ID.
 * Forces a fresh login (bypasses session cache), auto-detects device ID if not yet set,
 * and saves both the fresh session and the detected device ID to the database.
 */
export async function testCredential(id: string): Promise<TestResult> {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { data: cred } = await svc
    .from("gps903_credentials")
    .select("id, imei, device_password, gps903_device_id")
    .eq("id", id)
    .maybeSingle();

  if (!cred) return { error: "Credential not found" };

  // Force fresh login so Test always reflects current credential state
  const session = await gps903Login(cred.imei, cred.device_password);
  if (!session) {
    return { error: "Login failed — check IMEI and device password" };
  }

  // Cache the fresh session
  await svc.from("gps903_credential_sessions").upsert({
    credential_id:  cred.id,
    session_cookie: session,
    expires_at:     new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    updated_at:     new Date().toISOString(),
  });

  // If device ID not yet known, detect and save it
  let deviceId = cred.gps903_device_id as number | null;
  if (!deviceId) {
    deviceId = await detectGps903DeviceId(session, cred.imei);
    if (deviceId) {
      await svc
        .from("gps903_credentials")
        .update({ gps903_device_id: deviceId })
        .eq("id", cred.id);
      revalidatePath("/gps903-credentials");
    }
  }

  if (!deviceId) {
    return {
      loginOk: true,
      error:
        "Login succeeded but GPS903 Device ID could not be detected automatically. " +
        "Enter it manually using the Edit button.",
    };
  }

  const pos = await gps903GetTracking(session, deviceId);
  return {
    ok:         true,
    device_id:  deviceId,
    lat:        pos?.lat,
    lng:        pos?.lng,
    speed:      pos?.speed,
    battery:    pos?.battery ?? null,
    locateMode: pos?.locateMode,
  };
}
