"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { BUCKETS } from "@/lib/constants";
/** Pre-built Google Maps link for a coordinate (evidence note). */
function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

const attachSchema = z.object({
  analysisId: z.string().uuid(),
  caseId: z.string().uuid(),
});

export type AttachResult = { ok: true; evidenceId: string } | { ok: false; error: string };

/**
 * Attach a completed OSINT image analysis to a case as evidence, and drop a
 * timeline entry. Authorization is enforced in application code first
 * (requireStaff + the caller must be able to READ this analysis and ACCESS the
 * target case, both checked via the RLS-scoped client), then the writes run
 * through the service client — mirroring the project pattern where a restrictive
 * dashboard policy can otherwise block a legitimate staff insert.
 */
export async function attachToCase(input: unknown): Promise<AttachResult> {
  const profile = await requireStaff();

  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { analysisId, caseId } = parsed.data;

  const rls = await createClient();

  // 1. Caller must be able to access the target case (RLS-scoped read).
  const { data: caseRow, error: caseErr } = await rls
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .maybeSingle();
  if (caseErr) return { ok: false, error: "Case lookup failed" };
  if (!caseRow) return { ok: false, error: "Case not found or not accessible" };

  // 2. Caller must be able to read this analysis (RLS: creator | admin | case).
  const { data: analysis, error: aErr } = await rls
    .from("image_analysis")
    .select("id, storage_path, mime, filesize, status")
    .eq("id", analysisId)
    .maybeSingle();
  if (aErr) return { ok: false, error: "Analysis lookup failed" };
  if (!analysis) return { ok: false, error: "Analysis not found or not accessible" };
  if (analysis.status !== "complete") return { ok: false, error: "Analysis is not complete yet" };
  if (!analysis.storage_path) return { ok: false, error: "Analysis has no stored image" };

  const svc = createServiceClient();

  // 3. Pull sha256 + report summary + GPS for the evidence note (best-effort).
  const [{ data: hashRow }, { data: reportRow }, { data: metaRow }] = await Promise.all([
    svc.from("image_hashes").select("sha256").eq("analysis_id", analysisId).maybeSingle(),
    svc.from("image_reports").select("summary").eq("analysis_id", analysisId).maybeSingle(),
    svc.from("image_metadata").select("gps_lat, gps_lng").eq("analysis_id", analysisId).maybeSingle(),
  ]);

  // 4. Copy the stored bytes into the case's evidence folder so existing
  //    case-scoped evidence storage RLS (folder = case_id) grants access.
  const mime = (analysis.mime as string) ?? "image/jpeg";
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const destPath = `${caseId}/osint/${analysisId}.${ext}`;

  const { data: file, error: dlErr } = await svc.storage
    .from(BUCKETS.evidence)
    .download(analysis.storage_path as string);
  if (dlErr || !file) return { ok: false, error: "Could not read stored image" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await svc.storage
    .from(BUCKETS.evidence)
    .upload(destPath, bytes, { contentType: mime, upsert: true });
  if (upErr) return { ok: false, error: "Could not copy image into the case" };

  // 5. Insert the evidence row.
  const gps =
    metaRow?.gps_lat != null && metaRow?.gps_lng != null
      ? ` · GPS: ${googleMapsUrl(metaRow.gps_lat as number, metaRow.gps_lng as number)}`
      : "";
  const noteParts = [
    "OSINT image analysis",
    hashRow?.sha256 ? `sha256:${(hashRow.sha256 as string).slice(0, 16)}…` : null,
    (reportRow?.summary as string) ?? null,
  ].filter(Boolean);

  const { data: evidence, error: evErr } = await svc
    .from("evidence")
    .insert({
      case_id: caseId,
      type: "photo",
      category: "OSINT",
      storage_path: destPath,
      file_name: `osint-${analysisId}.${ext}`,
      file_size: (analysis.filesize as number) ?? bytes.length,
      mime_type: mime,
      notes: `${noteParts.join(" · ")}${gps}`,
      uploaded_by: profile.id,
    })
    .select("id")
    .single();
  if (evErr || !evidence) return { ok: false, error: "Could not create evidence record" };

  // 6. Link the analysis to the case + drop a timeline entry (both best-effort
  //    after the evidence row, which is the source of truth for the attach).
  await svc.from("image_analysis").update({ case_id: caseId }).eq("id", analysisId);
  await svc.from("timeline_entries").insert({
    case_id: caseId,
    entry: `OSINT image intelligence attached to case${
      hashRow?.sha256 ? ` (sha256:${(hashRow.sha256 as string).slice(0, 12)}…)` : ""
    }`,
  });

  await logAudit({
    actorId: profile.id,
    action: "OSINT_IMAGE_ATTACH",
    entity: "evidence",
    entityId: evidence.id as string,
    metadata: { analysis_id: analysisId, case_id: caseId },
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/evidence");
  return { ok: true, evidenceId: evidence.id as string };
}
