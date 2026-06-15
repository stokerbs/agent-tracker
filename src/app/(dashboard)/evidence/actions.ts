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
  });
  if (error) return { error: handleDbError(error, "evidence") };

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/evidence");
  return { ok: true };
}

/** Returns a short-lived signed URL for previewing/downloading evidence. */
export async function getEvidenceUrl(storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKETS.evidence)
    .createSignedUrl(storagePath, 60 * 10);
  if (error) return { error: handleDbError(error, "evidence") };
  return { url: data.signedUrl };
}
