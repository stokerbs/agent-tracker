"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { BUCKETS } from "@/lib/constants";
import type { ExpenseCategory } from "@/lib/types";

export async function addExpense(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  let receiptPath: string | null = null;
  const receipt = formData.get("receipt") as File | null;
  if (receipt && receipt.size > 0) {
    const ext = receipt.name.split(".").pop() ?? "jpg";
    const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKETS.receipts)
      .upload(path, receipt, { contentType: receipt.type });
    if (!upErr) receiptPath = path;
  }

  const explicitAgent = String(formData.get("agent_id") ?? "");
  const { error } = await supabase.from("expenses").insert({
    agent_id: explicitAgent || agent?.id || null,
    case_id: String(formData.get("case_id") ?? "") || null,
    category: String(formData.get("category") ?? "misc") as ExpenseCategory,
    amount: Number(formData.get("amount") ?? 0),
    expense_date: String(formData.get("expense_date") ?? "") || undefined,
    receipt_url: receiptPath,
    notes: String(formData.get("notes") ?? "") || null,
    created_by: profile.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/expenses");
  return { ok: true };
}
