"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { notifyRole, notifyUsers, notificationLinks } from "@/lib/notifications";
import { assignAgent } from "./actions";

/**
 * Job Board server actions.
 *
 * Flow: admin posts a case to the board with a slot quota → agents request to
 * claim it → admin approves/rejects. Approving reuses `assignAgent` (so the
 * agent gets the standard assignment + notification + case read access).
 *
 * SECURITY: agents have no RLS read on unassigned cases. The board listing is
 * served here via the service client and exposes ONLY non-sensitive fields —
 * never the encrypted target intel. Agents gain full case access only after an
 * admin approves their claim.
 */

const BOARD_PATH = "/field/board";

// ── Admin: post / remove from board ─────────────────────────────────────────

export async function postCaseToBoard(caseId: string, slots: number) {
  await requireRole(["admin", "supervisor"]);
  if (!Number.isInteger(slots) || slots < 1 || slots > 50) {
    return { error: "Slots must be a whole number between 1 and 50." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({
      on_board: true,
      board_slots: slots,
      board_posted_at: new Date().toISOString(),
    })
    .eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };

  revalidatePath(`/cases/${caseId}`);
  revalidatePath(BOARD_PATH);
  return { ok: true };
}

export async function removeCaseFromBoard(caseId: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ on_board: false, board_slots: null })
    .eq("id", caseId);
  if (error) return { error: handleDbError(error, "cases") };

  // Clear outstanding pending requests so they don't linger off-board.
  await supabase.from("case_claims").delete().eq("case_id", caseId).eq("status", "pending");

  revalidatePath(`/cases/${caseId}`);
  revalidatePath(BOARD_PATH);
  return { ok: true };
}

// ── Agent: browse board + request a case ────────────────────────────────────

export interface BoardCase {
  id: string;
  case_number: string;
  case_type: string;
  priority: string;
  slots: number;
  approved: number;
  remaining: number;
  myClaim: "pending" | "approved" | "rejected" | null;
}

/**
 * List cases currently on the board, with safe fields only + slot counts + the
 * caller's own claim status. Service client (agents can't RLS-read these cases).
 */
export async function listBoardCases(): Promise<BoardCase[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const svc = createServiceClient();

  const { data: cases } = await svc
    .from("cases")
    .select("id, case_number, case_type, priority, board_slots")
    .eq("on_board", true)
    .is("archived_at", null)
    .order("board_posted_at", { ascending: false });
  if (!cases || cases.length === 0) return [];

  const caseIds = cases.map((c) => c.id);
  const { data: myAgent } = await svc
    .from("agents")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const { data: claims } = await svc
    .from("case_claims")
    .select("case_id, agent_id, status")
    .in("case_id", caseIds);

  const rows = claims ?? [];
  return cases.map((c) => {
    const approved = rows.filter((r) => r.case_id === c.id && r.status === "approved").length;
    const mine = myAgent
      ? rows.find((r) => r.case_id === c.id && r.agent_id === myAgent.id)
      : undefined;
    const slots = c.board_slots ?? 0;
    return {
      id: c.id,
      case_number: c.case_number,
      case_type: c.case_type,
      priority: c.priority,
      slots,
      approved,
      remaining: Math.max(0, slots - approved),
      myClaim: (mine?.status as BoardCase["myClaim"]) ?? null,
    };
  });
}

