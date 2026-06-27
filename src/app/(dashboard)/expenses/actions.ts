"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { notifyUsers, notificationLinks, relProfileId } from "@/lib/notifications";
import { BUCKETS } from "@/lib/constants";
import {
  ALLOWED_IMAGE_TYPES,
  FileValidationError,
  validateDocumentUpload,
  validateImageUpload,
} from "@/lib/security/file-validation";
import type { ExpenseCategory, ExpenseStatus, ExtractedExpense, UserRole } from "@/lib/types";

const OCR_MODEL = "claude-haiku-4-5-20251001";

const RECEIPT_PROMPT = `You are a receipt OCR assistant for a Thai detective agency. Extract data from this receipt and return ONLY a valid JSON object — no markdown, no explanation.

Return exactly this shape:
{
  "vendor_name": string or null,
  "category": one of: "fuel" | "toll" | "parking" | "meals" | "accommodation" | "transportation" | "office" | "misc",
  "amount": number (total in THB, net of VAT if shown separately) or null,
  "vat_amount": number (VAT portion only if itemised) or null,
  "expense_date": "YYYY-MM-DD" or null,
  "expense_time": "HH:MM" (24-hour) or null,
  "receipt_number": string or null,
  "notes": one-line description or null,
  "confidence": integer 0–100 (overall),
  "field_confidence": {
    "vendor_name": 0–100,
    "category": 0–100,
    "amount": 0–100,
    "vat_amount": 0–100,
    "expense_date": 0–100,
    "expense_time": 0–100,
    "receipt_number": 0–100
  }
}

Category rules:
- fuel: petrol station, gas station, LPG
- toll: expressway, toll booth
- parking: parking lot, car park
- meals: restaurant, food, coffee, beverage
- accommodation: hotel, hostel, serviced apartment, resort
- transportation: taxi, Grab, BTS, MRT, bus, van, train, flight
- office: stationery, printing, internet, equipment, software
- misc: anything else`;

async function resolveAgentId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { id: string; role: UserRole },
  formAgentId?: string,
): Promise<string | null> {
  if (isStaff(profile.role)) {
    if (!formAgentId) return null;
    const { data } = await supabase
      .from("agents").select("id").eq("id", formAgentId).maybeSingle();
    return data?.id ?? null;
  }
  const { data } = await supabase
    .from("agents").select("id").eq("profile_id", profile.id).maybeSingle();
  return data?.id ?? null;
}

