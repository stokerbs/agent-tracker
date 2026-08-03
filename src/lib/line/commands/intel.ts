import "server-only";

import { replyLineMessage } from "@/lib/line/reply";
import { INTEL_COMMAND_STUB } from "@/lib/line/messages";

/**
 * STUB — Round 4 wiring only. Handles the "target intelligence" LINE-bot
 * command (e.g. "ข่าวกรอง <รหัสเคส>" / "intel <case>"), wired up by
 * src/lib/line/router.ts's parseCommand()/handleLineMessage(), which
 * guarantees `agentId` is an already-linked, already-verified agent before
 * this is ever called — same contract as every other command handler in
 * this directory. `caseNumber` is raw, unvalidated user text, exactly as
 * handed to findAuthorizedCaseByNumber() by case.ts/timeline.ts/
 * add-timeline.ts.
 *
 * This command is the highest-sensitivity surface this bot has exposed:
 * unlike the brief `เคส` (case) summary, the real implementation will
 * return curated target-profile fields plus child-table intel (vehicles,
 * locations, relationships, photos) for a case. Below is the handoff
 * contract the engineer implementing the real logic MUST follow — nothing
 * below is implemented yet; this function currently does no DB access at
 * all and only replies with a temporary placeholder.
 *
 * ── Authorization (do this FIRST, before touching anything else) ──────────
 * Reuse findAuthorizedCaseByNumber() from src/lib/line/commands/shared.ts —
 * the exact same case_agents-membership check every other command in this
 * bot uses (agent must have a case_agents row for the case; no admin/
 * supervisor blanket-access bypass in this webhook context — see shared.ts's
 * module doc for why RLS itself can't be relied on here). "No such case" and
 * "case exists but this agent isn't assigned" MUST produce the IDENTICAL
 * reply — reuse CASE_NOT_FOUND from messages.ts verbatim, do not add a new
 * intel-specific "not found" string, or an agent could probe for which case
 * numbers exist by comparing reply text between this command and `เคส`.
 *
 * ── Decryption ──────────────────────────────────────────────────────────
 * `cases.target_name_enc`, `target_phone_enc`, `target_vehicle_enc`,
 * `license_plate_enc`, `target_address_enc`, `target_alias_enc`,
 * `target_notes_enc`, `target_socials_enc` are AES-256-GCM encrypted at
 * rest (PDPA) — decrypt via src/lib/security/encryption.ts's
 * decryptField(), and ONLY after the authorization check above has
 * succeeded. Never decrypt speculatively "just in case" before knowing the
 * requesting agent may see this case — decrypting is itself exposing PII
 * into process memory/logs if anything downstream mishandles it.
 *
 * ── Logging discipline ─────────────────────────────────────────────────
 * NEVER log decrypted target PII (name/phone/address/alias/vehicle/plate/
 * notes/socials) at ANY log level, including error paths — mirror this
 * file's sibling commands (see add-timeline.ts's entry-text logging
 * discipline: length-only references, never content). IDs, counts, and
 * booleans are fine to log; decrypted field values are not.
 *
 * ── Scope: what this command may return ────────────────────────────────
 * Cap the response to data manually curated by staff:
 *   - the case's target profile fields listed above,
 *   - `target_vehicles` (+ `vehicle_photos`),
 *   - `target_locations`,
 *   - `target_relationships`.
 * OSINT `image_analysis` / `contact_analysis` / any AI-generated report
 * content is explicitly OUT OF SCOPE for this command — that's
 * lower-confidence, less-vetted AI output, and surfacing it via LINE (if
 * ever) is a separate, deliberate product decision, not a default extension
 * of this command.
 *
 * ── Photos ──────────────────────────────────────────────────────────────
 * `target_photos` / `vehicle_photos` rows store Storage paths, not public
 * URLs. Mirror src/app/(dashboard)/timeline/actions.ts's fetchReportPhotos()
 * pattern: generate short-lived signed URLs via
 * `supabase.storage.from(BUCKETS.intelligence).createSignedUrls(paths, ttlSeconds)`
 * (see src/lib/constants.ts's BUCKETS — `intelligence` is the bucket used
 * for target/vehicle photos, distinct from `evidence`). Send them as real
 * LINE image messages (not links) via src/lib/line/reply.ts's
 * replyLineMessages() (added this round) — build
 * `{ type: "image", originalContentUrl, previewImageUrl }` entries from the
 * signed URLs (both must be HTTPS/JPEG/<=10MB per LINE's constraints, which
 * signed Supabase Storage URLs satisfy), combined with a text summary
 * message in the SAME reply call, capped at replyLineMessages()'s 5-message
 * limit (that leaves room for at most 4 photos alongside the text summary,
 * or fewer if this command later also wants vehicle/location text blocks as
 * separate messages).
 *
 * ── Not yet in scope for this round ────────────────────────────────────
 * No rate limiting has been added for this command yet — flag it as a
 * consideration for the real implementation (mirror line_attach_photo /
 * line_add_timeline's per-agent bucket convention in
 * src/lib/rate-limit.ts), given how sensitive and DB/decrypt-heavy each
 * invocation will be.
 */
export async function handleIntelCommand(
  agentId: string,
  caseNumber: string,
  replyToken: string,
): Promise<void> {
  console.log(`[line:intel] stub-invoked agentId=${agentId} caseNumberProvided=${Boolean(caseNumber.trim())}`);
  await replyLineMessage(replyToken, INTEL_COMMAND_STUB);
}