export async function requestCase(caseId: string, note?: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };

  const svc = createServiceClient();

  const { data: agent } = await svc
    .from("agents")
    .select("id, full_name")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!agent) return { error: "No agent profile linked to your account." };

  // The case must actually be open on the board (agents can't read it via RLS,
  // so this is validated server-side with the service client).
  const { data: caseRow } = await svc
    .from("cases")
    .select("id, case_number, on_board, board_slots")
    .eq("id", caseId)
    .maybeSingle();
  if (!caseRow || !caseRow.on_board) {
    return { error: "This case is no longer open for claims." };
  }

  // Re-derive remaining slots server-side (don't trust the on_board flag alone).
  const { count: approved } = await svc
    .from("case_claims")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .eq("status", "approved");
  if ((approved ?? 0) >= (caseRow.board_slots ?? 0)) {
    return { error: "This case is no longer open for claims." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("case_claims")
    .insert({ case_id: caseId, agent_id: agent.id, note: note?.trim() || null });
  if (error) {
    if (error.code === "23505") return { error: "You have already requested this case." };
    return { error: handleDbError(error, "case_claims") };
  }

  // Notify supervisors/admins that a request is waiting.
  await notifyRole(["admin", "supervisor"], {
    type: "system",
    title: "New case claim request",
    body: `${agent.full_name ?? "An agent"} requested case ${caseRow.case_number}.`,
    url: notificationLinks.case(caseId),
    entityId: caseId,
  });

  revalidatePath(BOARD_PATH);
  return { ok: true };
}

// ── Admin: review + decide claims ───────────────────────────────────────────

export interface PendingClaim {
  id: string;
  caseId: string;
  caseNumber: string;
  agentId: string;
  agentName: string | null;
  note: string | null;
  requestedAt: string;
}

/** Pending claims for a case (admin review panel). */
export async function listPendingClaims(caseId: string): Promise<PendingClaim[]> {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("case_claims")
    .select("id, case_id, agent_id, note, requested_at, agents(full_name), cases(case_number)")
    .eq("case_id", caseId)
    .eq("status", "pending")
    .order("requested_at");

  return (data ?? []).map((r) => ({
    id: r.id as string,
    caseId: r.case_id as string,
    caseNumber: (r.cases as { case_number?: string } | null)?.case_number ?? "",
    agentId: r.agent_id as string,
    agentName: (r.agents as { full_name?: string } | null)?.full_name ?? null,
    note: (r.note as string | null) ?? null,
    requestedAt: r.requested_at as string,
  }));
}

export async function decideClaim(claimId: string, decision: "approved" | "rejected") {
  const profile = await requireRole(["admin", "supervisor"]);
  const svc = createServiceClient();

  const { data: claim } = await svc
    .from("case_claims")
    .select("id, case_id, agent_id, status, agents(profile_id, full_name)")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) return { error: "Claim not found." };
  if (claim.status !== "pending") return { error: "This request was already decided." };

  if (decision === "approved") {
    // Enforce the slot quota.
    const [{ data: caseRow }, { count: approvedCount }] = await Promise.all([
      svc.from("cases").select("board_slots, case_number").eq("id", claim.case_id).single(),
      svc
        .from("case_claims")
        .select("id", { count: "exact", head: true })
        .eq("case_id", claim.case_id)
        .eq("status", "approved"),
    ]);
    const slots = caseRow?.board_slots ?? 0;
    if ((approvedCount ?? 0) >= slots) {
      return { error: "All slots for this case are already filled." };
    }

    // Reuse the standard assignment (inserts case_agents, advances status,
    // emails + notifies the agent, grants case read access).
    const res = await assignAgent(claim.case_id, claim.agent_id);
    if (res?.error) return res;

    await svc
      .from("case_claims")
      .update({ status: "approved", decided_by: profile.id, decided_at: new Date().toISOString() })
      .eq("id", claimId);

    // Close the board for this case once the quota is met.
    if ((approvedCount ?? 0) + 1 >= slots) {
      await svc.from("cases").update({ on_board: false }).eq("id", claim.case_id);
    }
  } else {
    await svc
      .from("case_claims")
      .update({ status: "rejected", decided_by: profile.id, decided_at: new Date().toISOString() })
      .eq("id", claimId);

    const agentProfileId = (claim.agents as { profile_id?: string } | null)?.profile_id;
    if (agentProfileId) {
      const { data: c } = await svc
        .from("cases")
        .select("case_number")
        .eq("id", claim.case_id)
        .single();
      await notifyUsers([agentProfileId], {
        type: "system",
        title: "Case claim not approved",
        body: `Your request for case ${c?.case_number ?? ""} was not approved.`,
        url: BOARD_PATH,
        entityId: claim.case_id,
      });
    }
  }

  revalidatePath(`/cases/${claim.case_id}`);
  revalidatePath(BOARD_PATH);
  return { ok: true };
}
