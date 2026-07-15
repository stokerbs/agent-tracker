"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const attachSchema = z.object({
  analysisId: z.string().uuid(),
  caseId: z.string().uuid(),
});

export type AttachResult = { ok: true } | { ok: false; error: string };

/**
 * Attach a contact lookup to a case: link the analysis and drop a timeline entry.
 * (No evidence row — a contact lookup produces data, not a file.) Authorization
 * is enforced in app code (requireStaff + RLS case-access + analysis read) before
 * the service-role writes.
 */
export async function attachContactToCase(input: unknown): Promise<AttachResult> {
  const profile = await requireStaff();

  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { analysisId, caseId } = parsed.data;

  const rls = await createClient();

  const { data: caseRow, error: caseErr } = await rls.from("cases").select("id").eq("id", caseId).maybeSingle();
  if (caseErr) return { ok: false, error: "Case lookup failed" };
  if (!caseRow) return { ok: false, error: "Case not found or not accessible" };

  const { data: analysis, error: aErr } = await rls
    .from("contact_analysis")
    .select("id, input_type, status")
    .eq("id", analysisId)
    .maybeSingle();
  if (aErr) return { ok: false, error: "Analysis lookup failed" };
  if (!analysis) return { ok: false, error: "Analysis not found or not accessible" };

  const svc = createServiceClient();
  await svc.from("contact_analysis").update({ case_id: caseId }).eq("id", analysisId);
  await svc.from("timeline_entries").insert({
    case_id: caseId,
    entry: `OSINT contact lookup (${analysis.input_type}) attached to case`,
  });

  await logAudit({
    actorId: profile.id,
    action: "CONTACT_ATTACH",
    entity: "contact_analysis",
    entityId: analysisId,
    metadata: { case_id: caseId, input_type: analysis.input_type },
  });

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
