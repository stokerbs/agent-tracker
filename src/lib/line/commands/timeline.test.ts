import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));
vi.mock("@/lib/security/encryption", () => ({
  createNameBlindIndex: vi.fn((v: string) => `bidx:${v}`),
  decryptField: vi.fn((v: string) => `plain:${v}`),
}));

import { handleTimelineListCommand } from "./timeline";
import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessage } from "@/lib/line/reply";
import * as msg from "@/lib/line/messages";

const AGENT_ID = "22222222-2222-2222-2222-222222222222";
const CASE_ID = "case-1";
const CASE_NUMBER = "CASE-2026-0001";

type Result = { data: unknown; error: unknown; count?: number | null };

/** Minimal chainable stand-in for a PostgREST query builder — see the
 * matching helper in ./case.test.ts for the rationale (every filter method
 * is a `vi.fn()` that returns itself, so calls stay chainable AND are
 * recorded/inspectable afterward, e.g. `builder.eq.mock.calls`). Adds
 * `.is()`/`.order()` on top of the case.ts helper set since timeline
 * queries use those too. */
function chainable(result: Result) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "ilike", "eq", "is", "order", "limit"]) {
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
    is: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (
      resolve: (value: Result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  };
}

type Builder = ReturnType<typeof chainable>;

/** As in case.test.ts's makeSvc, every builder handed out is also collected
 * (in call order, per table) on `.caseBuilders` / `.timelineBuilders` so
 * tests can assert on the args each query's `.select()`/`.eq()` calls were
 * made with — in particular the case-resolution query, which reuses
 * shared.ts's `findAuthorizedCaseByNumber` (same authorization guard as
 * case.ts). */
function makeSvc({
  caseResult,
  timelineQueue = [],
}: {
  caseResult: Result;
  timelineQueue?: Result[];
}) {
  let tIdx = 0;
  const caseBuilders: Builder[] = [];
  const timelineBuilders: Builder[] = [];
  return {
    caseBuilders,
    timelineBuilders,
    from(table: string) {
      if (table === "cases") {
        const b = chainable(caseResult);
        caseBuilders.push(b);
        return b;
      }
      if (table === "timeline_entries") {
        const result = timelineQueue[tIdx] ?? { data: null, error: null, count: null };
        tIdx++;
        const b = chainable(result);
        timelineBuilders.push(b);
        return b;
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

function lastReply(): string {
  const calls = vi.mocked(replyLineMessage).mock.calls;
  return calls[calls.length - 1]?.[1] ?? "";
}

function authorizedCaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CASE_ID,
    case_number: CASE_NUMBER,
    client_name: "Somchai Co.",
    target_name_enc: null,
    status: "active",
    case_type: "Infidelity",
    description: null,
    created_at: "2026-01-01T00:00:00.000Z",
    case_agents: [{ agent_id: AGENT_ID }],
    ...overrides,
  };
}

/** entry_date "2026-01-DD" for DD = day, in the DESCENDING order the real
 * `.order(..., { ascending: false })` query would return (most recent first). */
function entry(day: number, overrides: Record<string, unknown> = {}) {
  return {
    entry_date: `2026-01-${String(day).padStart(2, "0")}`,
    entry_time: "14:30:00",
    entry: `Observation on day ${day}`,
    location: null,
    ...overrides,
  };
}

afterEach(() => vi.clearAllMocks());

describe("handleTimelineListCommand", () => {
  it("asks for a case number when args is empty (distinct from not-found/empty-timeline)", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSvc({ caseResult: { data: null, error: null } }) as never,
    );
    await handleTimelineListCommand(AGENT_ID, "  ", "rt1");
    expect(lastReply()).toBe(msg.TIMELINE_EMPTY_ARGS);
    expect(lastReply()).not.toBe(msg.CASE_NOT_FOUND);
    expect(lastReply()).not.toBe(msg.TIMELINE_NO_ENTRIES);
  });

  it("replies GENERIC_ERROR when the case-resolution query errors", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSvc({ caseResult: { data: null, error: { message: "db down" } } }) as never,
    );
    await handleTimelineListCommand(AGENT_ID, CASE_NUMBER, "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);
  });

  it("replies CASE_NOT_FOUND for a nonexistent or unauthorized case (same as case.ts, for consistency)", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSvc({ caseResult: { data: null, error: null } }) as never,
    );
    await handleTimelineListCommand(AGENT_ID, "CASE-NOT-MINE", "rt1");
    expect(lastReply()).toBe(msg.CASE_NOT_FOUND);
  });

  it("replies TIMELINE_NO_ENTRIES (a distinct empty-state) when the case has zero non-deleted entries", async () => {
    const svc = makeSvc({
      caseResult: { data: authorizedCaseRow(), error: null },
      timelineQueue: [{ data: null, error: null, count: 0 }],
    });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleTimelineListCommand(AGENT_ID, CASE_NUMBER, "rt1");
    expect(lastReply()).toBe(msg.TIMELINE_NO_ENTRIES);
  });

  it("replies GENERIC_ERROR when the count query errors", async () => {
    const svc = makeSvc({
      caseResult: { data: authorizedCaseRow(), error: null },
      timelineQueue: [{ data: null, error: { message: "db down" }, count: null }],
    });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleTimelineListCommand(AGENT_ID, CASE_NUMBER, "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);
  });

  it("replies GENERIC_ERROR when the entries fetch errors", async () => {
    const svc = makeSvc({
      caseResult: { data: authorizedCaseRow(), error: null },
      timelineQueue: [
        { data: null, error: null, count: 3 },
        { data: null, error: { message: "db down" } },
      ],
    });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleTimelineListCommand(AGENT_ID, CASE_NUMBER, "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);
  });

  it("lists all entries in chronological order with no truncation note when total fits within the display limit", async () => {
    const entries = [entry(3), entry(2), entry(1)]; // desc, as the DB query would return
    const svc = makeSvc({
      caseResult: { data: authorizedCaseRow(), error: null },
      timelineQueue: [
        { data: null, error: null, count: 3 },
        { data: entries, error: null },
      ],
    });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleTimelineListCommand(AGENT_ID, CASE_NUMBER, "rt1");
    const reply = lastReply();

    expect(reply).toContain(CASE_NUMBER);
    expect(reply).toContain("2026-01-01");
    expect(reply).toContain("2026-01-03");
    expect(reply).not.toMatch(/แสดง .* จากทั้งหมด/); // no truncation footer
    // chronological (ascending): day 1 line appears before day 3 line
    expect(reply.indexOf("2026-01-01")).toBeLessThan(reply.indexOf("2026-01-03"));
  });

  it("truncates to the display limit and notes it, most-recent entries kept, still shown chronologically", async () => {
    // 15 total entries; DB returns the 12 most recent (days 15..4, descending).
    const mostRecent12Desc = Array.from({ length: 12 }, (_, i) => entry(15 - i));
    const svc = makeSvc({
      caseResult: { data: authorizedCaseRow(), error: null },
      timelineQueue: [
        { data: null, error: null, count: 15 },
        { data: mostRecent12Desc, error: null },
      ],
    });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleTimelineListCommand(AGENT_ID, CASE_NUMBER, "rt1");
    const reply = lastReply();

    expect(reply).toContain("แสดง 12 รายการล่าสุดจากทั้งหมด 15 รายการ");
    // The three oldest days (1-3) were dropped by the DB-side limit.
    expect(reply).not.toContain("2026-01-01");
    expect(reply).not.toContain("2026-01-02");
    expect(reply).not.toContain("2026-01-03");
    expect(reply).toContain("2026-01-04");
    expect(reply).toContain("2026-01-15");
    // still chronological within the shown slice
    expect(reply.indexOf("2026-01-04")).toBeLessThan(reply.indexOf("2026-01-15"));
  });

  it("truncates a very long entry text and includes the location when present", async () => {
    const longText = "x".repeat(300);
    const svc = makeSvc({
      caseResult: { data: authorizedCaseRow(), error: null },
      timelineQueue: [
        { data: null, error: null, count: 1 },
        { data: [entry(1, { entry: longText, location: "Siam Paragon" })], error: null },
      ],
    });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleTimelineListCommand(AGENT_ID, CASE_NUMBER, "rt1");
    const reply = lastReply();

    expect(reply).toContain("Siam Paragon");
    expect(reply).not.toContain(longText); // truncated
    expect(reply).toContain("x".repeat(150)); // first 150 chars kept
  });

  describe("authorization regression guard", () => {
    // Timeline reads authorize via the SAME shared.ts helper case.ts uses
    // (findAuthorizedCaseByNumber) — the timeline_entries queries themselves
    // only filter by the already-authorized case_id, so the case-resolution
    // query below is the sole gate preventing one agent from reading
    // another agent's timeline. These assert on the *args* `.select()`/
    // `.eq()` were called with, not just the returned data, so a refactor
    // that silently dropped `case_agents!inner(agent_id)`/the
    // `.eq("case_agents.agent_id", agentId)` filter in shared.ts would fail
    // these tests even though the canned mock data would otherwise still
    // "work".

    it("scopes the case-resolution query to case_agents!inner + this agent's case_agents.agent_id filter", async () => {
      const svc = makeSvc({
        caseResult: { data: authorizedCaseRow(), error: null },
        timelineQueue: [
          { data: null, error: null, count: 1 },
          { data: [entry(1)], error: null },
        ],
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleTimelineListCommand(AGENT_ID, CASE_NUMBER, "rt1");

      const caseBuilder = svc.caseBuilders[0]!;
      expect(caseBuilder.select).toHaveBeenCalledWith(
        expect.stringContaining("case_agents!inner(agent_id)"),
      );
      expect(caseBuilder.eq).toHaveBeenCalledWith("case_agents.agent_id", AGENT_ID);

      // The subsequent timeline_entries queries filter by the *resolved,
      // already-authorized* case id — never by unvalidated caller input.
      for (const b of svc.timelineBuilders) {
        expect(b.eq).toHaveBeenCalledWith("case_id", CASE_ID);
      }
    });

    it("parameterizes the case-resolution authorization filter per agentId — a different agentId produces a different eq() argument (not hardcoded/stale)", async () => {
      const OTHER_AGENT_ID = "99999999-9999-9999-9999-999999999999";
      const svc = makeSvc({ caseResult: { data: null, error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleTimelineListCommand(OTHER_AGENT_ID, CASE_NUMBER, "rt1");

      const caseBuilder = svc.caseBuilders[0]!;
      expect(caseBuilder.eq).toHaveBeenCalledWith("case_agents.agent_id", OTHER_AGENT_ID);
      expect(caseBuilder.eq).not.toHaveBeenCalledWith("case_agents.agent_id", AGENT_ID);
    });
  });
});
