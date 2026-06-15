"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
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
  if (error) return { error: error.message };

  revalidatePath("/agents");
  return { ok: true };
}

export async function updateAgentStatus(agentId: string, status: AgentStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agents")
    .update({ status, last_active: new Date().toISOString() })
    .eq("id", agentId);
  if (error) return { error: error.message };
  revalidatePath("/agents");
  revalidatePath("/map");
  return { ok: true };
}

/**
 * Agent self-reports GPS position + battery. Called from the field client
 * (mobile) every ~60s. Uses RLS "agents self update" policy.
 */
export async function reportLocation(input: {
  agentId: string;
  lat: number;
  lng: number;
  battery?: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agents")
    .update({
      current_lat: input.lat,
      current_lng: input.lng,
      battery_pct: input.battery ?? null,
      last_active: new Date().toISOString(),
    })
    .eq("id", input.agentId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteAgent(agentId: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("agents").delete().eq("id", agentId);
  if (error) return { error: error.message };
  revalidatePath("/agents");
  return { ok: true };
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
