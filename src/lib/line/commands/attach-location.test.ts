import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { handleAttachLocationCommand } from "./attach-location";
import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessage } from "@/lib/line/reply";
import { checkRateLimit } from "@/lib/rate-limit";
import * as msg from "@/lib/line/messages";

const AGENT_ID = "22222222-2222-2222-2222-222222222222";
const CASE_ID = "case-1";
const ENTRY_ID = "entry-1";
const REPLY_TOKEN = "rt1";
const LAT = 13.7563;
const LNG = 100.5018;

type Result = { data: unknown; error: unknown };

/** Minimal chainable stand-in for the `case_agents` membership SELECT:
 * `svc.from("case_agents").select(...).eq("case_id", ...).eq("agent_id", ...).maybeSingle()`. */
function membershipChainable(result: Result) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(async () => result);
  return b as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
}

/** Minimal chainable stand-in for the `timeline_entries` UPDATE:
 * `svc.from("timeline_entries").update(vals).eq(...).eq(...).eq(...).is(...).select(...).maybeSingle()`. */
function updateChainable(result: Result) {
  const b: Record<string, unknown> = {};
  for (const m of ["update", "eq", "is", "select"]) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(async () => result);
  return b as {
    update: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
}

type MembershipBuilder = ReturnType<typeof membershipChainable>;
type UpdateBuilder = ReturnType<typeof updateChainable>;

function makeSvc({
  membershipResult,
  updateResult,
}: {
  membershipResult: Result;
  updateResult?: Result;
}) {
  const membershipBuilders: MembershipBuilder[] = [];
  const updateBuilders: UpdateBuilder[] = [];
  return {
    membershipBuilders,
    updateBuilders,
    from(table: string) {
      if (table === "case_agents") {
        const b = membershipChainable(membershipResult);
        membershipBuilders.push(b);
        return b;
      }
      if (table === "timeline_entries") {
        const b = updateChainable(updateResult ?? { data: { id: ENTRY_ID }, error: null });
        updateBuilders.push(b);
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

function allowRateLimit() {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 1, retryAfterMs: 0 });
}

const AUTHORIZED_MEMBERSHIP: Result = { data: { case_id: CASE_ID }, error: null };

afterEach(() => vi.clearAllMocks());

describe("handleAttachLocationCommand", () => {
  describe("coordinate validation", () => {
    it.each([
      ["latitude too high", 91, LNG],
      ["latitude too low", -91, LNG],
      ["longitude too high", LAT, 181],
      ["longitude too low", LAT, -181],
      ["NaN latitude", NaN, LNG],
      ["NaN longitude", LAT, NaN],
      ["Infinity latitude", Infinity, LNG],
      ["-Infinity longitude", LAT, -Infinity],
    ])("rejects %s without touching the DB", async (_label, lat, lng) => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, lat, lng, null, REPLY_TOKEN);
      expect(lastReply()).toBe(msg.GENERIC_ERROR);
      expect(createServiceClient).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it("accepts boundary values (±90 lat, ±180 lng)", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: AUTHORIZED_MEMBERSHIP });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, 90, 180, null, REPLY_TOKEN);
      expect(lastReply()).not.toBe(msg.GENERIC_ERROR);
    });
  });

  it("replies RATE_LIMITED and never touches the DB when the agent is rate-limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 });
    await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, null, REPLY_TOKEN);
    expect(replyLineMessage).toHaveBeenCalledWith(REPLY_TOKEN, msg.RATE_LIMITED);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  describe("re-authorization (TOCTOU)", () => {
    it("replies GENERIC_ERROR when the membership-check query errors", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: { data: null, error: { message: "db down" } } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, null, REPLY_TOKEN);
      expect(lastReply()).toBe(msg.GENERIC_ERROR);
      expect(svc.updateBuilders.length).toBe(0);
      errSpy.mockRestore();
    });

    it("replies ATTACH_LOCATION_UNAUTHORIZED (generic, non-enumerating) when the agent is no longer assigned, and never writes", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: { data: null, error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, "123 Main St", REPLY_TOKEN);
      expect(lastReply()).toBe(msg.ATTACH_LOCATION_UNAUTHORIZED);
      expect(svc.updateBuilders.length).toBe(0);
    });

    it("scopes the membership check to the exact (case_id, agent_id) pair — regression guard against a blind mock", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: AUTHORIZED_MEMBERSHIP });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, null, REPLY_TOKEN);

      const b = svc.membershipBuilders[0]!;
      expect(b.eq).toHaveBeenCalledWith("case_id", CASE_ID);
      expect(b.eq).toHaveBeenCalledWith("agent_id", AGENT_ID);
    });

    it("re-checks membership for a DIFFERENT agentId/caseId pair, proving the filter is parameterized, not hardcoded", async () => {
      const OTHER_AGENT_ID = "99999999-9999-9999-9999-999999999999";
      const OTHER_CASE_ID = "case-2";
      allowRateLimit();
      const svc = makeSvc({ membershipResult: { data: { case_id: OTHER_CASE_ID }, error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(OTHER_AGENT_ID, OTHER_CASE_ID, ENTRY_ID, LAT, LNG, null, REPLY_TOKEN);

      const b = svc.membershipBuilders[0]!;
      expect(b.eq).toHaveBeenCalledWith("case_id", OTHER_CASE_ID);
      expect(b.eq).toHaveBeenCalledWith("agent_id", OTHER_AGENT_ID);
      expect(b.eq).not.toHaveBeenCalledWith("case_id", CASE_ID);
      expect(b.eq).not.toHaveBeenCalledWith("agent_id", AGENT_ID);
    });
  });

  describe("location text construction", () => {
    it("prefers LINE's address when present", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: AUTHORIZED_MEMBERSHIP });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, "123 Main St, Bangkok", REPLY_TOKEN);

      const updateArg = svc.updateBuilders[0]!.update.mock.calls[0]![0] as { location: string };
      expect(updateArg.location).toBe("123 Main St, Bangkok");
    });

    it("trims whitespace-only address to the coordinate fallback", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: AUTHORIZED_MEMBERSHIP });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, "   ", REPLY_TOKEN);

      const updateArg = svc.updateBuilders[0]!.update.mock.calls[0]![0] as { location: string };
      expect(updateArg.location).toBe(`${LAT.toFixed(5)}, ${LNG.toFixed(5)}`);
    });

    it("falls back to a formatted coordinate string when address is null", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: AUTHORIZED_MEMBERSHIP });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, null, REPLY_TOKEN);

      const updateArg = svc.updateBuilders[0]!.update.mock.calls[0]![0] as { location: string };
      expect(updateArg.location).toBe("13.75630, 100.50180");
    });

    it("includes a Google Maps link built from the raw lat/lng (not the address) in the success reply", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: AUTHORIZED_MEMBERSHIP });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, "123 Main St", REPLY_TOKEN);

      const reply = lastReply();
      expect(reply).toContain("123 Main St");
      expect(reply).toContain(
        `(Maps: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${LAT},${LNG}`)})`,
      );
    });

    it("includes a Google Maps link built from lat/lng even in the coordinate-fallback case", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: AUTHORIZED_MEMBERSHIP });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, null, REPLY_TOKEN);

      const reply = lastReply();
      expect(reply).toContain(
        `(Maps: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${LAT},${LNG}`)})`,
      );
    });
  });

  describe("DB update", () => {
    it("updates by pendingEntryId, scoped to pendingCaseId/agentId, and touches ONLY the location column", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: AUTHORIZED_MEMBERSHIP });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, "123 Main St", REPLY_TOKEN);

      const b = svc.updateBuilders[0]!;
      const updateArg = b.update.mock.calls[0]![0];
      expect(Object.keys(updateArg)).toEqual(["location"]);
      expect(updateArg).not.toHaveProperty("entry");
      expect(updateArg).not.toHaveProperty("entry_date");
      expect(updateArg).not.toHaveProperty("entry_time");
      expect(updateArg).not.toHaveProperty("agent_id");
      expect(updateArg).not.toHaveProperty("lat");
      expect(updateArg).not.toHaveProperty("lng");

      expect(b.eq).toHaveBeenCalledWith("id", ENTRY_ID);
      expect(b.eq).toHaveBeenCalledWith("case_id", CASE_ID);
      expect(b.eq).toHaveBeenCalledWith("agent_id", AGENT_ID);
      expect(b.is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("replies GENERIC_ERROR when the update query errors", async () => {
      allowRateLimit();
      const svc = makeSvc({
        membershipResult: AUTHORIZED_MEMBERSHIP,
        updateResult: { data: null, error: { message: "update failed" } },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, null, REPLY_TOKEN);
      expect(lastReply()).toBe(msg.GENERIC_ERROR);
      errSpy.mockRestore();
    });

    it("replies GENERIC_ERROR when the update matches no row (belt-and-suspenders mismatch)", async () => {
      allowRateLimit();
      const svc = makeSvc({
        membershipResult: AUTHORIZED_MEMBERSHIP,
        updateResult: { data: null, error: null },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, null, REPLY_TOKEN);
      expect(lastReply()).toBe(msg.GENERIC_ERROR);
      errSpy.mockRestore();
    });

    it("replies with a success message on a successful update", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: AUTHORIZED_MEMBERSHIP });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, "123 Main St", REPLY_TOKEN);
      const reply = lastReply();
      expect(reply).not.toBe(msg.GENERIC_ERROR);
      expect(reply).not.toBe(msg.ATTACH_LOCATION_UNAUTHORIZED);
      expect(reply).toContain("123 Main St");
    });
  });

  describe("pending-attachment window is left untouched", () => {
    it("never queries/updates line_accounts on a successful update", async () => {
      allowRateLimit();
      const svc = makeSvc({ membershipResult: AUTHORIZED_MEMBERSHIP });
      const fromSpy = vi.fn(svc.from.bind(svc));
      vi.mocked(createServiceClient).mockReturnValue({ from: fromSpy } as never);

      await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, LAT, LNG, "123 Main St", REPLY_TOKEN);

      const tables = fromSpy.mock.calls.map((c) => c[0]);
      expect(tables).not.toContain("line_accounts");
    });
  });
});
