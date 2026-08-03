import "server-only";

import { replyLineMessage } from "@/lib/line/reply";
import { ADD_TIMELINE_EMPTY_ARGS, ADD_TIMELINE_NOT_YET_IMPLEMENTED } from "@/lib/line/messages";

/**
 * Handles the write "add timeline entry" LINE-bot command (Round 2), e.g.
 * "เพิ่มไทม์ไลน์ <รหัสเคส> <ข้อความ>" or "บันทึกไทม์ไลน์ <รหัสเคส> <ข้อความ>".
 * Wired up by src/lib/line/router.ts's parseCommand()/handleLineMessage(),
 * which guarantees `agentId` is an already-linked, already-verified agent
 * before this is ever called — `agentId` must NEVER be re-derived from the
 * LINE payload or from any other source; it is the only trusted input here.
 *
 * ROUND 2 SCOPE IS TEXT-ONLY. No photo_url/video_url/lat/lng handling of any
 * kind belongs in this command. Those columns exist on `timeline_entries`
 * but are legacy/unused by the dashboard write path too — see
 * src/app/(dashboard)/timeline/actions.ts's addTimelineEntry(), which never
 * sets them. Photos in this app go through the separate `evidence` table,
 * which is entirely out of scope here. A photo/location-via-LINE fast-follow
 * is planned separately later; do not anticipate it in this file.
 *
 * ── STUB — NOT YET IMPLEMENTED ──────────────────────────────────────────
 * This is a parsing/dispatch-only handoff stub (mirrors how case.ts and
 * timeline.ts started in Round 1): it exists so router.ts has a real, gated
 * command to dispatch to. The next engineer (evidence-engineer) replaces
 * this entire function body with the real DB write. Handoff contract:
 *
 *   - `caseNumber` and `text` are RAW, UNVALIDATED user input straight off
 *     the LINE message (see router.ts's add-timeline regex) — validate,
 *     sanitize, and length-cap BOTH before they ever reach a DB write.
 *     Never trust client-derived text as-is (see Golden Rule #1 / the
 *     Backend coding standard: never trust client-side/user input).
 *   - Authorization: there is no Supabase Auth session in this webhook
 *     context (no auth.uid()), so RLS cannot enforce anything for this
 *     write. Resolve+authorize the case FIRST — reuse
 *     findAuthorizedCaseByNumber() from ./shared.ts (the same helper
 *     case.ts/timeline.ts already use for reads), which checks
 *     case_agents membership in-query. An agent must never be able to add a
 *     timeline entry to a case they are not assigned to.
 *   - Self-attribution: the inserted row's `agent_id` column MUST ALWAYS be
 *     this function's `agentId` parameter — never anything else, and never
 *     anything derived from `caseNumber`/`text`/the LINE payload. This
 *     replicates in application code the guarantee the RLS
 *     `timeline_case_member_insert` policy (`agent_id = my_agent_id()`)
 *     would normally enforce on an authenticated request; since there's no
 *     RLS session here, the equivalent check has to be done explicitly
 *     (same rationale documented in shared.ts's module doc for the read
 *     commands).
 *   - Use createServiceClient() for the write, same as every other command
 *     in this webhook (see router.ts's module doc for why: no Supabase
 *     session exists in this context). Never expose the service-role key
 *     outside server-only modules, and never let it bypass the
 *     authorization check above just because it technically could.
 *   - Reply states to cover: success; GENERIC_ERROR on DB failure; and the
 *     existing CASE_NOT_FOUND message (shared with case.ts/timeline.ts) for
 *     BOTH "no such case" and "case exists but this agent isn't assigned"
 *     — never a distinguishable reply between those two outcomes, same
 *     enumeration-resistance reasoning as the read commands.
 *   - Consider rate-limiting this command (checkRateLimit) and audit
 *     logging the insert per the security playbook — the read commands are
 *     currently unlimited, but a write endpoint is a materially better
 *     candidate for abuse and should not necessarily inherit that.
 */
export async function handleAddTimelineEntryCommand(
  agentId: string,
  caseNumber: string,
  text: string,
  replyToken: string,
): Promise<void> {
  const trimmedCaseNumber = caseNumber.trim();
  const trimmedText = text.trim();
  if (!trimmedCaseNumber || !trimmedText) {
    console.log(`[line:add-timeline] empty-args agentId=${agentId}`);
    await replyLineMessage(replyToken, ADD_TIMELINE_EMPTY_ARGS);
    return;
  }

  // TODO(evidence-engineer): replace this stub body with the real
  // authorized insert — see the handoff contract in the module doc above.
  // Do NOT insert into timeline_entries from this stub as-is.
  console.log(`[line:add-timeline] stub-not-yet-implemented agentId=${agentId}`);
  await replyLineMessage(replyToken, ADD_TIMELINE_NOT_YET_IMPLEMENTED);
}
