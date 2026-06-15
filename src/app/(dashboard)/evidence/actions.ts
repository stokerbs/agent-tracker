"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { BUCKETS } from "@/lib/constants";
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
 */
export async function uploadEvidence(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  const supabase = await createClient();

  const caseId = String(formData.get("case_id") ?? "");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${caseId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKETS.evidence)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: upErr.message };

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
  if (error) return { error: error.message };

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
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
