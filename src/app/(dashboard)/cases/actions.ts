"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { CasePriority, CaseStatus } from "@/lib/types";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function createCase(formData: FormData) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const payload = {
    case_number: String(formData.get("case_number") ?? "").trim(),
    client_name: emptyToNull(formData.get("client_name")),
    case_type: emptyToNull(formData.get("case_type")),
    target_name: emptyToNull(formData.get("target_name")),
    target_phone: emptyToNull(formData.get("target_phone")),
    target_vehicle: emptyToNull(formData.get("target_vehicle")),
    license_plate: emptyToNull(formData.get("license_plate")),
    target_address: emptyToNull(formData.get("target_address")),
    start_date: emptyToNull(formData.get("start_date")),
    end_date: emptyToNull(formData.get("end_date")),
    status: String(formData.get("status") ?? "new") as CaseStatus,
    priority: String(formData.get("priority") ?? "medium") as CasePriority,
    description: emptyToNull(formData.get("description")),
    created_by: profile.id,
  };

  const { data, error } = await supabase
    .from("cases")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/cases");
  return { ok: true, id: data?.id as string };
}

export async function updateCaseStatus(caseId: string, status: CaseStatus) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ status })
    .eq("id", caseId);
  if (error) return { error: error.message };
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  return { ok: true };
}

export async function assignAgent(caseId: string, agentId: string) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("case_agents")
    .insert({ case_id: caseId, agent_id: agentId, assigned_by: profile.id });
  if (error) return { error: error.message };
  // Auto-advance a brand-new case to "assigned".
  await supabase
    .from("cases")
    .update({ status: "assigned" })
    .eq("id", caseId)
    .eq("status", "new");
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

export async function unassignAgent(caseId: string, agentId: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("case_agents")
    .delete()
    .eq("case_id", caseId)
    .eq("agent_id", agentId);
  if (error) return { error: error.message };
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
