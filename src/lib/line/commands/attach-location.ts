import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { replyLineMessage } from "@/lib/line/reply";
import {
  ATTACH_LOCATION_UNAUTHORIZED,
  GENERIC_ERROR,
  RATE_LIMITED,
  formatAttachLocationSuccess,
} from "@/lib/line/messages";

/**
 * Handles a shared-location follow-up message from a linked agent within an
 * open pending-attachment window (Round 3, real implementation). Wired up by
 * src/lib/line/router.ts's handleLineMediaMessage(), which guarantees:
 *   - `agentId` is an already-linked, already-verified agent (same guarantee
 *     handleAddTimelineEntryCommand() gets) — never re-derived from the LINE
 *     payload.
 *   - `pendingCaseId`/`pendingEntryId` come straight off the caller's
 *     `line_accounts` row and have already been confirmed to be set with
 *     `pending_attachment_expires_at` still in the future — but that is ONLY
 *     evidence the window is open, NOT proof `agentId` is still authorized to
 *     write to `pendingCaseId`. This function re-checks `case_agents`
 *     membership for (agentId, pendingCaseId) fresh, at attach time, before
 *     writing anything — same TOCTOU-awareness principle as
 *     add-timeline.ts/attach-photo.ts. `pendingCaseId` is never trusted alone.
 *   - `latitude`/`longitude` are the raw numeric fields off LINE's location
 *     webhook event — validated here, not upstream (the router's type guard
 *     only ensures they're `number`s, not that they're in-range). `address`
 *     is LINE's optional human-readable `address`/`title` field (already
 *     resolved with the title fallback by route.ts; null if LINE supplied
 *     neither).
 *
 * Storage model: `timeline_entries.location` is a plain `text` column (see
 * supabase/migrations/0001_initial_schema.sql) — this command writes to it
 * exclusively. `timeline_entries.lat`/`lng` columns exist in the schema but
 * are legacy/unused by every write path in this app (see add-timeline.ts's
 * module doc); this command does NOT populate them, by design.
 *
 * Location-text vs. Maps-link design decision: this command stores ONLY a
 * clean, human-readable string in `location` (LINE's `address`, or a
 * formatted coordinate fallback) — it deliberately does NOT embed a
 * "(Maps: <url>)" suffix into the stored value itself, even though
 * src/app/(dashboard)/timeline/actions.ts's MAP_LINK_RULE describes that
 * exact suffix format. That format is always synthesized FRESH at
 * report-generation/render time by calling that file's mapsSearchLink()
 * directly on the raw `location` text (see its `timelineText` prompt-building
 * and `locationsByEntry()`) — every other location value in this app (e.g.
 * dashboard-entered ones) flows through that same clean-text convention. If
 * this command instead persisted its own embedded "(Maps: <url>)" suffix,
 * every downstream mapsSearchLink(e.location) call would re-encode that
 * ALREADY-suffixed string as a NEW search query, corrupting the report's
 * location links (double-nested/garbled URLs) — a real regression, not a
 * cosmetic one, since AI report generation parses/preserves that exact
 * pattern via cleanObs()'s regex. Storing plain text keeps this command a
 * drop-in participant in that existing, app-wide pipeline.
 *
 * The "build the maps link from the actual lat/lng, more precise than a
 * re-geocoded address" requirement is instead satisfied in the CHAT REPLY
 * only (formatAttachLocationSuccess()): its Google Maps link is built
 * directly from the raw, precise `latitude`/`longitude` LINE reported, giving
 * the agent an instant, precise confirmation link, entirely decoupled from
 * the dashboard/report pipeline's own text-based mapsSearchLink() rendering.
 *
 * IMPORTANT — a second location message overwriting the first is ACCEPTABLE
 * / EXPECTED behavior, not a bug to guard against. Unlike photos (which can
 * accumulate as multiple `evidence` rows), `timeline_entries.location` is a
 * single text field — the entry can only ever hold "the latest location the
 * agent shared for this window." No special-case clearing/single-use logic
 * belongs here; a later UPDATE naturally replaces an earlier one.
 *
 * Does NOT clear `line_accounts.pending_attachment_*` on success — the
 * window stays open (an agent may still send a photo after the location, or
 * vice versa). It is superseded only when add-timeline.ts opens a new window
 * for a new entry.
 */

const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

/**
 * Decimal places for the coordinate-fallback display text (used when LINE
 * supplied no address/title). 5 decimal places (~1.1m of precision at the
 * equator) matches this codebase's established convention for
 * agent-shared-location display everywhere else (e.g.
 * src/components/field/field-client.tsx's own "share my location" flow,
 * src/lib/gps903/*, src/lib/cases/chat-context.ts) — plenty of precision for
 * a field observation without an absurdly long string.
 */
const COORDINATE_DISPLAY_PRECISION = 5;

/**
 * Sanity-floor validation for LINE's raw location payload. The router's type
 * guard (src/app/api/line/webhook/route.ts) already ensures these are
 * `number`s before this function is ever called, so this is a defense-in-
 * depth floor against NaN/Infinity/out-of-range values, not the primary
 * defense — "never trust client-side validation" applies even to a payload
 * LINE's own app should only ever send as a real, in-range location share.
 */
