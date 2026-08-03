import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessage } from "@/lib/line/reply";
import {
  CASE_LOOKUP_EMPTY_ARGS,
  CASE_NOT_FOUND,
  GENERIC_ERROR,
  formatCaseSummary,
  formatMultipleCaseMatches,
} from "@/lib/line/messages";
import { findAuthorizedCaseByNumber, searchAuthorizedCases } from "@/lib/line/commands/shared";

const SEARCH_RESULT_LIMIT = 5;

/**
 * Handles the read-only "case lookup" LINE-bot command (e.g. "เคส <คำค้นหา>").
 * Wired up by src/lib/line/router.ts, which guarantees `agentId` is an
 * already-linked, already-verified agent before this is ever called.
 *
 * Authorization: no Supabase Auth session exists in this webhook context
 * (no auth.uid()), so RLS/can_access_case() can't be relied on here. Every
 * query goes through createServiceClient() but replicates the RLS
 * case_agents-membership check explicitly and in-query (see
 * src/lib/line/commands/shared.ts) — an unauthorized case row never leaves
 * the DB. "Not found" and "found but not assigned to this agent" always
 * produce the identical CASE_NOT_FOUND reply, so an agent can't probe for
 * case numbers that exist but aren't theirs.
 *
 * Lookup strategy: try an exact case_number match first; if nothing
 * matches, fall back to a capped, authorization-scoped loose search across
 * target name (exact, via blind index — target_name is encrypted at rest,
 * see shared.ts) and client_name (ILIKE substring).
 */
export async function handleCaseLookupCommand(
  agentId: string,
  args: string,
  replyToken: string,
): Promise<void> {
  const term = args.trim();
  if (!term) {
    console.log(`[line:case] empty-args agentId=${agentId}`);
    await replyLineMessage(replyToken, CASE_LOOKUP_EMPTY_ARGS);
    return;
  }

  const svc = createServiceClient();

  const exact = await findAuthorizedCaseByNumber(svc, agentId, term);
  if (exact.error) {
    console.error(`[line:case] exact-lookup-failed agentId=${agentId}`, exact.error);
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }
  if (exact.data) {
    console.log(`[line:case] found-exact agentId=${agentId} caseId=${exact.data.id}`);
    await replyLineMessage(replyToken, formatCaseSummary(exact.data));
    return;
  }

  const search = await searchAuthorizedCases(svc, agentId, term, SEARCH_RESULT_LIMIT);
  if (search.error) {
    console.error(`[line:case] search-lookup-failed agentId=${agentId}`, search.error);
    await replyLineMessage(replyToken, GENERIC_ERROR);
    return;
  }

  if (search.data.length === 0) {
    console.log(`[line:case] not-found-or-unauthorized agentId=${agentId}`);
    await replyLineMessage(replyToken, CASE_NOT_FOUND);
    return;
  }

  if (search.data.length === 1) {
    console.log(`[line:case] found-search-single agentId=${agentId} caseId=${search.data[0]!.id}`);
    await replyLineMessage(replyToken, formatCaseSummary(search.data[0]!));
    return;
  }

  console.log(`[line:case] found-search-multiple agentId=${agentId} count=${search.data.length}`);
  await replyLineMessage(replyToken, formatMultipleCaseMatches(search.data));
}
