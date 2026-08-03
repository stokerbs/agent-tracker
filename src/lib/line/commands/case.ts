import "server-only";

import { replyLineMessage } from "@/lib/line/reply";
import { NOT_YET_IMPLEMENTED } from "@/lib/line/messages";

/**
 * Handles the "case lookup" LINE-bot command (Round 2 — NOT implemented
 * here, stub only). Wired up by src/lib/line/router.ts's dispatcher when a
 * message parses as a case-lookup command (e.g. "เคส <คำค้นหา>").
 *
 * Handoff contract for whoever implements the real query logic:
 *
 * @param agentId - `agents.id` for the LINE user issuing this command.
 *   GUARANTEED by the router to be an already-linked, already-verified agent
 *   (line_accounts.agent_id resolved AND line_accounts.linked_at set) before
 *   this function is ever invoked — the router gates every non-link/verify
 *   command behind that check. Never trust any other agent-identifying value
 *   pulled directly from the raw LINE event payload (e.g. don't re-derive an
 *   agent from `source.userId` yourself) — always use this parameter.
 * @param args - Raw text the user typed after the command keyword (e.g. a
 *   case number, client name, or free-text search term). NOT validated or
 *   sanitized by the router — validate/parametrize before using it in any
 *   query. Empty string if the user issued the command with no arguments.
 * @param replyToken - The LINE replyToken for this webhook event. Reply
 *   tokens are single-use and expire quickly (roughly 1 minute), so reply
 *   promptly. Use replyLineMessage(replyToken, text) from
 *   src/lib/line/reply.ts to send the response.
 *
 * Implementation notes for the real version:
 *   - Query cases the same way any other agent-scoped read does elsewhere in
 *     this repo — respect RLS via the appropriate scoped client rather than
 *     reaching for createServiceClient() just for convenience (that would
 *     bypass the case-assignment authorization RLS already enforces). See
 *     e.g. can_access_case() usage patterns in the dashboard case queries.
 *   - Handle the empty-result case explicitly (distinct reply text from an
 *     error), matching the loading/error/empty-state requirement used
 *     everywhere else in this app.
 */
export async function handleCaseLookupCommand(
  agentId: string,
  args: string,
  replyToken: string,
): Promise<void> {
  void agentId;
  void args;
  await replyLineMessage(replyToken, NOT_YET_IMPLEMENTED);
}
