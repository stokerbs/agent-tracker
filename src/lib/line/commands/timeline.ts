import "server-only";

import { replyLineMessage } from "@/lib/line/reply";
import { NOT_YET_IMPLEMENTED } from "@/lib/line/messages";

/**
 * Handles the "timeline list" (read-only) LINE-bot command (Round 2 — NOT
 * implemented here, stub only; the Round-2 write/add-timeline-entry command
 * is a separate, later feature and out of scope for this stub too). Wired up
 * by src/lib/line/router.ts's dispatcher when a message parses as a
 * timeline-list command (e.g. "ไทม์ไลน์ <รหัสเคส>").
 *
 * Handoff contract for whoever implements the real query logic:
 *
 * @param agentId - `agents.id` for the LINE user issuing this command.
 *   GUARANTEED by the router to be an already-linked, already-verified agent
 *   (line_accounts.agent_id resolved AND line_accounts.linked_at set) before
 *   this function is ever invoked — the router gates every non-link/verify
 *   command behind that check. Never trust any other agent-identifying value
 *   pulled directly from the raw LINE event payload — always use this
 *   parameter.
 * @param args - Raw text the user typed after the command keyword (e.g. a
 *   case id/number to list timeline entries for). NOT validated or
 *   sanitized by the router — validate/parametrize before using it in any
 *   query. Empty string if the user issued the command with no arguments.
 * @param replyToken - The LINE replyToken for this webhook event. Reply
 *   tokens are single-use and expire quickly (roughly 1 minute), so reply
 *   promptly. Use replyLineMessage(replyToken, text) from
 *   src/lib/line/reply.ts to send the response.
 *
 * Implementation notes for the real version:
 *   - Read-only: list existing timeline_entries for a case this agent can
 *     access (RLS-scoped, same authorization boundary as the case lookup
 *     command — see case.ts's notes). Do not add a write/add-entry path here,
 *     that is an explicitly separate, later feature.
 *   - Handle the empty-result case explicitly (e.g. "no timeline entries
 *     yet" vs. an actual error), matching the loading/error/empty-state
 *     requirement used everywhere else in this app.
 */
export async function handleTimelineListCommand(
  agentId: string,
  args: string,
  replyToken: string,
): Promise<void> {
  void agentId;
  void args;
  await replyLineMessage(replyToken, NOT_YET_IMPLEMENTED);
}
