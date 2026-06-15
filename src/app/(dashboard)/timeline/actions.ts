"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function addTimelineEntry(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  const supabase = await createClient();

  // Resolve the agent row linked to this user (agents self-report).
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const caseId = String(formData.get("case_id") ?? "");
  const payload = {
    case_id: caseId,
    agent_id: (formData.get("agent_id") as string) || agent?.id || null,
    entry_date: String(formData.get("entry_date") ?? "") || undefined,
    entry_time: String(formData.get("entry_time") ?? "") || undefined,
    entry: String(formData.get("entry") ?? "").trim(),
    location: emptyToNull(formData.get("location")),
    photo_url: emptyToNull(formData.get("photo_url")),
    video_url: emptyToNull(formData.get("video_url")),
  };

  if (!payload.entry) return { error: "Entry text is required" };

  const { error } = await supabase.from("timeline_entries").insert(payload);
  if (error) return { error: error.message };

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/timeline");
  return { ok: true };
}

export async function deleteTimelineEntry(id: string, caseId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("timeline_entries")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