function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= MIN_LATITUDE &&
    lat <= MAX_LATITUDE &&
    lng >= MIN_LONGITUDE &&
    lng <= MAX_LONGITUDE
  );
}

function formatCoordinateFallback(lat: number, lng: number): string {
  return `${lat.toFixed(COORDINATE_DISPLAY_PRECISION)}, ${lng.toFixed(COORDINATE_DISPLAY_PRECISION)}`;
}

/**
 * Mirrors mapsSearchLink() in src/app/(dashboard)/timeline/actions.ts
 * exactly (same URL shape) — kept as a local one-liner rather than importing
 * that "use server" actions module from this webhook handler, to avoid
 * coupling a Server Actions file into a non-Next.js-request execution
 * context. The URL format itself must not diverge: it mirrors what that
 * file's own reports/UI already expect a Google Maps search link to look
 * like. Built from the raw lat/lng (not from any address text) so the link
 * is always maximally precise, independent of geocoding.
 */
function mapsLinkFromCoords(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export async function handleAttachLocationCommand(
  agentId: string,
  pendingCaseId: string,
  pendingEntryId: string,
  latitude: number,
  longitude: number,
  address: string | null,
  replyToken: string,
): Promise<void> {
  if (!isValidCoordinate(latitude, longitude)) {
    // Never let a malformed/out-of-range webhook payload silently corrupt a
    // case's location field — reject and log server-side (coordinates only,
    // not the address text, which may carry a client-supplied free-text
    // place name).
    console.error(
      `[line:attach-location] invalid-coordinates agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId}`,
    );
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }

  const rl = await checkRateLimit("line_attach_location", agentId);
  if (!rl.allowed) {
    console.warn(`[line:attach-location] rate-limited agentId=${agentId}`);
    await replyLineMessage(replyToken, RATE_LIMITED);
    return;
  }

  const svc = createServiceClient();

  // Re-authorize (TOCTOU-awareness): pendingCaseId is only evidence a window
  // is open, never proof agentId is still assigned to that case — the
  // case_agents assignment could have changed between entry creation and
  // this follow-up message arriving. Re-check fresh, same principle as
  // add-timeline.ts's case resolution and attach-photo.ts's module doc.
  const { data: membership, error: membershipError } = await svc
    .from("case_agents")
    .select("case_id")
    .eq("case_id", pendingCaseId)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (membershipError) {
    console.error(
      `[line:attach-location] membership-check-failed agentId=${agentId} caseId=${pendingCaseId}`,
      membershipError,
    );
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }
  if (!membership) {
    console.log(
      `[line:attach-location] not-authorized agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId}`,
    );
    await replyLineMessage(replyToken, ATTACH_LOCATION_UNAUTHORIZED);
    return;
  }

  const trimmedAddress = address?.trim() || null;
  const locationText = trimmedAddress ?? formatCoordinateFallback(latitude, longitude);

  // Belt-and-suspenders (mirrors uploadEvidence()'s pattern in
  // src/app/(dashboard)/evidence/actions.ts): the UPDATE's WHERE clause
  // itself re-verifies, atomically with the write, that the target row still
  // belongs to pendingCaseId AND is still authored by this agentId (the same
  // ownership constraint the "timeline_agent_update_own" RLS policy — see
  // supabase/migrations/0106_timeline_agent_update_own.sql — enforces for an
  // authenticated session; there is no session here, so it's replicated in
  // application code) AND is not soft-deleted. A mismatch on any of these
  // means 0 rows affected, never a blind overwrite of an unrelated row.
  const { data: updated, error: updateError } = await svc
    .from("timeline_entries")
    .update({ location: locationText })
    .eq("id", pendingEntryId)
    .eq("case_id", pendingCaseId)
    .eq("agent_id", agentId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error(
      `[line:attach-location] update-failed agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId}`,
      updateError,
    );
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }
  if (!updated) {
    // Should be effectively unreachable given the membership check just
    // passed and pendingEntryId/pendingCaseId came from this same agent's
    // own line_accounts row — logged as an error (not a normal not-found
    // path) since it indicates an unexpected inconsistency, not routine user
    // input.
    console.error(
      `[line:attach-location] entry-not-found-or-mismatched agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId}`,
    );
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }

  // Coordinates are logged only at reduced precision — sufficient to debug
  // dispatch without pinpointing an exact real-world location in logs.
  console.log(
    `[line:attach-location] updated agentId=${agentId} caseId=${pendingCaseId} entryId=${pendingEntryId} ` +
      `hasAddress=${Boolean(trimmedAddress)} approxLat=${latitude.toFixed(2)} approxLng=${longitude.toFixed(2)}`,
  );

  const mapsUrl = mapsLinkFromCoords(latitude, longitude);
  await replyLineMessage(replyToken, formatAttachLocationSuccess(locationText, mapsUrl));
}
