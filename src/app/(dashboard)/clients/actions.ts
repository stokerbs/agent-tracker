"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function updateClient(id: string, formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({
      name:    String(formData.get("name") ?? "").trim(),
      company: emptyToNull(formData.get("company")),
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

export async function createClientRecord(formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name:    String(formData.get("name") ?? "").trim(),
      company: emptyToNull(formData.get("company")),
      email:   emptyToNull(formData.get("email")),
      phone:   emptyToNull(formData.get("phone")),
      notes:   emptyToNull(formData.get("notes")),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function linkClientProfile(clientId: string, profileId: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({ profile_id: profileId })
    .eq("id", clientId);

  if (error) return { error: error.message };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function unlinkClientProfile(clientId: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({ profile_id: null })
    .eq("id", clientId);

  if (error) return { error: error.message };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
