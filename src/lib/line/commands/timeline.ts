import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessage } from "@/lib/line/reply";
import {
  CASE_NOT_FOUND,
  GENERIC_ERROR,
  TIMELINE_EMPTY_ARGS,
  TIMELINE_NO_ENTRIES,
  formatTimelineList,
} from "@/lib/line/messages";
import { findAuthorizedCaseByNumber } from "@/lib/line/commands/shared";

/** LINE messages have a practical length ceiling — cap to the most recent N
 * entries rather than dumping an unbounded timeline into one chat bubble. */
const TIMELINE_DISPLAY_LIMIT = 12;

/**
 * Handles the read-only "timeline list" LINE-bot command (e.g.
 * "ไทม์ไลน์ <รหัสเคส>"). Wired up by src/lib/line/router.ts, which
 * guarantees `agentId` is an already-linked, already-verified agent before
 * this is ever called. Round-2 write/add-entry-via-LINE is explicitly out
 * of scope here — read-only only.
 *
 * Authorization: same case_agents-membership check as case.ts (see
 * src/lib/line/commands/shared.ts for the rationale and the reusable
 * helper) — resolve+authorize the case first, then list timeline_entries
 * scoped to that already-authorized case_id, excluding soft-deleted rows.
 */
export async function handleTimelineListCommand(
  agentId: string,
  args: string,
  replyToken: string,
): Promise<void> {
  const caseNumber = args.trim();
  if (!caseNumber) {
    console.log(`[line:timeline] empty-args agentId=${agentId}`);
    await replyLineMessage(replyToken, TIMELINE_EMPTY_ARGS);
    return;
  }

  const svc = createServiceClient();

  const resolved = await findAuthorizedCaseByNumber(svc, agentId, caseNumber);
  if (resolved.error) {
    console.error(`[line:timeline] case-lookup-failed agentId=${agentId}`, resolved.error);
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }
  if (!resolved.data) {
    console.log(`[line:timeline] case-not-found-or-unauthorized agentId=${agentId}`);
    await replyLineMessage(replyToken, CASE_NOT_FOUND);
    return;
  }

  const caseRow = resolved.data;

  const { count, error: countError } = await svc
    .from("timeline_entries")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseRow.id)
    .is("deleted_at", null);

  if (countError) {
    console.error(
      `[line:timeline] count-failed agentId=${agentId} caseId=${caseRow.id}`,
      countError,
    );
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }

  const total = count ?? 0;
  if (total === 0) {
    console.log(`[line:timeline] no-entries agentId=${agentId} caseId=${caseRow.id}`);
    await replyLineMessage(replyToken, TIMELINE_NO_ENTRIES);
    return;
  }

  // Most-recent N first (index-friendly per timeline_case_idx / the 0048
  // composite index on (case_id, entry_date, entry_time)), then reversed
  // below so the reply reads oldest-to-newest, matching how the dashboard
  // timeline is organized.
  const { data: entries, error: entriesError } = await svc
    .from("timeline_entries")
    .select("entry_date, entry_time, entry, location")
    .eq("case_id", caseRow.id)
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false })
    .limit(TIMELINE_DISPLAY_LIMIT);

  if (entriesError) {
    console.error(
      `[line:timeline] entries-fetch-failed agentId=${agentId} caseId=${caseRow.id}`,
      entriesError,
    );
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }

  const chronological = [...(entries ?? [])].reverse();

  console.log(
    `[line:timeline] found agentId=${agentId} caseId=${caseRow.id} shown=${chronological.length} total=${total}`,
  );
  await replyLineMessage(
    replyToken,
    formatTimelineList(caseRow.case_number, chronological, total),
  );
}
