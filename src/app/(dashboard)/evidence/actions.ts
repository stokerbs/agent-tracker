"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff, requireProfile } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { notifyCaseParticipants } from "@/lib/notifications";
import { BUCKETS } from "@/lib/constants";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  FileValidationError,
  validateDocumentUpload,
  validateImageUpload,
  validateVideoUpload,
} from "@/lib/security/file-validation";
import type { EvidenceType } from "@/lib/types";

function detectType(mime: string): EvidenceType {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Uploads an evidence file to Supabase Storage and records the metadata row.
 * The file is sent as part of multipart FormData.
 *
 * Assignment is validated against the database BEFORE any Storage write so
 * that a failed authorization check never leaves an orphaned Storage object.
 */
export async function uploadEvidence(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };

  if (profile.role === "client") return { error: "Not authorized" };

  const supabase = await createClient();

  const caseId = String(formData.get("case_id") ?? "");
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  // Validate type and size BEFORE any authorization DB query or Storage write.
  try {
    if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      await validateImageUpload(file);
    } else if ((ALLOWED_VIDEO_TYPES as readonly string[]).includes(file.type)) {
      await validateVideoUpload(file);
    } else {
      // validateDocumentUpload rejects anything that is not application/pdf.
      await validateDocumentUpload(file);
    }
  } catch (err) {
    if (err instanceof FileValidationError) return { error: err.message };
    throw err;
  }

  // Validate case assignment before touching Storage.
  // Staff may upload to any case; agents only to cases they are assigned to.
  if (!isStaff(profile.role)) {
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!agent) return { error: "No agent profile linked to this account" };

    const { data: assignment } = await supabase
      .from("case_agents")
      .select("case_id")
      .eq("case_id", caseId)
      .eq("agent_id", agent.id)
      .maybeSingle();

    if (!assignment) return { error: "Not assigned to this case" };
  }

  const timelineEntryId = String(formData.get("timeline_entry_id") ?? "").trim() || null;

  // Belt-and-suspenders: if a timeline_entry_id is supplied, verify it belongs
  // to the same case before touching Storage (RLS enforces the same constraint).
  if (timelineEntryId) {
    const { data: te } = await supabase
      .from("timeline_entries")
      .select("case_id")
      .eq("id", timelineEntryId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!te || te.case_id !== caseId) return { error: "Invalid timeline entry reference" };
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${caseId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKETS.evidence)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: handleDbError(upErr, "uploadEvidence:storage") };

  const { error } = await supabase.from("evidence").insert({
    case_id: caseId,
    type: detectType(file.type),
    category: String(formData.get("category") ?? "") || null,
    storage_path: path,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
    notes: String(formData.get("notes") ?? "") || null,
    uploaded_by: profile.id,
    timeline_entry_id: timelineEntryId,
  });
  if (error) return { error: handleDbError(error, "evidence") };

  // Notify the rest of the case team (not the uploader, not the client).
  after(() => notifyCaseParticipants(caseId, {
    type: "case",
    title: "New evidence uploaded",
    body: `${file.name} was added to the case.`,
    exclude: profile.id,
    includeClient: false,
  }));

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/evidence");
  return { ok: true };
}

/** Hard-delete evidence (admin only) — removes Storage object + DB row + audit log. */
export async function deleteEvidence(id: string) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { error: "Admins only" };
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("evidence")
    .select("storage_path, case_id, file_name")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Evidence not found" };

  // Delete Storage object first; if it fails the DB row is left intact.
  await supabase.storage.from(BUCKETS.evidence).remove([row.storage_path]);

  const { error } = await supabase.from("evidence").delete().eq("id", id);
  if (error) return { error: handleDbError(error, "evidence") };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "hard_delete",
    entity: "evidence",
    entity_id: id,
    metadata: { file_name: row.file_name, case_id: row.case_id },
  });

  revalidatePath(`/cases/${row.case_id}`);
  revalidatePath("/evidence");
  return { ok: true };
}

/** Returns a short-lived signed URL for previewing/downloading evidence. */
export async function getEvidenceUrl(storagePath: string) {
  await requireProfile();
  const supabase = await createClient();

  // Verify the caller has table-level access to this specific evidence record
  // before generating a signed URL. Evidence table RLS enforces case assignment,
  // so this query succeeds only for rows the caller is permitted to read.
  const { data: row } = await supabase
    .from("evidence")
    .select("id")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (!row) return { error: "Evidence not found" };

  const { data, error } = await supabase.storage
    .from(BUCKETS.evidence)
    .createSignedUrl(storagePath, 60 * 10);
  if (error) return { error: handleDbError(error, "evidence") };
  return { url: data.signedUrl };
}
