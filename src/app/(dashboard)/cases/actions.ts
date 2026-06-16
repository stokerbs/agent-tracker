"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import type { CasePriority, CaseStatus } from "@/lib/types";
import {
  createLicensePlateBlindIndex,
  createNameBlindIndex,
  createPhoneBlindIndex,
  encryptField,
} from "@/lib/security/encryption";
import { sendAssignmentEmail } from "@/lib/email";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function enc(v: string | null): string | null {
  return v !== null ? encryptField(v) : null;
}

function bidx(v: string | null, fn: (s: string) => string): string | null {
  return v !== null ? fn(v) : null;
}

export async function createCase(formData: FormData) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const target_name    = emptyToNull(formData.get("target_name"));
  const target_phone   = emptyToNull(formData.get("target_phone"));
  const target_vehicle = emptyToNull(formData.get("target_vehicle"));
  const license_plate  = emptyToNull(formData.get("license_plate"));
  const target_address = emptyToNull(formData.get("target_address"));

  const payload = {
    case_number:  String(formData.get("case_number") ?? "").trim(),
    client_name:  emptyToNull(formData.get("client_name")),
    case_type:    emptyToNull(formData.get("case_type")),
    target_name_enc:    enc(target_name),
    target_name_bidx:   bidx(target_name,   createNameBlindIndex),
    target_phone_enc:   enc(target_phone),
    target_phone_bidx:  bidx(target_phone,  createPhoneBlindIndex),
    target_vehicle_enc: enc(target_vehicle),
    license_plate_enc:  enc(license_plate),
    license_plate_bidx: bidx(license_plate, createLicensePlateBlindIndex),
    target_address_enc: enc(target_address),
    start_date:   emptyToNull(formData.get("start_date")),
    end_date:     emptyToNull(formData.get("end_date")),
    status:       String(formData.get("status") ?? "new") as CaseStatus,
    priority:     String(formData.get("priority") ?? "medium") as CasePriority,
    description:  emptyToNull(formData.get("description")),
    created_by:   profile.id,
  };

  const { data, error } = await supabase
    .from("cases")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: handleDbError(error, "cases") };

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
  if (error) return { error: handleDbError(error, "cases") };
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  return { ok: true };
}

export async function closeCase(caseId: string, endDate: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ status: "closed", end_date: endDate })
    .eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function assignAgent(caseId: string, agentId: string) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("case_agents")
    .insert({ case_id: caseId, agent_id: agentId, assigned_by: profile.id });
  if (error) return { error: handleDbError(error, "cases") };
  // Auto-advance a brand-new case to "assigned".
  await supabase
    .from("cases")
    .update({ status: "assigned" })
    .eq("id", caseId)
    .eq("status", "new");

  // Fire assignment email (non-blocking — failure does not abort the action).
  const [{ data: agentRow }, { data: caseRow }] = await Promise.all([
    supabase.from("agents").select("email,full_name").eq("id", agentId).single(),
    supabase.from("cases").select("case_number,case_type,client_name").eq("id", caseId).single(),
  ]);
  if (agentRow?.email && caseRow) {
    void sendAssignmentEmail({
      to: agentRow.email,
      agentName: agentRow.full_name ?? "Agent",
      caseNumber: caseRow.case_number,
      caseType: caseRow.case_type,
      clientName: caseRow.client_name,
      caseId,
    });
  }

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
  if (error) return { error: handleDbError(error, "cases") };
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
