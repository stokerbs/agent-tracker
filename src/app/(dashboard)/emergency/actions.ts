"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";

/**
 * Triggers an SOS emergency alert for the calling agent. The DB trigger
 * `notify_supervisors_on_alert` fans out notifications to all supervisors/admins.
 */
export async function triggerSos(input: {
  lat?: number;
  lng?: number;
  notes?: string;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const { error } = await supabase.from("emergency_alerts").insert({
    agent_id: agent?.id ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    notes: input.notes ?? "SOS triggered from field device",
    status: "active",
  });
  if (error) return { error: handleDbError(error, "emergency") };

  revalidatePath("/emergency");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function acknowledgeAlert(alertId: string) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("emergency_alerts")
    .update({
      status: "acknowledged",
      acknowledged_by: profile.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", alertId);
  if (error) return { error: handleDbError(error, "emergency") };
  revalidatePath("/emergency");
  return { ok: true };
}

export async function resolveAlert(alertId: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("emergency_alerts")
    .update({ status: "resolved" })
    .eq("id", alertId);
  if (error) return { error: handleDbError(error, "emergency") };
  revalidatePath("/emergency");
  return { ok: true };
}