export async function addExpense(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (profile.role === "client") return { error: "Not authorized" };
  const supabase = await createClient();

  const agentId = await resolveAgentId(
    supabase, profile,
    String(formData.get("agent_id") ?? "").trim() || undefined,
  );

  let receiptPath: string | null = null;
  const receipt = formData.get("receipt") as File | null;
  if (receipt && receipt.size > 0) {
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

  const vendorName = String(formData.get("vendor_name") ?? "").trim() || null;
  const expenseTime = String(formData.get("expense_time") ?? "").trim() || null;

  const { error } = await supabase.from("expenses").insert({
    agent_id: agentId,
    case_id: String(formData.get("case_id") ?? "") || null,
    category: String(formData.get("category") ?? "misc") as ExpenseCategory,
    amount: Number(formData.get("amount") ?? 0),
    expense_date: String(formData.get("expense_date") ?? "") || undefined,
    expense_time: expenseTime,
    receipt_url: receiptPath,
    vendor_name: vendorName,
    notes: String(formData.get("notes") ?? "") || null,
    source: "manual",
    created_by: profile.id,
  });
  if (error) return { error: handleDbError(error, "addExpense") };

  revalidatePath("/expenses");
  return { ok: true };
}

export async function scanReceipt(
  formData: FormData,
): Promise<
  | { error: string; receiptPath?: string }
  | { ok: true; receiptPath: string; extracted: ExtractedExpense }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (profile.role === "client") return { error: "Not authorized" };

  const file = formData.get("receipt") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };

  // Images only — no PDFs for OCR
  try {
    await validateImageUpload(file);
  } catch (err) {
    if (err instanceof FileValidationError) return { error: err.message };
    throw err;
  }

  // Read bytes once — used for both storage upload and base64 encoding
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString("base64");

  // Upload to storage first so the path exists even if OCR fails
  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const receiptPath = `${profile.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKETS.receipts)
    .upload(receiptPath, buffer, { contentType: file.type, upsert: false });
  if (upErr) return { error: "Upload failed — please try again" };

  // Call Claude Vision
  const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  let aiText = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              { type: "text", text: RECEIPT_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[scanReceipt] Anthropic error:", res.status, body);
      return { error: "AI analysis failed", receiptPath };
    }
    const data = await res.json();
    aiText = data?.content?.[0]?.text ?? "";
  } catch (err) {
    console.error("[scanReceipt] fetch error:", err);
    return { error: "AI analysis failed", receiptPath };
  }

  try {
    // Strip potential markdown code fences before parsing
    const cleaned = aiText.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
    const extracted = JSON.parse(cleaned) as ExtractedExpense;
    return { ok: true, receiptPath, extracted };
  } catch {
    console.error("[scanReceipt] parse error, raw:", aiText);
    return { error: "Could not parse AI response", receiptPath };
  }
}

export async function uploadReceiptPdf(
  formData: FormData,
): Promise<{ ok: true; receiptPath: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (profile.role === "client") return { error: "Not authorized" };

  const file = formData.get("receipt") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };

  try {
    await validateDocumentUpload(file);
  } catch (err) {
    if (err instanceof FileValidationError) return { error: err.message };
    throw err;
  }

  const supabase = await createClient();
  const path = `${profile.id}/${crypto.randomUUID()}.pdf`;
  const bytes = await file.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from(BUCKETS.receipts)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr) return { error: "Upload failed — please try again" };

  return { ok: true, receiptPath: path };
}

export async function updateExpenseStatus(
  expenseId: string,
  status: ExpenseStatus,
): Promise<{ ok: true } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (!isStaff(profile.role)) return { error: "Not authorized" };

  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "paid") {
    patch.paid_at = new Date().toISOString();
    patch.paid_by = profile.id;
  } else {
    patch.paid_at = null;
    patch.paid_by = null;
  }

  const { error } = await supabase
    .from("expenses")
    .update(patch)
    .eq("id", expenseId);
  if (error) return { error: handleDbError(error, "updateExpenseStatus") };

  // Tell the agent when their expense is approved/paid.
  if (status === "paid") {
    const { data: row } = await supabase
      .from("expenses")
      .select("amount, agents(profile_id)")
      .eq("id", expenseId)
      .maybeSingle();
    const recipient = relProfileId(row?.agents);
    if (recipient) {
      await notifyUsers([recipient], {
        type: "system",
        title: "Expense paid",
        body: `Your expense of ${Number(row?.amount ?? 0).toLocaleString()} THB has been marked paid.`,
        url: notificationLinks.expenses(),
        entityId: expenseId,
      });
    }
  }

  revalidatePath("/expenses");
  return { ok: true };
}

export async function softDeleteExpense(
  expenseId: string,
): Promise<{ ok: true } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (!isStaff(profile.role)) return { error: "Not authorized" };

  // Authorization is enforced by the isStaff() check above. Use the service
  // client for the write: the live expenses RLS has a restrictive UPDATE policy
  // that forbids setting deleted_at via the user client, which blocked staff
  // soft-delete (status updates kept deleted_at NULL and so were unaffected).
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id })
    .eq("id", expenseId);
  if (error) return { error: handleDbError(error, "softDeleteExpense") };

  revalidatePath("/expenses");
  return { ok: true };
}

export interface SaveOcrExpenseInput {
  receiptPath: string;
  agentId?: string | null;
  caseId?: string | null;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  expenseTime?: string | null;
  vendorName?: string | null;
  vatAmount?: number | null;
  receiptNumber?: string | null;
  notes?: string | null;
  ocrConfidence?: number | null;
  ocrRaw?: unknown;
}

export async function saveOcrExpense(
  input: SaveOcrExpenseInput,
): Promise<{ ok: true } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (profile.role === "client") return { error: "Not authorized" };

  const supabase = await createClient();
  const agentId = await resolveAgentId(
    supabase, profile,
    isStaff(profile.role) ? (input.agentId ?? undefined) : undefined,
  );

  const { error } = await supabase.from("expenses").insert({
    agent_id: agentId,
    case_id: input.caseId ?? null,
    category: input.category,
    amount: input.amount,
    expense_date: input.expenseDate,
    expense_time: input.expenseTime ?? null,
    receipt_url: input.receiptPath,
    vendor_name: input.vendorName ?? null,
    vat_amount: input.vatAmount ?? null,
    receipt_number: input.receiptNumber ?? null,
    notes: input.notes ?? null,
    source: "ocr",
    ocr_confidence: input.ocrConfidence ?? null,
    ocr_raw: (input.ocrRaw ?? null) as object | null,
    created_by: profile.id,
  });
  if (error) return { error: handleDbError(error, "saveOcrExpense") };

  revalidatePath("/expenses");
  return { ok: true };
}
