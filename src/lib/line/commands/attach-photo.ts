import "server-only";

import { replyLineMessage } from "@/lib/line/reply";
import { ATTACH_PHOTO_STUB } from "@/lib/line/messages";

/**
 * STUB — handles a photo follow-up message from a linked agent within an
 * open pending-attachment window (Round 3 infra wiring). Wired up by
 * src/lib/line/router.ts's handleLineMediaMessage(), which guarantees:
 *   - `agentId` is an already-linked, already-verified agent (same
 *     guarantee handleAddTimelineEntryCommand() gets — never re-derive it
 *     from the LINE payload).
 *   - `pendingCaseId`/`pendingEntryId` come straight off the caller's
 *     `line_accounts` row (`pending_attachment_case_id` /
 *     `pending_attachment_entry_id`) and have already been confirmed to be
 *     set with `pending_attachment_expires_at` still in the future — but
 *     that is ONLY evidence the window is open, NOT proof `agentId` is
 *     still authorized to write to `pendingCaseId`. The real implementation
 *     MUST re-check `case_agents` membership for (agentId, pendingCaseId)
 *     before touching Storage or the DB — the case_agents assignment could
 *     have changed in the time between entry creation and this follow-up
 *     message arriving (same TOCTOU-awareness already established for the
 *     read commands in src/lib/line/commands/shared.ts and reinforced by
 *     Round 2's security review of add-timeline.ts). Never trust
 *     `pendingCaseId` alone.
 *   - `messageId` is the LINE Content API message id (`message.id` off the
 *     inbound image webhook event) — pass it to
 *     downloadLineContent(messageId) (src/lib/line/content.ts) to fetch the
 *     raw image bytes + declared content-type.
 *
 * NOT YET IMPLEMENTED (next engineer's scope):
 *   1. Re-authorize: query `case_agents` for (case_id = pendingCaseId,
 *      agent_id = agentId); bail out (generic reply, no leak) if absent.
 *   2. Download the bytes via downloadLineContent(messageId).
 *   3. Validate type/size using this repo's existing conventions in
 *      src/lib/security/file-validation.ts (ALLOWED_IMAGE_TYPES /
 *      MAX_IMAGE_SIZE / validateImageUpload) — note validateImageUpload()
 *      is typed to accept a browser `File`, but this handler only has a
 *      `Buffer` + a content-type string (no `File` exists in this webhook's
 *      runtime). Decide whether to adapt file-validation.ts's checks to
 *      operate on a Buffer+contentType directly, or construct a
 *      `File`-like wrapper (e.g. via the `Blob`/`File` globals available in
 *      the Next.js Node runtime) — flagged here as a decision point, not
 *      solved by this stub.
 *   4. Upload to storage + insert the `evidence` row, mirroring the exact
 *      convention already established by
 *      src/app/(dashboard)/evidence/actions.ts's uploadEvidence(): a
 *      case-id-prefixed storage path in BUCKETS.evidence
 *      (`${caseId}/${crypto.randomUUID()}.${ext}`), an `evidence` insert
 *      with `type: "photo"`, `case_id: pendingCaseId`,
 *      `timeline_entry_id: pendingEntryId`, `storage_path`, `file_name`,
 *      `file_size`, `mime_type`, `uploaded_by` (note: this webhook has no
 *      `profiles.id`/session — decide what, if anything, populates
 *      `uploaded_by` here; uploadEvidence() uses the authenticated
 *      profile's id, which does not exist in this context).
 *   5. Reply with a real success/failure message (add to messages.ts,
 *      replacing ATTACH_PHOTO_STUB) — likely also a best-effort
 *      notifyCaseParticipants() call, mirroring uploadEvidence()'s pattern.
 *
 * IMPORTANT — do NOT clear `line_accounts.pending_attachment_*` after a
 * successful attach. The window is intentionally reusable: an agent may
 * send several photos of the same observation, each producing its own
 * `evidence` row linked to the same `timeline_entry_id`. It is superseded
 * naturally the next time add-timeline.ts opens a new window for a new
 * entry — no explicit clearing/consumption logic belongs here.
 *
 * This stub does NOT touch the DB or Storage at all — it only replies with a
 * placeholder acknowledging the photo was received.
 */
export async function handleAttachPhotoCommand(
  agentId: string,
  pendingCaseId: string,
  pendingEntryId: string,
  messageId: string,
  replyToken: string,
): Promise<void> {
  console.log(
    `[line:attach-photo] stub-received agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId} messageId=${messageId}`,
  );
  await replyLineMessage(replyToken, ATTACH_PHOTO_STUB);
}
