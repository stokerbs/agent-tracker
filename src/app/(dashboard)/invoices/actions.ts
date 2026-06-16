"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createInvoice(formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const lineItems = JSON.parse((formData.get("line_items") as string) || "[]");
  const amount = (lineItems as { total: number }[]).reduce((s, i) => s + i.total, 0);

  const { error } = await supabase.from("invoices").insert({
    client_id: formData.get("client_id") as string,
    case_id: (formData.get("case_id") as string) || null,
    title: formData.get("title") as string,
    line_items: lineItems,
    amount,
    currency: "THB",
    issued_date: formData.get("issued_date") as string,
    due_date: (formData.get("due_date") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/invoices");
}

export async function updateInvoiceStatus(id: string, status: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/invoices");
}

export async function recordPayment(
  id: string,
  payload: { paid_at: string; payment_method: string; payment_ref: string },
) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", ...payload })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/invoices");
  revalidatePath("/portal");
  return { ok: true };
}
