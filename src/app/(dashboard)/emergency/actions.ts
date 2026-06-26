"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { notifyRole, notificationLinks } from "@/lib/notifications";

/**
 * Triggers an SOS emergency alert for the calling agent, then fans the alert out
 * to all supervisors/admins through the one notification pipeline (in-app + push,
 * high priority). Previously a DB trigger created the rows but could not push;
 * routing it here gives the most urgent notification native delivery too.
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
    .select("id, full_name")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const { data: alert, error } = await supabase
    .from("emergency_alerts")
    .insert({
      agent_id: agent?.id ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      notes: input.notes ?? "SOS triggered from field device",
      status: "active",
    })
    .select("id")
    .single();
  if (error) return { error: handleDbError(error, "emergency") };

  await notifyRole(
    ["admin", "supervisor"],
    {
      type: "emergency",
      title: "SOS Emergency Alert",
      body: `${agent?.full_name ?? "An agent"} triggered an emergency alert.`,
      url: notificationLinks.emergency(alert.id),
      entityId: alert.id,
      priority: "high",
    },
    profile.id,
  );

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
