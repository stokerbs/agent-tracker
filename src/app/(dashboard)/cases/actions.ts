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
import { notifyUsers } from "@/lib/notifications";

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

  // Fire email + in-app notification (non-blocking — failure does not abort the action).
  const [{ data: agentRow }, { data: caseRow }] = await Promise.all([
    supabase.from("agents").select("email,full_name,profile_id").eq("id", agentId).single(),
    supabase.from("cases").select("case_number,case_type,client_name").eq("id", caseId).single(),
  ]);
  if (caseRow) {
    if (agentRow?.email) {
      void sendAssignmentEmail({
        to: agentRow.email,
        agentName: agentRow.full_name ?? "Agent",
        caseNumber: caseRow.case_number,
        caseType: caseRow.case_type,
        clientName: caseRow.client_name,
        caseId,
      });
    }
    if (agentRow?.profile_id) {
      void notifyUsers([agentRow.profile_id], {
        type: "assignment",
        title: "New case assignment",
        body: `You have been assigned to case ${caseRow.case_number}.`,
        link: `/cases/${caseId}`,
      });
    }
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

export async function updateCase(caseId: string, formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const payload = {
    // client_name is a legacy display denorm — NOT updated here.
    // It is synced automatically by the trg_sync_client_name trigger when
    // clients.name changes. Use the clients join for display.
    case_type:   emptyToNull(formData.get("case_type")),
    status:      String(formData.get("status") ?? "new") as CaseStatus,
    priority:    String(formData.get("priority") ?? "medium") as CasePriority,
    start_date:  emptyToNull(formData.get("start_date")),
    end_date:    emptyToNull(formData.get("end_date")),
    description: emptyToNull(formData.get("description")),
  };

  const { error } = await supabase.from("cases").update(payload).eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
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

export async function archiveCase(caseId: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };
  revalidatePath("/cases");
  return { ok: true };
}

export async function unarchiveCase(caseId: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ archived_at: null })
    .eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };
  revalidatePath("/cases");
  return { ok: true };
}

export async function cancelCase(caseId: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ status: "cancelled" })
    .eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  return { ok: true };
}

export async function deleteCase(caseId: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  // Fetch case info for audit log before deletion.
  const { data: caseRecord } = await supabase
    .from("cases")
    .select("case_number, client_name")
    .eq("id", caseId)
    .single();

  const { error } = await supabase.from("cases").delete().eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };

  // Log the hard delete.
  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "hard_delete",
    entity: "cases",
    entity_id: caseId,
    metadata: { case_number: caseRecord?.case_number, client_name: caseRecord?.client_name },
  });

  revalidatePath("/cases");
  return { ok: true };
}
