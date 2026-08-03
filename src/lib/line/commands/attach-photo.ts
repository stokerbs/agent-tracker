import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessage } from "@/lib/line/reply";
import { downloadLineContent } from "@/lib/line/content";
import { notifyCaseParticipants } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { BUCKETS } from "@/lib/constants";
import {
  FileValidationError,
  MAX_IMAGE_SIZE,
  validateImageUpload,
} from "@/lib/security/file-validation";
import {
  ATTACH_PHOTO_DOWNLOAD_FAILED,
  ATTACH_PHOTO_INVALID_TYPE,
  ATTACH_PHOTO_SUCCESS,
  ATTACH_PHOTO_UNAUTHORIZED,
  GENERIC_ERROR,
  RATE_LIMITED,
  formatAttachPhotoTooLarge,
} from "@/lib/line/messages";

/**
 * Handles a photo follow-up message from a linked agent within an open
 * pending-attachment window (Round 3). Wired up by src/lib/line/router.ts's
 * handleLineMediaMessage(), which guarantees:
 *   - `agentId` is an already-linked, already-verified agent.
 *   - `pendingCaseId`/`pendingEntryId` come straight off the caller's
 *     `line_accounts` row and are only evidence a window is open, NOT proof
 *     `agentId` is still authorized to write to `pendingCaseId` — this
 *     function re-checks `case_agents` membership below before touching
 *     Storage or the DB (same TOCTOU-awareness as add-timeline.ts / the read
 *     commands in shared.ts).
 *   - `messageId` is the LINE Content API message id, passed to
 *     downloadLineContent() (src/lib/line/content.ts) to fetch the raw image
 *     bytes + declared content-type.
 *
 * Flow: re-authorize -> download -> validate (type/size, via
 * src/lib/security/file-validation.ts's existing rules) -> upload to Storage
 * + insert the `evidence` row, mirroring
 * src/app/(dashboard)/evidence/actions.ts's uploadEvidence() convention ->
 * reply -> best-effort notifyCaseParticipants().
 *
 * validateImageUpload() is typed for a browser `File`. This handler builds
 * one from the downloaded Buffer using Node's global `File` (available in
 * this repo's Node runtime — the same pattern src/lib/native/native-camera.ts
 * and src/lib/security/file-validation.test.ts already rely on) so the
 * actual size/type/magic-number rules stay single-sourced in
 * file-validation.ts rather than being duplicated here.
 *
 * IMPORTANT — does NOT clear `line_accounts.pending_attachment_*` on
 * success. The window is intentionally reusable: an agent may send several
 * photos of the same observation, each producing its own `evidence` row
 * linked to the same `timeline_entry_id`. It is superseded naturally the
 * next time add-timeline.ts opens a new window for a new entry.
 */
