"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStaff, requireProfile, requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import type { AgentStatus } from "@/lib/types";

export async function createAgent(formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const payload = {
    agent_code: String(formData.get("agent_code") ?? "").trim(),
    full_name: String(formData.get("full_name") ?? "").trim(),
    nickname: emptyToNull(formData.get("nickname")),
    phone: emptyToNull(formData.get("phone")),
    email: emptyToNull(formData.get("email")),
    position: emptyToNull(formData.get("position")),
    area: emptyToNull(formData.get("area")),
    status: (String(formData.get("status") ?? "offline") as AgentStatus),
    photo_url: emptyToNull(formData.get("photo_url")),
  };

  const { error } = await supabase.from("agents").insert(payload);
  if (error) return { error: handleDbError(error, "agents") };

  revalidatePath("/agents");
  return { ok: true };
}

export async function updateAgentStatus(agentId: string, status: AgentStatus) {
  const profile = await requireProfile();

  // Clients have no operational role — block unconditionally.
  if (profile.role === "client") {
    return { error: "Not authorized" };
  }

  const supabase = await createClient();

  // Agents may only update their own status row.
  if (!isStaff(profile.role)) {
    const { data: ownAgent } = await supabase
      .from("agents")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!ownAgent || ownAgent.id !== agentId) {
      return { error: "Not authorized" };
    }
  }

  // Admins and supervisors may update any agent.
  const { error } = await supabase
    .from("agents")
    .update({ status, last_active: new Date().toISOString() })
    .eq("id", agentId);
  if (error) return { error: handleDbError(error, "agents") };
  revalidatePath("/agents");
  revalidatePath("/map");
  return { ok: true };
}

/**
 * Agent self-reports GPS position + battery. Called from the field client
 * (mobile) every ~60s.
 *
 * The agent row is resolved exclusively from the authenticated session —
 * no agent ID is accepted from the caller. This prevents a supervisor (or
 * any other authenticated user) from spoofing a different agent's location
 * by supplying an arbitrary ID, which was possible when agentId came from
 * client input and the broad "agents staff write" RLS policy applied.
 */
export async function reportLocation(input: {
  lat: number;
  lng: number;
  battery?: number;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!agent) {
    return { error: "No agent profile linked to this account" };
  }

  const { error } = await supabase
    .from("agents")
    .update({
      current_lat: input.lat,
      current_lng: input.lng,
      battery_pct: input.battery ?? null,
      last_active: new Date().toISOString(),
    })
    .eq("id", agent.id);

  if (error) return { error: handleDbError(error, "agents") };
  return { ok: true };
}

export async function deleteAgent(agentId: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("agents").delete().eq("id", agentId);
  if (error) return { error: handleDbError(error, "agents") };
  revalidatePath("/agents");
  return { ok: true };
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
