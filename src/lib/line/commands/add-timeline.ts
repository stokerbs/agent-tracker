import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessage } from "@/lib/line/reply";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyCaseParticipants } from "@/lib/notifications";
import { bangkokDateKey } from "@/lib/utils";
import {
  ADD_TIMELINE_EMPTY_ARGS,
  ADD_TIMELINE_ENTRY_MAX_CHARS,
  ADD_TIMELINE_TOO_LONG,
  CASE_NOT_FOUND,
  GENERIC_ERROR,
  RATE_LIMITED,
  formatAddTimelineSuccess,
} from "@/lib/line/messages";
import { findAuthorizedCaseByNumber } from "@/lib/line/commands/shared";

/**
 * Handles the write "add timeline entry" LINE-bot command (Round 2), e.g.
 * "เพิ่มไทม์ไลน์ <รหัสเคส> <ข้อความ>" or "บันทึกไทม์ไลน์ <รหัสเคส> <ข้อความ>".
 * Wired up by src/lib/line/router.ts's parseCommand()/handleLineMessage(),
 * which guarantees `agentId` is an already-linked, already-verified agent
 * before this is ever called — `agentId` must NEVER be re-derived from the
 * LINE payload or from any other source; it is the only trusted input here.
 *
 * ROUND 2 SCOPE IS TEXT-ONLY. No photo_url/video_url/lat/lng handling of any
 * kind belongs in this command — those columns exist on `timeline_entries`
 * but are legacy/unused by the dashboard write path too (see
 * src/app/(dashboard)/timeline/actions.ts's addTimelineEntry(), which never
 * sets them), and `location` is intentionally left null this round (no
 * location capture via LINE yet).
 *
 * Authorization: there is no Supabase Auth session in this webhook context
 * (no auth.uid()), so RLS's `timeline_case_member_insert` policy can't run
 * for this write. It is replicated here in application code instead:
 *   - Resolve+authorize the case FIRST via findAuthorizedCaseByNumber()
 *     (src/lib/line/commands/shared.ts) — the same case_agents-membership
 *     check case.ts/timeline.ts already use for reads. "No such case" and
 *     "case exists but this agent isn't assigned" both fall through to the
 *     identical CASE_NOT_FOUND reply (enumeration-resistance, same as the
 *     read commands).
 *   - Self-attribution: the inserted row's `agent_id` is ALWAYS this
 *     function's `agentId` parameter — never anything derived from
 *     `caseNumber`/`text`. This replicates in code the RLS policy's
 *     `agent_id = my_agent_id()` guarantee, which would normally be enforced
 *     by Postgres for an authenticated request.
 * Uses createServiceClient() for the same reason every other command in this
 * webhook does (see router.ts's module doc): no Supabase session exists
 * here. The service-role key never bypasses the authorization check above.
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

  if (trimmedText.length > ADD_TIMELINE_ENTRY_MAX_CHARS) {
    // Never log the entry text itself here — case notes can carry sensitive
    // surveillance details; a length-only reference is enough to debug.
    console.log(
      `[line:add-timeline] entry-too-long agentId=${agentId} length=${trimmedText.length}`,
    );
    await replyLineMessage(replyToken, ADD_TIMELINE_TOO_LONG);
    return;
  }

  const rl = await checkRateLimit("line_add_timeline", agentId);
  if (!rl.allowed) {
    console.warn(`[line:add-timeline] rate-limited agentId=${agentId}`);
    await replyLineMessage(replyToken, RATE_LIMITED);
    return;
  }

  const svc = createServiceClient();

  const resolved = await findAuthorizedCaseByNumber(svc, agentId, trimmedCaseNumber);
  if (resolved.error) {
    console.error(`[line:add-timeline] case-lookup-failed agentId=${agentId}`, resolved.error);
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }
  if (!resolved.data) {
    console.log(`[line:add-timeline] case-not-found-or-unauthorized agentId=${agentId}`);
    await replyLineMessage(replyToken, CASE_NOT_FOUND);
    return;
  }

  const caseRow = resolved.data;
  const { entry_date, entry_time } = bangkokNow();

  const { data: inserted, error: insertError } = await svc
    .from("timeline_entries")
    .insert({
      case_id: caseRow.id,
      // Self-attribution guarantee: ALWAYS the verified agentId parameter,
      // never anything derived from caseNumber/text/the LINE payload.
      agent_id: agentId,
      entry_date,
      entry_time,
      entry: trimmedText,
      location: null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    // Length-only reference to the entry text, never its content (PII-
    // adjacent — surveillance notes) — matches this codebase's existing
    // logging-discipline pattern (see router.ts's redact()).
    console.error(
      `[line:add-timeline] insert-failed agentId=${agentId} caseId=${caseRow.id} entryLength=${trimmedText.length}`,
      insertError,
    );
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }

  console.log(
    `[line:add-timeline] inserted agentId=${agentId} caseId=${caseRow.id} entryId=${inserted.id}`,
  );
  await replyLineMessage(replyToken, formatAddTimelineSuccess(caseRow.case_number, entry_time));

  // Best-effort notification to the rest of the case team, mirroring the
  // dashboard's addTimelineEntry() write path (src/app/(dashboard)/timeline/
  // actions.ts). Deliberately NOT excluding the actor: that dashboard call
  // excludes `profile.id` (a login profile id), but this webhook only has
  // `agentId` (agents.id) — resolving profile_id would need an extra query
  // for a minor UX nit (the LINE-authoring agent also getting notified about
  // their own entry), so it's skipped. notifyCaseParticipants() never
  // includes the client here (includeClient: false), same as the dashboard.
  // No revalidatePath() call: that's a Next.js route-cache API tied to a
  // server-rendered page tree and doesn't apply to this webhook context.
  await notifyCaseParticipants(caseRow.id, {
    type: "case",
    title: "New timeline entry",
    body: trimmedText.slice(0, 140),
    includeClient: false,
  });
}

/**
 * Returns the Bangkok-local `entry_date` (`YYYY-MM-DD`, via bangkokDateKey())
 * and `entry_time` (`HH:MM:SS`, matching the `time` column type) for the
 * given instant. Defaults to "now" — a LINE message has no client-side date/
 * time picker the way the dashboard's timeline form does, so "now in
 * Bangkok" is the only sensible default. Pure/testable: pass an explicit
 * `date` in tests rather than mocking the global Date/Intl.
 */
export function bangkokNow(date: Date = new Date()): { entry_date: string; entry_time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  // Some ICU builds render hour12:false midnight as "24" rather than "00" —
  // normalize defensively so entry_time is always a valid `time` literal.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    entry_date: bangkokDateKey(date),
    entry_time: `${hour}:${get("minute")}:${get("second")}`,
  };
}
