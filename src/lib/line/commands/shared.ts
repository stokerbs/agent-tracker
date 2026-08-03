import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { createNameBlindIndex, decryptField } from "@/lib/security/encryption";

/**
 * Shared authorization + query helpers for the read-only LINE-bot commands
 * (case lookup + timeline list — see ./case.ts and ./timeline.ts).
 *
 * Authorization model (deliberately narrower than full RLS parity — see the
 * handoff note in case.ts/timeline.ts for why):
 *   An agent may read a case iff EXISTS a case_agents row with
 *   (case_id = <that case>, agent_id = <this agentId>). No admin/supervisor
 *   blanket-access bypass. The webhook has no Supabase Auth session, so this
 *   is enforced here in application code via createServiceClient() rather
 *   than relying on RLS/can_access_case() (which hard-depend on auth.uid()).
 *
 * Every query below enforces that check AS PART OF the query itself (an
 * inner join against case_agents filtered by agent_id), never as a
 * post-fetch filter — so an unauthorized case row is never even returned by
 * Postgres, let alone leaked to the caller.
 */

/** `cases.target_name` is stored encrypted (target_name_enc) with a
 * deterministic blind index (target_name_bidx) for exact-match lookups —
 * see supabase/migrations for the PII-encryption migration and
 * src/lib/security/encryption.ts. There is no plaintext substring search
 * available for it (same limitation the dashboard's own case search
 * already lives with — see src/app/(dashboard)/cases/page.tsx, which only
 * ilike-searches case_number/client_name). `client_name`/`case_type`/
 * `description`/`status` remain plaintext columns. */
const CASE_SELECT =
  "id, case_number, client_name, target_name_enc, status, case_type, description, created_at, case_agents!inner(agent_id)";

export type AuthorizedCase = {
  id: string;
  case_number: string;
  client_name: string | null;
  /** Best-effort decrypted plaintext; null if absent or if decryption fails. */
  target_name: string | null;
  status: string;
  case_type: string | null;
  description: string | null;
  created_at: string;
};

type CaseRawRow = {
  id: string;
  case_number: string;
  client_name: string | null;
  target_name_enc: string | null;
  status: string;
  case_type: string | null;
  description: string | null;
  created_at: string;
  // Present only to make the case_agents!inner authorization join happen —
  // never read beyond that (we already filtered on it in-query).
  case_agents: unknown;
};

type SvcClient = ReturnType<typeof createServiceClient>;

/** Never let a single row's decrypt failure (e.g. corrupt ciphertext, key
 * rotation gap) blow up an entire lookup/list — log and degrade to null. */
function safeDecryptTargetName(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    return decryptField(encrypted);
  } catch (err) {
    console.error("[line:shared] target_name decrypt failed", err);
    return null;
  }
}

function mapCaseRow(row: CaseRawRow): AuthorizedCase {
  return {
    id: row.id,
    case_number: row.case_number,
    client_name: row.client_name,
    target_name: safeDecryptTargetName(row.target_name_enc),
    status: row.status,
    case_type: row.case_type,
    description: row.description,
    created_at: row.created_at,
  };
}

/** Escape SQL ILIKE wildcards (`%`, `_`) so free-text user input behaves as
 * a literal match/substring rather than an unintended wildcard pattern.
 * Escapes a literal backslash FIRST — otherwise `a\%` would become `a\\%`,
 * which Postgres still parses as an escaped-backslash followed by an
 * unescaped (wildcard) `%`, letting a `\` in user input reintroduce a
 * wildcard this function was meant to neutralize. */
export function escapeIlikeTerm(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/[%_]/g, (c) => `\\${c}`);
}

/**
 * Resolve a case by EXACT (case-insensitive) case_number, scoped to cases
 * the given agent is assigned to. Returns `{ data: null }` for BOTH "no
 * such case" and "case exists but this agent isn't assigned" — callers
 * MUST reply with the same generic message for both outcomes so an agent
 * can never probe for case numbers that exist but aren't theirs.
 */
export async function findAuthorizedCaseByNumber(
  svc: SvcClient,
  agentId: string,
  caseNumber: string,
): Promise<{ data: AuthorizedCase | null; error: unknown }> {
  const term = escapeIlikeTerm(caseNumber.trim());
  if (!term) return { data: null, error: null };

  const { data, error } = await svc
    .from("cases")
    .select(CASE_SELECT)
    .ilike("case_number", term) // no wildcards added => case-insensitive equality
    .eq("case_agents.agent_id", agentId)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: data ? mapCaseRow(data as unknown as CaseRawRow) : null, error: null };
}

/**
 * Loose, capped, authorization-scoped search: exact target-name match (via
 * blind index) unioned with a client_name ILIKE substring match, deduped by
 * case id and capped to `limit`. Two separate parametrized queries rather
 * than a single `.or()` filter string — deliberate, since `term` here is
 * raw, unauthenticated-adjacent webhook text and PostgREST's `.or()` syntax
 * parses commas/parentheses in the RAW filter string as logical operators,
 * which would be an injection surface if user text were interpolated
 * directly into it.
 */
export async function searchAuthorizedCases(
  svc: SvcClient,
  agentId: string,
  term: string,
  limit = 5,
): Promise<{ data: AuthorizedCase[]; error: unknown }> {
  const trimmed = term.trim();
  if (!trimmed) return { data: [], error: null };

  let nameBidx: string;
  try {
    nameBidx = createNameBlindIndex(trimmed);
  } catch (err) {
    // Blind-index key misconfigured — treat identically to a DB failure.
    return { data: [], error: err };
  }

  const pattern = `%${escapeIlikeTerm(trimmed)}%`;

  const [byTarget, byClient] = await Promise.all([
    svc
      .from("cases")
      .select(CASE_SELECT)
      .eq("target_name_bidx", nameBidx)
      .eq("case_agents.agent_id", agentId)
      .limit(limit),
    svc
      .from("cases")
      .select(CASE_SELECT)
      .ilike("client_name", pattern)
      .eq("case_agents.agent_id", agentId)
      .limit(limit),
  ]);

  if (byTarget.error) return { data: [], error: byTarget.error };
  if (byClient.error) return { data: [], error: byClient.error };

  const seen = new Map<string, AuthorizedCase>();
  for (const raw of [...(byTarget.data ?? []), ...(byClient.data ?? [])] as unknown as CaseRawRow[]) {
    const mapped = mapCaseRow(raw);
    if (!seen.has(mapped.id)) seen.set(mapped.id, mapped);
  }
  return { data: Array.from(seen.values()).slice(0, limit), error: null };
}
