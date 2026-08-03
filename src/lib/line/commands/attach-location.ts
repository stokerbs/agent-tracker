import "server-only";

import { replyLineMessage } from "@/lib/line/reply";
import { ATTACH_LOCATION_STUB } from "@/lib/line/messages";

/**
 * STUB — handles a shared-location follow-up message from a linked agent
 * within an open pending-attachment window (Round 3 infra wiring). Wired up
 * by src/lib/line/router.ts's handleLineMediaMessage(), which guarantees:
 *   - `agentId` is an already-linked, already-verified agent (same
 *     guarantee handleAddTimelineEntryCommand() gets).
 *   - `pendingCaseId`/`pendingEntryId` come straight off the caller's
 *     `line_accounts` row and have already been confirmed to be set with
 *     `pending_attachment_expires_at` still in the future — but that is
 *     ONLY evidence the window is open, NOT proof `agentId` is still
 *     authorized to write to `pendingCaseId`. The real implementation MUST
 *     re-check `case_agents` membership for (agentId, pendingCaseId) before
 *     writing anything — same TOCTOU-awareness note as
 *     src/lib/line/commands/attach-photo.ts. Never trust `pendingCaseId`
 *     alone.
 *   - `latitude`/`longitude` are the raw numeric fields off LINE's location
 *     webhook event; `address` is LINE's optional human-readable
 *     `address`/`title` field (null if LINE didn't supply one).
 *
 * NOT YET IMPLEMENTED (next engineer's scope):
 *   1. Re-authorize: query `case_agents` for (case_id = pendingCaseId,
 *      agent_id = agentId); bail out (generic reply, no leak) if absent.
 *   2. Validate `latitude`/`longitude` are within valid ranges (-90..90 /
 *      -180..180) and have reasonable precision — LINE's payload is
 *      client-supplied and must never be trusted blindly, same "never trust
 *      client-side validation" rule as everywhere else in this codebase.
 *   3. Decide a text representation to store: `timeline_entries.location`
 *      is a plain `text` column (confirmed unused by any lat/lng-specific
 *      write path elsewhere in this app — see add-timeline.ts's module doc,
 *      which deliberately leaves `location` null for Round 2). No lat/lng
 *      columns exist to write to directly. Use LINE's `address` (or
 *      `title`) when present, else fall back to a formatted coordinate
 *      string. src/app/(dashboard)/timeline/actions.ts's mapsSearchLink()
 *      helper (used to render a Google Maps search link from a location
 *      string elsewhere in the dashboard) may be a useful reference for
 *      keeping the stored format consistent with how the dashboard already
 *      displays/links locations.
 *   4. UPDATE the `timeline_entries` row (`id = pendingEntryId`) — but only
 *      after re-verifying (belt-and-suspenders, mirroring
 *      uploadEvidence()'s pattern in
 *      src/app/(dashboard)/evidence/actions.ts) that the entry still
 *      belongs to `pendingCaseId`.
 *   5. Reply with a real success/failure message (add to messages.ts,
 *      replacing ATTACH_LOCATION_STUB).
 *
 * IMPORTANT — a second location message overwriting the first is ACCEPTABLE
 * / EXPECTED behavior, not a bug to guard against. Unlike photos (which can
 * accumulate as multiple `evidence` rows), `timeline_entries.location` is a
 * single text field — the entry can only ever hold "the latest location the
 * agent shared for this window." No special-case clearing/single-use logic
 * belongs here; just let a later UPDATE naturally replace an earlier one.
 *
 * This stub does NOT touch the DB at all — it only replies with a
 * placeholder acknowledging the location was received.
 */
export async function handleAttachLocationCommand(
  agentId: string,
  pendingCaseId: string,
  pendingEntryId: string,
  latitude: number,
  longitude: number,
  address: string | null,
  replyToken: string,
): Promise<void> {
  console.log(
    `[line:attach-location] stub-received agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId} hasAddress=${Boolean(address)}`,
  );
  // Coordinates are logged only at reduced precision — sufficient to debug
  // dispatch without pinpointing an exact real-world location in logs.
  console.log(
    `[line:attach-location] approx-coords lat=${latitude.toFixed(2)} lng=${longitude.toFixed(2)}`,
  );
  await replyLineMessage(replyToken, ATTACH_LOCATION_STUB);
}
