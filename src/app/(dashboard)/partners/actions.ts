"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { handleDbError } from "@/lib/errors";
import { PARTNER_STAGES } from "@/lib/marketing/zh/partner-pipeline";

const schema = z.object({
  id: z.string().uuid(),
  stage: z.enum(PARTNER_STAGES),
  adminNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});

/** Admin-only partner pipeline update (stage + notes), audited without contact data. */
export async function updatePartner(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const profile = await requireRole(["admin"]);
  const parsed = schema.safeParse({ id: formData.get("id"), stage: formData.get("stage"), adminNotes: formData.get("adminNotes") });
  if (!parsed.success) return { error: "invalid_input" };
  const d = parsed.data;

  const supabase = await createClient(); // RLS: admin update policy
  const { data: current, error: readErr } = await supabase.from("marketing_partners").select("stage").eq("id", d.id).single();
  if (readErr || !current) return { error: "not_found" };

  const stageChanged = current.stage !== d.stage;
  const { error } = await supabase
    .from("marketing_partners")
    .update({
      stage: d.stage,
      ...(stageChanged ? { stage_changed_at: new Date().toISOString() } : {}),
      admin_notes: d.adminNotes ? d.adminNotes : null,
    })
    .eq("id", d.id);
  if (error) return { error: handleDbError(error, "partners:update") };

  await logAudit({
    actorId: profile.id,
    action: stageChanged ? "PARTNER_STAGE_CHANGE" : "PARTNER_UPDATE",
    entity: "marketing_partners",
    entityId: d.id,
    metadata: { from: current.stage, to: d.stage },
  });
  revalidatePath("/partners");
  return { ok: true };
}
