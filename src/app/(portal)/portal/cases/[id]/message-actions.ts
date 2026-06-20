"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";

export async function sendClientMessage(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "client") throw new Error("Unauthorized");

  const caseId = formData.get("case_id") as string;
  const body = (formData.get("body") as string ?? "").trim();

  if (!body) throw new Error("Message body is required");
  if (body.length > 2000) throw new Error("Message too long");

  const supabase = await createClient();

  // Defence-in-depth: verify client owns this case on top of RLS
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!clientRow) throw new Error("Unauthorized");

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .eq("client_id", clientRow.id)
    .maybeSingle();
  if (!caseRow) throw new Error("Unauthorized");

  const { error } = await supabase.from("case_messages").insert({
    case_id: caseId,
    sender_id: profile.id,
    body,
    is_internal: false,
  });
  if (error) throw new Error(handleDbError(error, "messages"));

  revalidatePath(`/portal/cases/${caseId}`);
}

export async function markClientMessagesRead(caseId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = await createClient();
  await supabase.from("case_message_views").upsert(
    { case_id: caseId, profile_id: profile.id, last_seen_at: new Date().toISOString() },
    { onConflict: "case_id,profile_id" },
  );
}