export async function handleAttachPhotoCommand(
  agentId: string,
  pendingCaseId: string,
  pendingEntryId: string,
  messageId: string,
  replyToken: string,
): Promise<void> {
  const rl = await checkRateLimit("line_attach_photo", agentId);
  if (!rl.allowed) {
    console.warn(
      `[line:attach-photo] rate-limited agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId}`,
    );
    await replyLineMessage(replyToken, RATE_LIMITED);
    return;
  }

  const svc = createServiceClient();

  // 1. Re-authorize: the pending window alone is not proof of current
  // authorization — the case_agents assignment could have changed since the
  // window was opened.
  const { data: assignment, error: authError } = await svc
    .from("case_agents")
    .select("case_id")
    .eq("case_id", pendingCaseId)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (authError) {
    console.error(
      `[line:attach-photo] authorization-check-failed agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId}`,
      authError,
    );
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }

  if (!assignment) {
    // Generic, non-enumerating reply — never reveal why the attach failed.
    console.log(
      `[line:attach-photo] unauthorized agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId}`,
    );
    await replyLineMessage(replyToken, ATTACH_PHOTO_UNAUTHORIZED);
    return;
  }

  // 2. Download the photo bytes from LINE's Content API.
  const download = await downloadLineContent(messageId);
  if (!download.ok) {
    console.error(
      `[line:attach-photo] download-failed agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId} reason=${download.error}`,
    );
    await replyLineMessage(replyToken, ATTACH_PHOTO_DOWNLOAD_FAILED);
    return;
  }

  // 3. Validate type/size (+ magic-number check) using file-validation.ts's
  // existing rules, applied to a Node-global File built from the Buffer.
  // Wrapped in a fresh Uint8Array (a plain-array-like copy, not a view over
  // Buffer's ArrayBufferLike-typed backing store) so it satisfies the DOM
  // `BlobPart` type File/Blob expect.
  const file = new File(
    [new Uint8Array(download.data)],
    `line-photo.${extensionForContentType(download.contentType)}`,
    { type: download.contentType },
  );

  try {
    await validateImageUpload(file);
  } catch (err) {
    if (err instanceof FileValidationError) {
      // Never log raw image bytes — only size/mime/reason.
      console.log(
        `[line:attach-photo] validation-rejected agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId} size=${file.size} mime=${download.contentType} reason=${err.message}`,
      );
      await replyLineMessage(replyToken, replyForValidationError(err));
      return;
    }
    throw err;
  }

  // 4. Upload to Storage + insert the `evidence` row, mirroring
  // uploadEvidence()'s exact path/insert convention. LINE never sends a
  // filename, so the extension is derived from the validated content-type
  // instead of a `file.name` split.
  const id = crypto.randomUUID();
  const ext = extensionForContentType(download.contentType);
  const path = `${pendingCaseId}/${id}.${ext}`;
  const fileName = `line-photo-${id}.${ext}`;

  const { error: uploadError } = await svc.storage
    .from(BUCKETS.evidence)
    .upload(path, file, { contentType: download.contentType, upsert: false });

  if (uploadError) {
    console.error(
      `[line:attach-photo] storage-upload-failed agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId}`,
      uploadError,
    );
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }

  // `evidence.uploaded_by` references `profiles(id)`, but this webhook only
  // has `agents.id` — there is no Supabase Auth session/profile here.
  // Resolve the linked agent's optional profile_id (agents.profile_id, a
  // nullable 1:1 FK) via a cheap indexed primary-key lookup so evidence
  // attribution stays consistent with the dashboard's own uploadEvidence()
  // path, rather than always leaving uploaded_by null. Falls back to null
  // (the column is nullable / ON DELETE SET NULL) if the agent has no linked
  // profile or the lookup fails — this never blocks the already-succeeded
  // Storage upload.
  const { data: agentRow, error: agentLookupError } = await svc
    .from("agents")
    .select("profile_id")
    .eq("id", agentId)
    .maybeSingle();

  if (agentLookupError) {
    console.error(
      `[line:attach-photo] agent-profile-lookup-failed agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId}`,
      agentLookupError,
    );
  }
  const uploadedBy = agentRow?.profile_id ?? null;

  const { error: insertError } = await svc.from("evidence").insert({
    case_id: pendingCaseId,
    type: "photo",
    category: null,
    storage_path: path,
    file_name: fileName,
    file_size: file.size,
    mime_type: download.contentType,
    notes: null,
    uploaded_by: uploadedBy,
    timeline_entry_id: pendingEntryId,
  });

  if (insertError) {
    // Matches uploadEvidence()'s own convention: a Storage-write-then-DB-
    // insert failure is logged; the (now orphaned) Storage object is not
    // swept here, same as that reference implementation.
    console.error(
      `[line:attach-photo] evidence-insert-failed agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId} storagePath=${path}`,
      insertError,
    );
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }

  console.log(
    `[line:attach-photo] attached agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId} size=${file.size} mime=${download.contentType}`,
  );

  // 5. Reply with success. Deliberately does NOT touch
  // `pending_attachment_*` — see module doc above: the window stays open so
  // multiple photos can attach to the same entry.
  await replyLineMessage(replyToken, ATTACH_PHOTO_SUCCESS);

  // 6. Best-effort notification, mirroring uploadEvidence()'s own
  // notifyCaseParticipants() call. Never blocks the reply above (already
  // sent) — notifyCaseParticipants() itself never throws (see
  // src/lib/notifications.ts's module doc).
  await notifyCaseParticipants(pendingCaseId, {
    type: "case",
    title: "New evidence uploaded",
    body: "A new photo was added to the case via LINE.",
    exclude: uploadedBy ?? undefined,
    includeClient: false,
  });
}

/** ALLOWED_IMAGE_TYPES's three accepted MIME types, mapped to a storage-path
 * file extension. Falls back to "jpg" for any (validation-should-be-
 * unreachable) unmapped type rather than throwing this late in the flow. */
const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extensionForContentType(contentType: string): string {
  return IMAGE_EXTENSION_BY_MIME[contentType] ?? "jpg";
}

/**
 * Maps a FileValidationError thrown by validateImageUpload() (see
 * src/lib/security/file-validation.ts) to the specific LINE-facing
 * rejection reply. String-matched against that function's own error
 * messages rather than duplicating its size/type/empty-file logic here — if
 * those messages ever change, this mapping needs a matching update. Falls
 * back to the generic "unsupported file type" reply for the empty-file and
 * magic-number-mismatch cases too: neither reads meaningfully differently
 * from "this isn't a valid photo" to an agent.
 */
function replyForValidationError(err: FileValidationError): string {
  if (err.message === "File exceeds maximum size.") {
    return formatAttachPhotoTooLarge(Math.floor(MAX_IMAGE_SIZE / (1024 * 1024)));
  }
  return ATTACH_PHOTO_INVALID_TYPE;
}
