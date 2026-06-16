"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import type { UserRole } from "@/lib/types";

export async function updateUserRole(userId: string, role: UserRole) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: handleDbError(error, "users") };
  revalidatePath("/users");
  return { ok: true };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) return { error: handleDbError(error, "users") };
  revalidatePath("/users");
  return { ok: true };
}

export async function getUserDetails(userId: string) {
  await requireRole(["admin"]);
  const serviceClient = createServiceClient();
  const supabase = await createClient();

  const [{ data: authData }, { data: agentData }] = await Promise.all([
    serviceClient.auth.admin.getUserById(userId),
    supabase
      .from("agents")
      .select("id, agent_code, status, battery_pct, last_active, area, position")
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);

  const authUser = authData?.user ?? null;

  let caseCount = 0;
  if (agentData) {
    const { count } = await supabase
      .from("case_agents")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentData.id);
    caseCount = count ?? 0;
  } else {
    const { data: clientRecord } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();
    if (clientRecord) {
      const { count } = await supabase
        .from("cases")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientRecord.id);
      caseCount = count ?? 0;
    }
  }

  return {
    agent: agentData,
    caseCount,
    last_sign_in_at: authUser?.last_sign_in_at ?? null,
    otp_verified: !!(
      authUser?.phone_confirmed_at ??
      authUser?.email_confirmed_at ??
      (authUser as any)?.confirmed_at
    ),
  };
}
