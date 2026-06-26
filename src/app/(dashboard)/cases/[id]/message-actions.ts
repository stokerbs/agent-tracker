"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { notifyCaseParticipants } from "@/lib/notifications";

export async function sendMessage(formData: FormData) {
  // Allow any non-client (admin, supervisor, assigned agent) — this mirrors the
  // case_messages RLS (msgs_agent_insert in 0058), which permits agents to post
  // non-internal messages on their assigned cases. Clients use sendClientMessage.
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "client") throw new Error("Unauthorized");

  const caseId = formData.get("case_id") as string;
  const body = (formData.get("body") as string ?? "").trim();
  // Internal notes are staff-only; RLS rejects is_internal=true from agents, so
  // never let a non-staff sender mark a message internal.
  const isInternal = isStaff(profile.role) && formData.get("is_internal") === "true";

  if (!body) throw new Error("Message body is required");
  if (body.length > 2000) throw new Error("Message too long");

  const supabase = await createClient();
  const { error } = await supabase.from("case_messages").insert({
    case_id: caseId,
    sender_id: profile.id,
    body,
    is_internal: isInternal,
  });
  if (error) throw new Error(handleDbError(error, "messages"));

  // Notify the other case participants. Internal staff notes have no clean
  // per-case audience (agents/clients can't see them), so they aren't pushed.
  if (!isInternal) {
    after(() => notifyCaseParticipants(caseId, {
      type: "system",
      title: "New case message",
      body: body.slice(0, 140),
      exclude: profile.id,
    }));
  }

  revalidatePath(`/cases/${caseId}`);
}

export async function markMessagesRead(caseId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = await createClient();
  await supabase.from("case_message_views").upsert(
    { case_id: caseId, profile_id: profile.id, last_seen_at: new Date().toISOString() },
    { onConflict: "case_id,profile_id" },
  );
}
