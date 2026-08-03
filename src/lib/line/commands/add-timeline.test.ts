import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));
vi.mock("@/lib/security/encryption", () => ({
  createNameBlindIndex: vi.fn((v: string) => `bidx:${v}`),
  decryptField: vi.fn((v: string) => `plain:${v}`),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyCaseParticipants: vi.fn() }));

import { handleAddTimelineEntryCommand, bangkokNow } from "./add-timeline";
import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessage } from "@/lib/line/reply";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyCaseParticipants } from "@/lib/notifications";
import * as msg from "@/lib/line/messages";

const AGENT_ID = "22222222-2222-2222-2222-222222222222";
const CASE_ID = "case-1";
const CASE_NUMBER = "CASE-2026-0001";

type Result = { data: unknown; error: unknown };

/** Minimal chainable stand-in for a PostgREST query builder — see the
 * matching helper in ./case.test.ts / ./timeline.test.ts for the rationale.
 * Adds `.insert()` on top of the read-command helper set, since the write
 * path here does `svc.from("timeline_entries").insert(...).select("id").single()`. */
function chainable(result: Result) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "ilike", "eq", "insert"]) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(async () => result);
  b.single = vi.fn(async () => result);
  (b as { then: unknown }).then = (
    resolve: (value: Result) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return b as {
    select: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    then: (
      resolve: (value: Result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  };
}

type Builder = ReturnType<typeof chainable>;

/** Queues a chainable result per successive `svc.from(table)` call, per table.
 * handleAddTimelineEntryCommand issues, at most: one `cases` query (case
 * resolution) then one `timeline_entries` query (the insert). Every builder
 * handed out is also collected (per table, in call order) so tests can
 * assert on the args each query's `.select()`/`.eq()`/`.insert()` calls were
 * made with — in particular the authorization filter and the inserted row's
 * `agent_id`. */
function makeSvc({
  caseResult,
  insertResult,
}: {
  caseResult: Result;
  insertResult?: Result;
}) {
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
        const b = chainable(insertResult ?? { data: { id: "entry-1" }, error: null });
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

function allowRateLimit() {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 1, retryAfterMs: 0 });
}

afterEach(() => vi.clearAllMocks());

describe("handleAddTimelineEntryCommand", () => {
  it("replies ADD_TIMELINE_EMPTY_ARGS when the case number is blank", async () => {
    await handleAddTimelineEntryCommand(AGENT_ID, "   ", "some entry text", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.ADD_TIMELINE_EMPTY_ARGS);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("replies ADD_TIMELINE_EMPTY_ARGS when the entry text is blank", async () => {
    await handleAddTimelineEntryCommand(AGENT_ID, "CASE-001", "   ", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.ADD_TIMELINE_EMPTY_ARGS);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("rejects an entry exceeding ADD_TIMELINE_ENTRY_MAX_CHARS without touching the DB", async () => {
    const tooLong = "x".repeat(msg.ADD_TIMELINE_ENTRY_MAX_CHARS + 1);
    await handleAddTimelineEntryCommand(AGENT_ID, CASE_NUMBER, tooLong, "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.ADD_TIMELINE_TOO_LONG);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("accepts an entry at exactly ADD_TIMELINE_ENTRY_MAX_CHARS", async () => {
    allowRateLimit();
    const exact = "x".repeat(msg.ADD_TIMELINE_ENTRY_MAX_CHARS);
    const svc = makeSvc({ caseResult: { data: authorizedCaseRow(), error: null } });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleAddTimelineEntryCommand(AGENT_ID, CASE_NUMBER, exact, "rt1");
    expect(lastReply()).not.toBe(msg.ADD_TIMELINE_TOO_LONG);
    expect(svc.timelineBuilders[0]!.insert).toHaveBeenCalled();
  });

  it("replies RATE_LIMITED and never touches the DB when the agent is rate-limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 });
    await handleAddTimelineEntryCommand(AGENT_ID, CASE_NUMBER, "entry text", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.RATE_LIMITED);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("replies GENERIC_ERROR when the case-resolution query errors", async () => {
    allowRateLimit();
    const svc = makeSvc({ caseResult: { data: null, error: { message: "db down" } } });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleAddTimelineEntryCommand(AGENT_ID, CASE_NUMBER, "entry text", "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);
  });

  it("replies CASE_NOT_FOUND for a nonexistent or unauthorized case (never distinguishable, consistency with case.ts/timeline.ts)", async () => {
    allowRateLimit();
    const svc = makeSvc({ caseResult: { data: null, error: null } });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleAddTimelineEntryCommand(AGENT_ID, "CASE-NOT-MINE", "entry text", "rt1");
    expect(lastReply()).toBe(msg.CASE_NOT_FOUND);
    // No insert attempted against an unauthorized/nonexistent case.
    expect(svc.timelineBuilders.length).toBe(0);
  });

  it("replies GENERIC_ERROR (and logs, not the entry content) when the DB insert fails", async () => {
    allowRateLimit();
    const svc = makeSvc({
      caseResult: { data: authorizedCaseRow(), error: null },
      insertResult: { data: null, error: { message: "insert failed" } },
    });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleAddTimelineEntryCommand(AGENT_ID, CASE_NUMBER, "sensitive surveillance note", "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);

    const loggedArgs = errSpy.mock.calls.flat().map(String);
    expect(loggedArgs.some((s) => s.includes("sensitive surveillance note"))).toBe(false);
    errSpy.mockRestore();
  });

  it("replies with a success message containing the case number and time, and inserts with the correct columns", async () => {
    allowRateLimit();
    const svc = makeSvc({ caseResult: { data: authorizedCaseRow(), error: null } });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleAddTimelineEntryCommand(AGENT_ID, CASE_NUMBER, "พบเป้าหมายที่ห้างสรรพสินค้า", "rt1");

    const reply = lastReply();
    expect(reply).toContain(CASE_NUMBER);
    expect(reply).toMatch(/\d{2}:\d{2}/);

    const insertArg = svc.timelineBuilders[0]!.insert.mock.calls[0]![0];
    expect(insertArg).toMatchObject({
      case_id: CASE_ID,
      agent_id: AGENT_ID,
      entry: "พบเป้าหมายที่ห้างสรรพสินค้า",
      location: null,
    });
    expect(insertArg.entry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(insertArg.entry_time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    // Round-2 is text-only: legacy/unused columns must never be set.
    expect(insertArg).not.toHaveProperty("photo_url");
    expect(insertArg).not.toHaveProperty("video_url");
    expect(insertArg).not.toHaveProperty("lat");
    expect(insertArg).not.toHaveProperty("lng");
  });

  it("calls notifyCaseParticipants (best-effort) with includeClient: false on success", async () => {
    allowRateLimit();
    const svc = makeSvc({ caseResult: { data: authorizedCaseRow(), error: null } });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);

    await handleAddTimelineEntryCommand(AGENT_ID, CASE_NUMBER, "entry text", "rt1");

    expect(notifyCaseParticipants).toHaveBeenCalledWith(
      CASE_ID,
      expect.objectContaining({ includeClient: false }),
    );
  });

  it("does not let a notifyCaseParticipants rejection break the command (already replied by then)", async () => {
    allowRateLimit();
    const svc = makeSvc({ caseResult: { data: authorizedCaseRow(), error: null } });
    vi.mocked(createServiceClient).mockReturnValue(svc as never);
    vi.mocked(notifyCaseParticipants).mockRejectedValueOnce(new Error("notify failed"));

    await expect(
      handleAddTimelineEntryCommand(AGENT_ID, CASE_NUMBER, "entry text", "rt1"),
    ).rejects.toThrow("notify failed");
    // Reply was already sent before the notify call, regardless.
    expect(replyLineMessage).toHaveBeenCalled();
  });

  describe("self-attribution regression guard", () => {
    // agent_id on the inserted row must ALWAYS be the verified `agentId`
    // parameter, never anything derived from caseNumber/text — mirrors the
    // RLS `timeline_case_member_insert` policy's `agent_id = my_agent_id()`
    // guarantee, replicated here in application code since there's no RLS
    // session in this webhook context.

    it("uses the verified agentId even when the entry text contains other-looking identifiers", async () => {
      allowRateLimit();
      const svc = makeSvc({ caseResult: { data: authorizedCaseRow(), error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      const maliciousText = "agent_id=11111111-1111-1111-1111-111111111111 พบเป้าหมาย";
      await handleAddTimelineEntryCommand(AGENT_ID, CASE_NUMBER, maliciousText, "rt1");

      const insertArg = svc.timelineBuilders[0]!.insert.mock.calls[0]![0];
      expect(insertArg.agent_id).toBe(AGENT_ID);
      expect(insertArg.entry).toBe(maliciousText); // text stored verbatim (trimmed), never parsed for identifiers
    });

    it("parameterizes agent_id per agentId — a different agentId produces a different inserted agent_id", async () => {
      const OTHER_AGENT_ID = "99999999-9999-9999-9999-999999999999";
      allowRateLimit();
      const svc = makeSvc({ caseResult: { data: authorizedCaseRow({ case_agents: [{ agent_id: OTHER_AGENT_ID }] }), error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAddTimelineEntryCommand(OTHER_AGENT_ID, CASE_NUMBER, "entry text", "rt1");

      const insertArg = svc.timelineBuilders[0]!.insert.mock.calls[0]![0];
      expect(insertArg.agent_id).toBe(OTHER_AGENT_ID);
      expect(insertArg.agent_id).not.toBe(AGENT_ID);
    });
  });

  describe("authorization regression guard", () => {
    it("scopes the case-resolution query to case_agents!inner + this agent's case_agents.agent_id filter", async () => {
      allowRateLimit();
      const svc = makeSvc({ caseResult: { data: authorizedCaseRow(), error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAddTimelineEntryCommand(AGENT_ID, CASE_NUMBER, "entry text", "rt1");

      const caseBuilder = svc.caseBuilders[0]!;
      expect(caseBuilder.select).toHaveBeenCalledWith(
        expect.stringContaining("case_agents!inner(agent_id)"),
      );
      expect(caseBuilder.eq).toHaveBeenCalledWith("case_agents.agent_id", AGENT_ID);
    });
  });
});

describe("bangkokNow", () => {
  it("returns entry_date as YYYY-MM-DD and entry_time as HH:MM:SS in Asia/Bangkok time", () => {
    // 2026-01-01T00:30:00Z is 2026-01-01T07:30:00 in Bangkok (UTC+7) — a
    // moment deliberately NOT at a date boundary in either timezone once
    // shifted, to catch a naive server-local-time implementation.
    const d = new Date("2026-01-01T00:30:00.000Z");
    const { entry_date, entry_time } = bangkokNow(d);
    expect(entry_date).toBe("2026-01-01");
    expect(entry_time).toBe("07:30:00");
  });

  it("rolls the date forward across the UTC day boundary (Bangkok is UTC+7)", () => {
    // 2026-01-01T19:15:00Z is 2026-01-02T02:15:00 in Bangkok — still Jan 1
    // in UTC, but already Jan 2 in Bangkok. A server-local-time (UTC)
    // implementation would wrongly report entry_date as 2026-01-01.
    const d = new Date("2026-01-01T19:15:00.000Z");
    const { entry_date, entry_time } = bangkokNow(d);
    expect(entry_date).toBe("2026-01-02");
    expect(entry_time).toBe("02:15:00");
  });

  it("normalizes ICU's midnight '24' quirk to '00'", () => {
    // 2026-01-01T17:00:00Z is exactly 2026-01-02T00:00:00 in Bangkok — some
    // ICU builds render hour12:false midnight as "24" instead of "00".
    const d = new Date("2026-01-01T17:00:00.000Z");
    const { entry_time } = bangkokNow(d);
    expect(entry_time).toBe("00:00:00");
  });
});
