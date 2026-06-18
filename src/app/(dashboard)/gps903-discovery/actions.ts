"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { getOrRefreshCredentialSession, gps903GetTracking } from "@/lib/gps903";

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
    .eq("is_active", true)
    .not("gps903_device_id", "is", null);

  if (credErr) return { error: handleDbError(credErr, "gps903_credentials") };

  if (!credentials?.length) {
    return {
      error:
        "No active GPS903 credentials with a detected Device ID. " +
        "Go to GPS Credentials, click Test on each device to auto-detect the Device ID, then retry.",
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

/**
 * Attach a credential to a case, creating a gps_devices link row.
 * Replaces the old importDeviceToCase (which used the catalog).
 */
export async function attachCredentialToCase(
  credentialId: string,
  caseId: string,
  agentId: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  const profile = await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { data: cred } = await svc
    .from("gps903_credentials")
    .select("id, imei, device_name, phone_number, provider, gps903_device_id")
    .eq("id", credentialId)
    .maybeSingle();

  if (!cred) return { error: "Credential not found" };

  // Prevent duplicate link to the same case
  const { data: existing } = await svc
    .from("gps_devices")
    .select("id")
    .eq("credential_id", credentialId)
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return { error: "This GPS device is already linked to this case" };

  const { error } = await svc.from("gps_devices").insert({
    case_id:          caseId,
    credential_id:    cred.id,
    imei:             cred.imei,
    phone_number:     cred.phone_number,
    provider:         cred.provider ?? "GPS903",
    gps903_device_id: cred.gps903_device_id,
    agent_id:         agentId,
    notes:            cred.device_name,
    created_by:       profile.id,
  });

  if (error) return { error: handleDbError(error, "gps_devices") };

  revalidatePath("/gps903-discovery");
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/gps-devices");
  return { ok: true };
}

/**
 * Returns all active credentials for use in client-side attach dialogs.
 * Replaces the old getGps903CatalogForImport (which used the catalog table).
 */
export async function getCredentialsForAttach(): Promise<{
  id: string;
  gps903_device_id: number | null;
  device_name: string;
  imei: string;
  phone_number: string | null;
  provider: string | null;
  last_synced_at: string | null;
  last_sync_ok: boolean | null;
}[]> {
  await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { data } = await svc
    .from("gps903_credentials")
    .select("id, gps903_device_id, device_name, imei, phone_number, provider, last_synced_at, last_sync_ok")
    .eq("is_active", true)
    .order("device_name");

  return (data ?? []) as {
    id: string;
    gps903_device_id: number | null;
    device_name: string;
    imei: string;
    phone_number: string | null;
    provider: string | null;
    last_synced_at: string | null;
    last_sync_ok: boolean | null;
  }[];
}
