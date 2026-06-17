"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendInvoiceEmail } from "@/lib/email";
import { notifyUsers } from "@/lib/notifications";

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

  // When marking as sent, email the client and fire an in-app notification.
  if (status === "sent") {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("invoice_number, title, amount, currency, due_date, clients(name, email, profile_id)")
      .eq("id", id)
      .single();

    const client = invoice?.clients as unknown as {
      name: string;
      email: string | null;
      profile_id: string | null;
    } | null;

    if (invoice && client) {
      if (client.email) {
        void sendInvoiceEmail({
          to: client.email,
          clientName: client.name,
          invoiceNumber: invoice.invoice_number,
          invoiceTitle: invoice.title,
          amount: invoice.amount,
          currency: invoice.currency,
          dueDate: invoice.due_date ?? null,
        });
      }
      if (client.profile_id) {
        void notifyUsers([client.profile_id], {
          type: "system",
          title: `Invoice ${invoice.invoice_number}`,
          body: `A new invoice of ${invoice.amount.toLocaleString()} ${invoice.currency} has been issued.`,
          link: "/portal",
        });
      }
    }
  }

  revalidatePath("/invoices");
  revalidatePath("/portal");
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

export async function updateInvoice(id: string, formData: FormData) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const lineItems = JSON.parse((formData.get("line_items") as string) || "[]");
  const amount = (lineItems as { total: number }[]).reduce((s, i) => s + i.total, 0);

  const { error } = await supabase
    .from("invoices")
    .update({
      title:     formData.get("title") as string,
      line_items: lineItems,
      amount,
      due_date:  (formData.get("due_date") as string) || null,
      notes:     (formData.get("notes") as string) || null,
      status:    formData.get("status") as string,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/invoices");
  revalidatePath("/portal");
  return { ok: true };
}

export async function deleteInvoice(id: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/invoices");
  revalidatePath("/portal");
  return { ok: true };
}
