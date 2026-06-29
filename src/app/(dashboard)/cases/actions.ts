"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import type { AgentRole, AgentStatus, CasePriority, CaseStatus } from "@/lib/types";
import {
  createLicensePlateBlindIndex,
  createNameBlindIndex,
  createPhoneBlindIndex,
  encryptField,
} from "@/lib/security/encryption";
import { sendAssignmentEmail } from "@/lib/email";
import { notifyCaseParticipants, notifyUsers, notificationLinks } from "@/lib/notifications";

/** Human label for a case status, used in notification copy. */
const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  new: "New",
  assigned: "Assigned",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled",
};

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
    client_id:    emptyToNull(formData.get("client_id")),   // FK to clients
    client_name:  emptyToNull(formData.get("client_name")), // display denorm
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
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ status })
    .eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };

  await notifyCaseParticipants(caseId, {
    type: "case",
    title: "Case status updated",
    body: `Status changed to ${CASE_STATUS_LABEL[status]}.`,
    exclude: profile.id,
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  return { ok: true };
}

/**
 * Set (or clear) the per-case agent check-in interval in minutes. `null` turns
 * the cadence off. Validated server-side; the checkin-monitor cron enforces it.
 */
export async function setCheckinInterval(caseId: string, minutes: number | null) {
  await requireRole(["admin", "supervisor"]);

  let interval: number | null = null;
  if (minutes !== null) {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      return { error: "ช่วงเวลาต้องเป็น 1–1440 นาที" };
    }
    interval = minutes;
  }

  const supabase = await createClient();
  // Reset the dedup stage so the new cadence starts clean.
  const { error } = await supabase
    .from("cases")
    .update({ checkin_interval_minutes: interval, checkin_stage: "ok" })
    .eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

export async function closeCase(caseId: string, endDate: string) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ status: "closed", end_date: endDate })
    .eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };

  await notifyCaseParticipants(caseId, {
    type: "case",
    title: "Case closed",
    body: "This case has been closed.",
    exclude: profile.id,
  });

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
      await notifyUsers([agentRow.profile_id], {
        type: "assignment",
        title: "New case assignment",
        body: `You have been assigned to case ${caseRow.case_number}.`,
        url: notificationLinks.case(caseId),
        entityId: caseId,
      });
    }
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

