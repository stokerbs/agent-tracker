"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { LEAD_STAGES, PAID_STAGES, legacyStatusFor } from "@/lib/marketing/zh/pipeline";

const money = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().min(0).max(1_000_000_000).nullable(),
);

const schema = z.object({
  id: z.string().uuid(),
  stage: z.enum(LEAD_STAGES),
  estimatedValue: money,
  quotedValue: money,
  finalRevenue: money,
  adminNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});

/**
 * Admin-only pipeline update for a marketing lead (docs/china-market/11).
 * Validates server-side, keeps the legacy `status` in sync with `stage`, stamps
 * `converted_at` the first time a lead reaches a paid stage, and audit-logs the
 * change (contact data is never written to the audit metadata).
 */
export async function updateLeadPipeline(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const profile = await requireRole(["admin"]);
  const parsed = schema.safeParse({
    id: formData.get("id"),
    stage: formData.get("stage"),
    estimatedValue: formData.get("estimatedValue"),
    quotedValue: formData.get("quotedValue"),
    finalRevenue: formData.get("finalRevenue"),
    adminNotes: formData.get("adminNotes"),
  });
  if (!parsed.success) return { error: "invalid_input" };
  const d = parsed.data;

  const supabase = await createClient(); // RLS: admin update policy
  const { data: current, error: readErr } = await supabase
    .from("marketing_leads")
    .select("stage, converted_at")
    .eq("id", d.id)
    .single();
  if (readErr || !current) return { error: "not_found" };

  const nowIso = new Date().toISOString();
  const stageChanged = current.stage !== d.stage;
  const becomesPaid = !current.converted_at && PAID_STAGES.includes(d.stage);
  const { error } = await supabase
    .from("marketing_leads")
    .update({
      stage: d.stage,
      status: legacyStatusFor(d.stage),
      ...(stageChanged ? { stage_changed_at: nowIso } : {}),
      ...(becomesPaid ? { converted_at: nowIso } : {}),
      estimated_value: d.estimatedValue,
      quoted_value: d.quotedValue,
      final_revenue: d.finalRevenue,
      admin_notes: d.adminNotes ? d.adminNotes : null,
    })
    .eq("id", d.id);
  if (error) return { error: error.message };

  await logAudit({
    actorId: profile.id,
    action: stageChanged ? "LEAD_STAGE_CHANGE" : "LEAD_PIPELINE_UPDATE",
    entity: "marketing_leads",
    entityId: d.id,
    metadata: { from: current.stage, to: d.stage, quoted_value: d.quotedValue, final_revenue: d.finalRevenue },
  });

  revalidatePath("/leads");
  return { ok: true };
}

/** Short-lived signed URL for an intake attachment (admin only; audited). */
export async function getLeadFileUrl(fileId: string): Promise<{ url: string } | { error: string }> {
  const profile = await requireRole(["admin"]);
  if (!z.string().uuid().safeParse(fileId).success) return { error: "invalid_input" };
  const supabase = await createClient(); // RLS: admin read policy on marketing_lead_files
  const { data: file } = await supabase.from("marketing_lead_files").select("id, lead_id, storage_path").eq("id", fileId).single();
  if (!file) return { error: "not_found" };
  const [bucket, ...rest] = file.storage_path.split("/");
  const svc = createServiceClient();
  const { data, error } = await svc.storage.from(bucket).createSignedUrl(rest.join("/"), 600);
  if (error || !data) return { error: "storage_error" };
  await logAudit({ actorId: profile.id, action: "LEAD_FILE_VIEW", entity: "marketing_lead_files", entityId: file.id, metadata: { lead_id: file.lead_id } });
  return { url: data.signedUrl };
}
