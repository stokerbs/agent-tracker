"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function updateClient(id: string, formData: FormData) {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({
      name:    String(formData.get("name") ?? "").trim(),
      company: emptyToNull(formData.get("company")),
      address: emptyToNull(formData.get("address")),
      email:   emptyToNull(formData.get("email")),
      phone:   emptyToNull(formData.get("phone")),
      notes:   emptyToNull(formData.get("notes")),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  return { ok: true };
}

// F-2 fix: return { ok, id } instead of calling redirect() — redirect() throws
// NEXT_REDIRECT which is swallowed by the dialog's try/catch and navigation
// never happens. The caller (CreateClientDialog) does router.push() on success.
export async function createClientRecord(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name:    String(formData.get("name") ?? "").trim(),
      company: emptyToNull(formData.get("company")),
      address: emptyToNull(formData.get("address")),
      email:   emptyToNull(formData.get("email")),
      phone:   emptyToNull(formData.get("phone")),
      notes:   emptyToNull(formData.get("notes")),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Audit: log client creation.
  await supabase.from("audit_logs").insert({
    actor_id:  profile.id,
    action:    "client_created",
    entity:    "clients",
    entity_id: data.id,
    metadata:  {},
  });

  revalidatePath("/clients");
  return { ok: true, id: data.id };
}

// F-3 fix: validate that the target profile exists and has role='client'.
// Linking a supervisor/agent profile to a client record would allow that
// staff member's identity to be associated with client data, and their
// profile_id to satisfy the portal ownership query.
export async function linkClientProfile(clientId: string, profileId: string) {
  const actor = await requireRole(["admin"]);
  const supabase = await createClient();

  // Verify target profile is a client-role account.
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();

  if (!targetProfile) return { error: "Profile not found." };
  if (targetProfile.role !== "client") {
    return { error: "Only profiles with role='client' can be linked to a client record." };
  }

  const { error } = await supabase
    .from("clients")
    .update({ profile_id: profileId })
    .eq("id", clientId);

  if (error) return { error: error.message };

  // F-5 audit: portal linking is security-sensitive; always log it.
  await supabase.from("audit_logs").insert({
    actor_id:  actor.id,
    action:    "client_portal_linked",
    entity:    "clients",
    entity_id: clientId,
    metadata:  { profile_id: profileId },
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function unlinkClientProfile(clientId: string) {
  const actor = await requireRole(["admin"]);
  const supabase = await createClient();

  // Read current profile_id before clearing it so we can audit who was unlinked.
  const { data: existing } = await supabase
    .from("clients")
    .select("profile_id")
    .eq("id", clientId)
    .maybeSingle();

  const { error } = await supabase
    .from("clients")
    .update({ profile_id: null })
    .eq("id", clientId);

  if (error) return { error: error.message };

  // Audit.
  await supabase.from("audit_logs").insert({
    actor_id:  actor.id,
    action:    "client_portal_unlinked",
    entity:    "clients",
    entity_id: clientId,
    metadata:  { former_profile_id: existing?.profile_id ?? null },
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