export async function updateCase(caseId: string, formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const clientId = emptyToNull(formData.get("client_id"));
  const payload: Record<string, unknown> = {
    client_id:   clientId,               // FK — may be null to unlink
    client_name: emptyToNull(formData.get("client_name")), // display denorm
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

// ─── Bulk assignment (checkbox dialog) ───────────────────────────────────────

export interface AssignableAgent {
  id: string;
  full_name: string;
  agent_code: string;
  photo_url: string | null;
  status: AgentStatus;
  agent_role: AgentRole | null;
  /**
   * Whether the agent is linked to a login account (agents.profile_id is set).
   * Unlinked agents can be written to case_agents but will NEVER see the case in
   * Field App → My Cases (which resolves the agent via profile_id = auth.uid()),
   * so the dialog blocks assigning them.
   */
  linked: boolean;
}

/** Loads the full agent roster plus the IDs currently assigned to the case. */
export async function getCaseAssignmentData(
  caseId: string,
): Promise<{ agents: AssignableAgent[]; assignedIds: string[] } | { error: string }> {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const [{ data: agentsRaw, error: aErr }, { data: linksRaw, error: lErr }] = await Promise.all([
    supabase
      .from("agents")
      .select("id, full_name, agent_code, photo_url, status, agent_role, profile_id")
      .order("full_name"),
    supabase.from("case_agents").select("agent_id").eq("case_id", caseId),
  ]);
  if (aErr) return { error: handleDbError(aErr, "cases") };
  if (lErr) return { error: handleDbError(lErr, "cases") };

  type AgentRow = Omit<AssignableAgent, "linked"> & { profile_id: string | null };
  const agents: AssignableAgent[] = ((agentsRaw ?? []) as AgentRow[]).map((a) => ({
    id: a.id,
    full_name: a.full_name,
    agent_code: a.agent_code,
    photo_url: a.photo_url,
    status: a.status,
    agent_role: a.agent_role,
    linked: a.profile_id != null,
  }));

  return {
    agents,
    assignedIds: (linksRaw ?? []).map((r) => r.agent_id as string),
  };
}

/**
 * Sets the case's assigned agents to exactly `agentIds`, diffing against the
 * current set: inserts new links, deletes removed ones, notifies + emails newly
 * assigned agents, auto-advances a brand-new case to "assigned", and records an
 * audit_logs entry per change. Single source of truth = case_agents.
 */
export async function setCaseAssignments(
  caseId: string,
  agentIds: string[],
): Promise<{ ok: true; added: number; removed: number } | { error: string }> {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: currentRaw, error: curErr } = await supabase
    .from("case_agents")
    .select("agent_id")
    .eq("case_id", caseId);
  if (curErr) return { error: handleDbError(curErr, "cases") };

  const current = new Set((currentRaw ?? []).map((r) => r.agent_id as string));
  const next = new Set(agentIds);
  const toAdd = [...next].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !next.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("case_agents")
      .insert(toAdd.map((agentId) => ({ case_id: caseId, agent_id: agentId, assigned_by: profile.id })));
    if (error) return { error: handleDbError(error, "cases") };
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("case_agents")
      .delete()
      .eq("case_id", caseId)
      .in("agent_id", toRemove);
    if (error) return { error: handleDbError(error, "cases") };
  }

  // Auto-advance a brand-new case once it has at least one assignee.
  if (next.size > 0) {
    await supabase.from("cases").update({ status: "assigned" }).eq("id", caseId).eq("status", "new");
  }

  // Resolve names/emails for the changed agents (for audit + notifications).
  const changedIds = [...new Set([...toAdd, ...toRemove])];
  const { data: caseRow } = await supabase
    .from("cases")
    .select("case_number, case_type, client_name")
    .eq("id", caseId)
    .single();
  const { data: agentRows } = changedIds.length
    ? await supabase.from("agents").select("id, full_name, email, profile_id").in("id", changedIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null; profile_id: string | null }[] };
  const agentById = new Map((agentRows ?? []).map((a) => [a.id, a]));

  // Notify + email newly assigned agents.
  for (const agentId of toAdd) {
    const a = agentById.get(agentId);
    if (!a || !caseRow) continue;
    if (a.email) {
      void sendAssignmentEmail({
        to: a.email,
        agentName: a.full_name ?? "Agent",
        caseNumber: caseRow.case_number,
        caseType: caseRow.case_type,
        clientName: caseRow.client_name,
        caseId,
      });
    }
    if (a.profile_id) {
      await notifyUsers([a.profile_id], {
        type: "assignment",
        title: "New case assignment",
        body: `You have been assigned to ${caseRow.case_number}.`,
        url: notificationLinks.case(caseId),
        entityId: caseId,
      });
    }
  }

  // Audit log every assignment change.
  const auditRows = [
    ...toAdd.map((agentId) => ({
      actor_id: profile.id,
      action: "assign_agent",
      entity: "case_agents",
      entity_id: caseId,
      metadata: {
        case_number: caseRow?.case_number ?? null,
        agent_id: agentId,
        agent_name: agentById.get(agentId)?.full_name ?? null,
      },
    })),
    ...toRemove.map((agentId) => ({
      actor_id: profile.id,
      action: "unassign_agent",
      entity: "case_agents",
      entity_id: caseId,
      metadata: {
        case_number: caseRow?.case_number ?? null,
        agent_id: agentId,
        agent_name: agentById.get(agentId)?.full_name ?? null,
      },
    })),
  ];
  if (auditRows.length > 0) {
    await supabase.from("audit_logs").insert(auditRows);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath("/field");
  return { ok: true, added: toAdd.length, removed: toRemove.length };
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
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ status: "cancelled" })
    .eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };

  await notifyCaseParticipants(caseId, {
    type: "case",
    title: "Case cancelled",
    body: "This case has been cancelled.",
    exclude: profile.id,
  });

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
