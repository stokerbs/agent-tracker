"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff, requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function addTimelineEntry(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (profile.role === "client") return { error: "Not authorized" };
  const supabase = await createClient();

  // Staff may attribute a timeline entry to any agent via FormData agent_id (validated).
  // Agents resolve against their own session — FormData agent_id is ignored.
  let agentId: string | null = null;
  if (isStaff(profile.role)) {
    const formAgentId = String(formData.get("agent_id") ?? "").trim();
    if (formAgentId) {
      const { data: found } = await supabase
        .from("agents").select("id").eq("id", formAgentId).maybeSingle();
      if (!found) return { error: "Agent not found" };
      agentId = found.id;
    }
  } else {
    const { data: ownAgent } = await supabase
      .from("agents").select("id").eq("profile_id", profile.id).maybeSingle();
    agentId = ownAgent?.id ?? null;
  }

  const caseId = String(formData.get("case_id") ?? "");
  const payload = {
    case_id: caseId,
    agent_id: agentId,
    entry_date: String(formData.get("entry_date") ?? "") || undefined,
    entry_time: String(formData.get("entry_time") ?? "") || undefined,
    entry: String(formData.get("entry") ?? "").trim(),
    location: emptyToNull(formData.get("location")),
    photo_url: emptyToNull(formData.get("photo_url")),
    video_url: emptyToNull(formData.get("video_url")),
  };

  if (!payload.entry) return { error: "Entry text is required" };

  const { error } = await supabase.from("timeline_entries").insert(payload);
  if (error) return { error: handleDbError(error, "timeline") };

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/timeline");
  return { ok: true };
}

export async function deleteTimelineEntry(id: string, caseId: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: deleted, error } = await supabase
    .from("timeline_entries")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (!deleted && !error) return { error: "Timeline entry not found" };
  if (error) return { error: handleDbError(error, "timeline") };

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
