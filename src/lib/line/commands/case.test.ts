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
 * method is a `vi.fn()` that returns itself — so calls stay chainable AND
 * are recorded (inspectable afterward via e.g. `builder.eq.mock.calls`),
 * which lets tests assert on the authorization-critical filter arguments
 * (not just the final returned data — see the "authorization regression
 * guard" tests below). It resolves via either `.maybeSingle()` or by being
 * awaited directly (`.then`), matching how src/lib/line/commands/case.ts
 * uses the real client. */
function chainable(result: Result) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "ilike", "eq", "limit"]) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(async () => result);
  (b as { then: unknown }).then = (
    resolve: (value: Result) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return b as {
    select: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (
      resolve: (value: Result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  };
}

type Builder = ReturnType<typeof chainable>;

/** Queues chainable results for each successive `svc.from("cases")` call, in
 * call order. handleCaseLookupCommand issues, at most: [0] exact match,
 * [1] target-name search, [2] client-name search. Every builder handed out
 * is also collected on `.builders` (in that same call order) so tests can
 * assert on the args each query's `.select()`/`.eq()` calls were made with. */
function makeSvc(casesQueue: Result[]) {
  let idx = 0;
  const builders: Builder[] = [];
  return {
    builders,
    from(table: string) {
      if (table !== "cases") throw new Error(`unexpected table: ${table}`);
      const result = casesQueue[idx] ?? { data: null, error: null };
      idx++;
      const b = chainable(result);
      builders.push(b);
      return b;
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

  describe("authorization regression guard", () => {
    // These assert on the *args* the query builder's `.select()`/`.eq()`
    // methods were called with, not just the returned data. The prior
    // ignore-all-args mock would have kept passing even if a refactor
    // silently dropped `case_agents!inner(agent_id)` from CASE_SELECT or the
    // `.eq("case_agents.agent_id", agentId)` filter from shared.ts — the
    // SOLE guard against one agent reading another agent's case/target PII
    // over LINE (no Supabase Auth session / RLS in this webhook context).

    it("scopes the exact-match query to case_agents!inner + this agent's case_agents.agent_id filter", async () => {
      const svc = makeSvc([{ data: caseRow(), error: null }]);
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleCaseLookupCommand(AGENT_ID, "CASE-2026-0001", "rt1");

      const exactBuilder = svc.builders[0]!;
      expect(exactBuilder.select).toHaveBeenCalledWith(
        expect.stringContaining("case_agents!inner(agent_id)"),
      );
      expect(exactBuilder.eq).toHaveBeenCalledWith("case_agents.agent_id", AGENT_ID);
    });

    it("parameterizes the case_agents.agent_id filter per agentId — a different agentId produces a different eq() argument (not hardcoded/stale)", async () => {
      const OTHER_AGENT_ID = "99999999-9999-9999-9999-999999999999";
      const svc = makeSvc([{ data: null, error: null }]); // exact miss -> falls through to search
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleCaseLookupCommand(OTHER_AGENT_ID, "CASE-2026-0001", "rt1");

      const exactBuilder = svc.builders[0]!;
      expect(exactBuilder.eq).toHaveBeenCalledWith("case_agents.agent_id", OTHER_AGENT_ID);
      expect(exactBuilder.eq).not.toHaveBeenCalledWith("case_agents.agent_id", AGENT_ID);
    });

    it("scopes BOTH fallback-search queries (target-name and client-name) to case_agents!inner + this agent's case_agents.agent_id filter", async () => {
      const svc = makeSvc([
        { data: null, error: null }, // exact miss
        { data: [], error: null }, // target-name search miss
        { data: [], error: null }, // client-name search miss
      ]);
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleCaseLookupCommand(AGENT_ID, "Somchai", "rt1");

      const [, byTargetBuilder, byClientBuilder] = svc.builders;
      for (const b of [byTargetBuilder!, byClientBuilder!]) {
        expect(b.select).toHaveBeenCalledWith(
          expect.stringContaining("case_agents!inner(agent_id)"),
        );
        expect(b.eq).toHaveBeenCalledWith("case_agents.agent_id", AGENT_ID);
      }
    });
  });
});
