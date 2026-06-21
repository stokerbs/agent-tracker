"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireStaff } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";

export async function sendMessage(formData: FormData) {
  const profile = await requireStaff();

  const caseId = formData.get("case_id") as string;
  const body = (formData.get("body") as string ?? "").trim();
  const isInternal = formData.get("is_internal") === "true";

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
