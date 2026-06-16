"use server";

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
