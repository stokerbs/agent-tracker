"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { BUCKETS } from "@/lib/constants";
import {
  ALLOWED_IMAGE_TYPES,
  FileValidationError,
  validateDocumentUpload,
  validateImageUpload,
} from "@/lib/security/file-validation";
import type { ExpenseCategory } from "@/lib/types";

export async function addExpense(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (profile.role === "client") return { error: "Not authorized" };
  const supabase = await createClient();

  // Staff may attribute an expense to any agent via FormData agent_id (validated).
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

  let receiptPath: string | null = null;
  const receipt = formData.get("receipt") as File | null;
  if (receipt && receipt.size > 0) {
    // Validate type and size BEFORE touching Storage.
    try {
      if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(receipt.type)) {
        await validateImageUpload(receipt);
      } else {
        await validateDocumentUpload(receipt);
      }
    } catch (err) {
      if (err instanceof FileValidationError) return { error: err.message };
      throw err;
    }

    const ext = receipt.name.split(".").pop() ?? "jpg";
    const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKETS.receipts)
      .upload(path, receipt, { contentType: receipt.type, upsert: false });
    if (!upErr) receiptPath = path;
  }

  const { error } = await supabase.from("expenses").insert({
    agent_id: agentId,
    case_id: String(formData.get("case_id") ?? "") || null,
    category: String(formData.get("category") ?? "misc") as ExpenseCategory,
    amount: Number(formData.get("amount") ?? 0),
    expense_date: String(formData.get("expense_date") ?? "") || undefined,
    receipt_url: receiptPath,
    notes: String(formData.get("notes") ?? "") || null,
    created_by: profile.id,
  });
  if (error) return { error: handleDbError(error, "addExpense") };

  revalidatePath("/expenses");
  return { ok: true };
}
