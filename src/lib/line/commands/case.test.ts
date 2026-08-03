import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));
vi.mock("@/lib/security/encryption", () => ({
  createNameBlindIndex: vi.fn((v: string) => `bidx:${v}`),
  decryptField: vi.fn((v: string) => `plain:${v}`),
}));

import { handleCaseLookupCommand } from "./case";
import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessage } from "@/lib/line/reply";
import * as msg from "@/lib/line/messages";

const AGENT_ID = "22222222-2222-2222-2222-222222222222";

type Result = { data: unknown; error: unknown };

/** Minimal chainable stand-in for a PostgREST query builder: every filter
 * method returns itself, and it resolves via either `.maybeSingle()` or by
 * being awaited directly (`.then`), matching how src/lib/line/commands/case.ts
 * uses the real client. */
function chainable(result: Result) {
  const builder: {
    select: () => typeof builder;
    ilike: () => typeof builder;
    eq: () => typeof builder;
    limit: () => typeof builder;
    maybeSingle: () => Promise<Result>;
    then: (
      resolve: (value: Result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    select: () => builder,
    ilike: () => builder,
    eq: () => builder,
    limit: () => builder,
    maybeSingle: async () => result,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

/** Queues chainable results for each successive `svc.from("cases")` call, in
 * call order. handleCaseLookupCommand issues, at most: [0] exact match,
 * [1] target-name search, [2] client-name search. */
function makeSvc(casesQueue: Result[]) {
  let idx = 0;
  return {
    from(table: string) {
      if (table !== "cases") throw new Error(`unexpected table: ${table}`);
      const result = casesQueue[idx] ?? { data: null, error: null };
      idx++;
      return chainable(result);
    },
  };
}

function lastReply(): string {
  const calls = vi.mocked(replyLineMessage).mock.calls;
  return calls[calls.length - 1]?.[1] ?? "";
}

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "case-1",
    case_number: "CASE-2026-0001",
    client_name: "Somchai Co.",
    target_name_enc: "enc-target-name",
    status: "active",
    case_type: "Infidelity",
    description: "A short case description.",
    created_at: "2026-01-01T00:00:00.000Z",
    case_agents: [{ agent_id: AGENT_ID }],
    ...overrides,
  };
}

afterEach(() => vi.clearAllMocks());

describe("handleCaseLookupCommand", () => {
  it("asks for a search term when args is empty (distinct from not-found)", async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSvc([]) as never);
    await handleCaseLookupCommand(AGENT_ID, "   ", "rt1");
    expect(lastReply()).toBe(msg.CASE_LOOKUP_EMPTY_ARGS);
    expect(lastReply()).not.toBe(msg.CASE_NOT_FOUND);
  });

  it("replies with a case summary on an exact, authorized case_number match", async () => {
    const svc = makeSvc([{ data: caseRow(), error: null }]);
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleCaseLookupCommand(AGENT_ID, "CASE-2026-0001", "rt1");

    const reply = lastReply();
    expect(reply).toContain("CASE-2026-0001");
    expect(reply).toContain("Somchai Co.");
    expect(reply).toContain("plain:enc-target-name"); // decrypted target name
    expect(reply).toContain("กำลังดำเนินการ"); // Thai label for "active"
  });

  it("replies CASE_NOT_FOUND when the case simply doesn't exist anywhere", async () => {
    const svc = makeSvc([
      { data: null, error: null }, // exact miss
      { data: [], error: null }, // target-name search miss
      { data: [], error: null }, // client-name search miss
    ]);
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleCaseLookupCommand(AGENT_ID, "NOPE-404", "rt1");
    expect(lastReply()).toBe(msg.CASE_NOT_FOUND);
  });

  it("replies the SAME CASE_NOT_FOUND when the case exists but this agent isn't assigned", async () => {
    // Authorization is enforced in-query (case_agents inner join), so a case
    // that exists but isn't assigned to this agent simply never appears in
    // the result set — indistinguishable, by design, from "no such case".
    const svc = makeSvc([
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleCaseLookupCommand(AGENT_ID, "CASE-BELONGS-TO-SOMEONE-ELSE", "rt1");
    expect(lastReply()).toBe(msg.CASE_NOT_FOUND);
  });

  it("falls back to a loose search and replies with the single authorized match", async () => {
    const svc = makeSvc([
      { data: null, error: null }, // exact miss
      { data: [caseRow({ id: "c2", case_number: "CASE-2026-0099" })], error: null }, // target hit
      { data: [], error: null },
    ]);
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleCaseLookupCommand(AGENT_ID, "Somchai", "rt1");
    expect(lastReply()).toContain("CASE-2026-0099");
  });

  it("lists multiple matches (capped) when a loose search matches more than one authorized case", async () => {
    const svc = makeSvc([
      { data: null, error: null },
      {
        data: [
          caseRow({ id: "a", case_number: "CASE-2026-0001" }),
          caseRow({ id: "b", case_number: "CASE-2026-0002" }),
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleCaseLookupCommand(AGENT_ID, "somchai", "rt1");
    const reply = lastReply();
    expect(reply).toContain("CASE-2026-0001");
    expect(reply).toContain("CASE-2026-0002");
  });

  it("replies GENERIC_ERROR (and does not leak internals) when the exact-match query errors", async () => {
    const svc = makeSvc([{ data: null, error: { message: "db down" } }]);
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleCaseLookupCommand(AGENT_ID, "CASE-2026-0001", "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);
  });

  it("replies GENERIC_ERROR when the fallback search query errors", async () => {
    const svc = makeSvc([
      { data: null, error: null },
      { data: null, error: { message: "db down" } },
      { data: [], error: null },
    ]);
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleCaseLookupCommand(AGENT_ID, "Somchai", "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);
  });
});
