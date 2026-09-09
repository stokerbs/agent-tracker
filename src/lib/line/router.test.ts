import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// handleLinkCommand defers its match-only work (OTP upsert + Twilio send) to
// next/server's after() so the user-facing reply doesn't wait on it (see the
// enumeration-resistance note in router.ts). Collect scheduled callbacks
// instead of letting the mock fire-and-forget them (as the lead/careers route
// tests do) — the assertions below need to await their completion
// deterministically.
const hoisted = vi.hoisted(() => ({ afterCallbacks: [] as Array<() => unknown> }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    hoisted.afterCallbacks.push(fn);
  },
}));

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/sms/twilio", () => ({ sendSms: vi.fn() }));
vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));
vi.mock("@/lib/line/commands/case", () => ({ handleCaseLookupCommand: vi.fn() }));
vi.mock("@/lib/line/commands/timeline", () => ({ handleTimelineListCommand: vi.fn() }));
vi.mock("@/lib/line/commands/add-timeline", () => ({ handleAddTimelineEntryCommand: vi.fn() }));
vi.mock("@/lib/line/commands/attach-photo", () => ({ handleAttachPhotoCommand: vi.fn() }));
vi.mock("@/lib/line/commands/attach-location", () => ({ handleAttachLocationCommand: vi.fn() }));
vi.mock("@/lib/line/commands/intel", () => ({ handleIntelCommand: vi.fn() }));
vi.mock("@/lib/studio/line-inbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/studio/line-inbox")>();
  return { ...actual, captureCustomerMessage: vi.fn(async () => true) };
});
import { captureCustomerMessage } from "@/lib/studio/line-inbox";

import { handleLineMessage, handleLineMediaMessage, parseCommand } from "./router";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms/twilio";
import { replyLineMessage } from "@/lib/line/reply";
import { handleCaseLookupCommand } from "@/lib/line/commands/case";
import { handleTimelineListCommand } from "@/lib/line/commands/timeline";
import { handleAddTimelineEntryCommand } from "@/lib/line/commands/add-timeline";
import { handleAttachPhotoCommand } from "@/lib/line/commands/attach-photo";
import { handleAttachLocationCommand } from "@/lib/line/commands/attach-location";
import { handleIntelCommand } from "@/lib/line/commands/intel";
import { hashOtp, OTP_MAX_ATTEMPTS } from "./otp";
import * as msg from "./messages";

const LINE_USER_ID = "Uabc1234567890";
const AGENT_ID = "22222222-2222-2222-2222-222222222222";
const ACCOUNT_ID = "33333333-3333-3333-3333-333333333333";

type AccountRow = {
  id: string;
  agent_id: string | null;
  phone_at_link_time: string | null;
  otp_code_hash: string | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  otp_requested_at: string | null;
  linked_at: string | null;
  pending_attachment_entry_id?: string | null;
  pending_attachment_case_id?: string | null;
  pending_attachment_expires_at?: string | null;
};

function makeSvc({
  accountRow = null as AccountRow | null,
  fetchError = null as unknown,
  agentsRows = [] as { id: string; phone: string | null }[],
  agentsError = null as unknown,
  upsertResult = { data: { id: ACCOUNT_ID }, error: null } as { data: { id: string } | null; error: unknown },
  updateError = null as unknown,
} = {}) {
  let upsertedWith: unknown;
  const updateCalls: unknown[] = [];

  const client = {
    from(table: string) {
      if (table === "line_accounts") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: accountRow, error: fetchError }) }),
          }),
          upsert: (vals: unknown) => {
            upsertedWith = vals;
            return { select: () => ({ single: async () => upsertResult }) };
          },
          update: (vals: unknown) => {
            updateCalls.push(vals);
            return { eq: async () => ({ error: updateError }) };
          },
        };
      }
      if (table === "agents") {
        return {
          select: () => ({ not: async () => ({ data: agentsRows, error: agentsError }) }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };

  return {
    client,
    get upsertedWith() {
      return upsertedWith;
    },
    updateCalls,
  };
}

function lastReply(): string {
  const calls = vi.mocked(replyLineMessage).mock.calls;
  return calls[calls.length - 1]?.[1] ?? "";
}

/** Run + await every callback handleLinkCommand handed to after(), draining
 * them (and anything they in turn schedule) before assertions run. */
async function flushDeferredWork(): Promise<void> {
  while (hoisted.afterCallbacks.length > 0) {
    const cbs = hoisted.afterCallbacks.splice(0, hoisted.afterCallbacks.length);
    await Promise.all(cbs.map((fn) => fn()));
  }
}

beforeEach(() => {
  hoisted.afterCallbacks.length = 0;
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 10, retryAfterMs: 0 });
  vi.mocked(sendSms).mockResolvedValue({ ok: true });
  vi.mocked(createServiceClient).mockReturnValue(makeSvc().client as never);
});
afterEach(() => {
  hoisted.afterCallbacks.length = 0;
  vi.clearAllMocks();
});

describe("parseCommand", () => {
  it("parses a 6-digit message as a verify command", () => {
    expect(parseCommand("123456")).toEqual({ type: "verify", code: "123456" });
  });

  it("parses Thai link keywords with a phone number", () => {
    expect(parseCommand("ผูกบัญชี 0812345678")).toEqual({ type: "link", phone: "0812345678" });
    expect(parseCommand("link 081-234-5678")).toEqual({ type: "link", phone: "081-234-5678" });
  });

  it("parses Thai case-lookup keyword", () => {
    expect(parseCommand("เคส คดีลักทรัพย์")).toEqual({ type: "case", args: "คดีลักทรัพย์" });
  });

  it("parses Thai timeline keyword", () => {
    expect(parseCommand("ไทม์ไลน์ CASE-001")).toEqual({ type: "timeline", args: "CASE-001" });
  });

  it("falls back to help for anything unrecognized", () => {
    expect(parseCommand("สวัสดีครับ")).toEqual({ type: "help" });
  });

  describe("add-timeline (write) keyword", () => {
    it("parses เพิ่มไทม์ไลน์ with a case number and entry text", () => {
      expect(parseCommand("เพิ่มไทม์ไลน์ CASE-001 พบเป้าหมายที่ห้างสรรพสินค้า")).toEqual({
        type: "add_timeline",
        caseNumber: "CASE-001",
        text: "พบเป้าหมายที่ห้างสรรพสินค้า",
      });
    });

    it("parses บันทึกไทม์ไลน์ with a case number and multi-word entry text", () => {
      expect(parseCommand("บันทึกไทม์ไลน์ CASE-002 เป้าหมายออกจากบ้าน เวลา 10:00")).toEqual({
        type: "add_timeline",
        caseNumber: "CASE-002",
        text: "เป้าหมายออกจากบ้าน เวลา 10:00",
      });
    });

    it("parses the English add-timeline keyword variant", () => {
      expect(parseCommand("add-timeline CASE-003 subject left the residence")).toEqual({
        type: "add_timeline",
        caseNumber: "CASE-003",
        text: "subject left the residence",
      });
    });

    it("does not collide with the plain timeline-list command", () => {
      // The plain list command still parses as "timeline", not "add_timeline".
      expect(parseCommand("ไทม์ไลน์ CASE-001")).toEqual({ type: "timeline", args: "CASE-001" });
      // And the add-timeline keyword never parses as a plain "timeline" list command.
      const parsed = parseCommand("เพิ่มไทม์ไลน์ CASE-001 พบเป้าหมายที่ห้างสรรพสินค้า");
      expect(parsed.type).toBe("add_timeline");
    });

    it("falls back to help when the add-timeline keyword is used with no case number/text", () => {
      expect(parseCommand("เพิ่มไทม์ไลน์")).toEqual({ type: "help" });
    });

    it("falls back to help when the add-timeline keyword is used with only a case number (no entry text)", () => {
      expect(parseCommand("เพิ่มไทม์ไลน์ CASE-001")).toEqual({ type: "help" });
    });
  });

  describe("intel (Round 4) keyword", () => {
    it("parses the Thai ข่าวกรอง keyword with a case number", () => {
      expect(parseCommand("ข่าวกรอง CASE-2026-0042")).toEqual({
        type: "intel",
        caseNumber: "CASE-2026-0042",
      });
    });

    it("parses the English intel keyword variant (case-insensitive)", () => {
      expect(parseCommand("Intel CASE-2026-0042")).toEqual({
        type: "intel",
        caseNumber: "CASE-2026-0042",
      });
    });

    it("trims surrounding whitespace from the case number", () => {
      expect(parseCommand("intel   CASE-2026-0042  ")).toEqual({
        type: "intel",
        caseNumber: "CASE-2026-0042",
      });
    });

    it("falls back to help when the intel keyword is used with no case number", () => {
      expect(parseCommand("intel")).toEqual({ type: "help" });
      expect(parseCommand("ข่าวกรอง")).toEqual({ type: "help" });
    });

    it("does not collide with the case-lookup or timeline commands", () => {
      expect(parseCommand("case CASE-001").type).toBe("case");
      expect(parseCommand("เคส CASE-001").type).toBe("case");
      expect(parseCommand("timeline CASE-001").type).toBe("timeline");
      expect(parseCommand("ไทม์ไลน์ CASE-001").type).toBe("timeline");
      expect(parseCommand("เพิ่มไทม์ไลน์ CASE-001 ข้อความ").type).toBe("add_timeline");
    });

    it("the intel keyword never parses as case/timeline/add-timeline", () => {
      const parsed = parseCommand("ข่าวกรอง CASE-2026-0042");
      expect(parsed.type).toBe("intel");
    });
  });
});

describe("handleLineMessage — unlinked, non link/verify command", () => {
  it("stays SILENT for plain customer text (humans reply in the OA chat)", async () => {
    await handleLineMessage(LINE_USER_ID, "สวัสดี", "rt1");
    expect(replyLineMessage).not.toHaveBeenCalled();
  });

  it("replies with the not-linked help prompt when the sender explicitly asks the bot for help", async () => {
    await handleLineMessage(LINE_USER_ID, "help", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.notLinkedHelp(LINE_USER_ID));
  });

  it("does not call the case/timeline stub handlers but still prompts to link for a command attempt", async () => {
    await handleLineMessage(LINE_USER_ID, "เคส foo", "rt1");
    expect(handleCaseLookupCommand).not.toHaveBeenCalled();
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.notLinkedHelp(LINE_USER_ID));
  });
});

describe("handleLineMessage — link command", () => {
  it("replies LINK_REQUEST_ACK and does not upsert when zero agents match the phone (non-enumerating)", async () => {
    const s = makeSvc({ agentsRows: [] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    expect(lastReply()).toBe(msg.LINK_REQUEST_ACK);
    expect(s.upsertedWith).toBeUndefined();
    expect(sendSms).not.toHaveBeenCalled();
    // Nothing deferred either — the no-match path never schedules after() work.
    expect(hoisted.afterCallbacks).toHaveLength(0);
  });

  it("replies LINK_REQUEST_ACK (same text) when the phone matches more than one agent", async () => {
    const s = makeSvc({
      agentsRows: [
        { id: "a1", phone: "081-234-5678" },
        { id: "a2", phone: "0812345678" },
      ],
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    expect(lastReply()).toBe(msg.LINK_REQUEST_ACK);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("on a unique match: replies LINK_REQUEST_ACK BEFORE the OTP upsert/SMS work runs (latency parity with the no-match path)", async () => {
    const s = makeSvc({ agentsRows: [{ id: AGENT_ID, phone: "0812345678" }] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);

    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");

    // Reply has already gone out, identical to the no-match reply...
    expect(lastReply()).toBe(msg.LINK_REQUEST_ACK);
    // ...and the slow, match-only work has only been *scheduled*, not run yet.
    expect(sendSms).not.toHaveBeenCalled();
    expect(s.upsertedWith).toBeUndefined();
    expect(hoisted.afterCallbacks).toHaveLength(1);
  });

  it("on a unique match, once deferred work runs: upserts line_accounts and sends the OTP by SMS", async () => {
    const s = makeSvc({ agentsRows: [{ id: AGENT_ID, phone: "0812345678" }] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);

    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    await flushDeferredWork();

    expect(sendSms).toHaveBeenCalledTimes(1);
    const [, smsBody] = vi.mocked(sendSms).mock.calls[0]!;
    const otpMatch = smsBody.match(/(\d{6})/);
    expect(otpMatch).not.toBeNull();

    expect(s.upsertedWith).toMatchObject({
      line_user_id: LINE_USER_ID,
      phone_at_link_time: "0812345678",
      otp_attempts: 0,
    });
    const upserted = s.upsertedWith as { otp_code_hash: string };
    expect(upserted.otp_code_hash).toBe(hashOtp(otpMatch![1]!));
    // agent_id/linked_at must never be set by the link step.
    expect(upserted).not.toHaveProperty("agent_id");
    expect(upserted).not.toHaveProperty("linked_at");

    // The reply was already sent (and unaffected) before this deferred work ran.
    expect(lastReply()).toBe(msg.LINK_REQUEST_ACK);
    expect(replyLineMessage).toHaveBeenCalledTimes(1);
  });

  it("checks the target-scoped rate limit (line_otp_request_target) keyed on the resolved agent id, not the LINE user id", async () => {
    const s = makeSvc({ agentsRows: [{ id: AGENT_ID, phone: "0812345678" }] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    await flushDeferredWork();
    expect(checkRateLimit).toHaveBeenCalledWith("line_otp_request_target", AGENT_ID);
  });

  it("when the target-scoped rate limit is exhausted: skips the SMS/upsert entirely but still replies with the SAME LINK_REQUEST_ACK (no distinguishable oracle)", async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (bucket) => {
      if (bucket === "line_otp_request_target") {
        return { allowed: false, remaining: 0, retryAfterMs: 60_000 };
      }
      return { allowed: true, remaining: 10, retryAfterMs: 0 };
    });
    const s = makeSvc({ agentsRows: [{ id: AGENT_ID, phone: "0812345678" }] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);

    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    expect(lastReply()).toBe(msg.LINK_REQUEST_ACK);

    await flushDeferredWork();
    expect(sendSms).not.toHaveBeenCalled();
    expect(s.upsertedWith).toBeUndefined();
    // Still exactly one reply — the rate-limited outcome never produces a
    // second, distinguishable message.
    expect(replyLineMessage).toHaveBeenCalledTimes(1);
  });

  it("silently swallows a Twilio failure — no distinct user-facing reply (would be a match/no-match oracle)", async () => {
    vi.mocked(sendSms).mockResolvedValue({ ok: false, error: "http_400" });
    const s = makeSvc({ agentsRows: [{ id: AGENT_ID, phone: "0812345678" }] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    await flushDeferredWork();
    expect(lastReply()).toBe(msg.LINK_REQUEST_ACK);
    expect(replyLineMessage).toHaveBeenCalledTimes(1);
  });

  it("replies ALREADY_LINKED and skips OTP issuance for an already-linked account", async () => {
    const s = makeSvc({
      accountRow: {
        id: ACCOUNT_ID,
        agent_id: AGENT_ID,
        phone_at_link_time: "0812345678",
        otp_code_hash: null,
        otp_expires_at: null,
        otp_attempts: 0,
        otp_requested_at: null,
        linked_at: "2026-01-01T00:00:00.000Z",
      },
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    expect(lastReply()).toBe(msg.ALREADY_LINKED);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("replies OTP_COOLDOWN when a fresh OTP was just requested", async () => {
    const s = makeSvc({
      accountRow: {
        id: ACCOUNT_ID,
        agent_id: null,
        phone_at_link_time: "0812345678",
        otp_code_hash: "somehash",
        otp_expires_at: new Date(Date.now() + 600_000).toISOString(),
        otp_attempts: 0,
        otp_requested_at: new Date().toISOString(),
        linked_at: null,
      },
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    expect(lastReply()).toBe(msg.OTP_COOLDOWN);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("replies RATE_LIMITED when the per-user OTP-request bucket is exhausted", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 5000 });
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    expect(lastReply()).toBe(msg.RATE_LIMITED);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("replies INVALID_PHONE for an unparseable/too-short phone", async () => {
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 123", "rt1");
    expect(lastReply()).toBe(msg.INVALID_PHONE);
  });

  it("matches across local-vs-international format differences: agent stored E.164, user types local format", async () => {
    const s = makeSvc({ agentsRows: [{ id: AGENT_ID, phone: "+66812345678" }] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    expect(lastReply()).toBe(msg.LINK_REQUEST_ACK);
    // A unique match schedules deferred OTP work (same signal used by the
    // other unique-match tests above) — proves the cross-format phones
    // were recognized as the same number rather than falling into the
    // ambiguous/no-match branch, which is indistinguishable by reply text
    // alone (enumeration-resistance).
    expect(hoisted.afterCallbacks).toHaveLength(1);
    await flushDeferredWork();
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it("matches across local-vs-international format differences: agent stored local format, user types E.164", async () => {
    const s = makeSvc({ agentsRows: [{ id: AGENT_ID, phone: "0812345678" }] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี +66812345678", "rt1");
    expect(lastReply()).toBe(msg.LINK_REQUEST_ACK);
    expect(hoisted.afterCallbacks).toHaveLength(1);
    await flushDeferredWork();
    expect(sendSms).toHaveBeenCalledTimes(1);
  });
});

describe("handleLineMessage — verify command", () => {
  const pendingAccount = (overrides: Partial<AccountRow> = {}): AccountRow => ({
    id: ACCOUNT_ID,
    agent_id: null,
    phone_at_link_time: "0812345678",
    otp_code_hash: hashOtp("123456"),
    otp_expires_at: new Date(Date.now() + 600_000).toISOString(),
    otp_attempts: 0,
    otp_requested_at: new Date().toISOString(),
    linked_at: null,
    ...overrides,
  });

  it("replies NO_PENDING_LINK when there is no line_accounts row at all", async () => {
    await handleLineMessage(LINE_USER_ID, "123456", "rt1");
    expect(lastReply()).toBe(msg.NO_PENDING_LINK);
  });

  it("replies NO_PENDING_LINK when the row has no outstanding OTP", async () => {
    const s = makeSvc({ accountRow: pendingAccount({ otp_code_hash: null, otp_expires_at: null }) });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "123456", "rt1");
    expect(lastReply()).toBe(msg.NO_PENDING_LINK);
  });

  it("replies OTP_LOCKED once otp_attempts has already reached the max", async () => {
    const s = makeSvc({ accountRow: pendingAccount({ otp_attempts: OTP_MAX_ATTEMPTS }) });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "123456", "rt1");
    expect(lastReply()).toBe(msg.OTP_LOCKED);
  });

  it("replies OTP_EXPIRED for an expired OTP", async () => {
    const s = makeSvc({
      accountRow: pendingAccount({ otp_expires_at: new Date(Date.now() - 1000).toISOString() }),
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "123456", "rt1");
    expect(lastReply()).toBe(msg.OTP_EXPIRED);
  });

  it("replies RATE_LIMITED when the per-user verify bucket is exhausted", async () => {
    const s = makeSvc({ accountRow: pendingAccount() });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 });
    await handleLineMessage(LINE_USER_ID, "123456", "rt1");
    expect(lastReply()).toBe(msg.RATE_LIMITED);
  });

  it("on a wrong code: increments otp_attempts and replies OTP_INVALID (not locked out yet)", async () => {
    const s = makeSvc({ accountRow: pendingAccount({ otp_attempts: 1 }) });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "000000", "rt1");
    expect(s.updateCalls).toEqual([{ otp_attempts: 2 }]);
    expect(lastReply()).toBe(msg.OTP_INVALID);
  });

  it("on a wrong code that reaches OTP_MAX_ATTEMPTS: replies OTP_LOCKED", async () => {
    const s = makeSvc({ accountRow: pendingAccount({ otp_attempts: OTP_MAX_ATTEMPTS - 1 }) });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "000000", "rt1");
    expect(s.updateCalls).toEqual([{ otp_attempts: OTP_MAX_ATTEMPTS }]);
    expect(lastReply()).toBe(msg.OTP_LOCKED);
  });

  it("on the correct code: re-resolves the agent, sets agent_id/linked_at, clears OTP fields, replies LINK_SUCCESS", async () => {
    const s = makeSvc({
      accountRow: pendingAccount(),
      agentsRows: [{ id: AGENT_ID, phone: "0812345678" }],
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "123456", "rt1");

    expect(s.updateCalls).toEqual([
      expect.objectContaining({
        agent_id: AGENT_ID,
        linked_at: expect.any(String),
        otp_code_hash: null,
        otp_expires_at: null,
        otp_attempts: 0,
        otp_requested_at: null,
      }),
    ]);
    expect(lastReply()).toBe(msg.LINK_SUCCESS);
  });

  it("replies GENERIC_ERROR when the phone no longer resolves to a unique agent at verify time", async () => {
    const s = makeSvc({ accountRow: pendingAccount(), agentsRows: [] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "123456", "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);
    expect(s.updateCalls).toEqual([]);
  });

  it("replies AGENT_ALREADY_LINKED when the final link update hits a unique-violation (23505) race", async () => {
    const s = makeSvc({
      accountRow: pendingAccount(),
      agentsRows: [{ id: AGENT_ID, phone: "0812345678" }],
      updateError: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "123456", "rt1");
    expect(lastReply()).toBe(msg.AGENT_ALREADY_LINKED);
  });

  it("replies GENERIC_ERROR when the final link update fails for a non-unique-violation reason", async () => {
    const s = makeSvc({
      accountRow: pendingAccount(),
      agentsRows: [{ id: AGENT_ID, phone: "0812345678" }],
      updateError: { code: "08006", message: "connection failure" },
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "123456", "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);
  });

  it("replies ALREADY_LINKED when the account is already linked (idempotent re-verify)", async () => {
    const s = makeSvc({ accountRow: pendingAccount({ agent_id: AGENT_ID, linked_at: "2026-01-01T00:00:00.000Z" }) });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "123456", "rt1");
    expect(lastReply()).toBe(msg.ALREADY_LINKED);
  });
});

describe("handleLineMessage — linked-user commands", () => {
  const linkedAccount: AccountRow = {
    id: ACCOUNT_ID,
    agent_id: AGENT_ID,
    phone_at_link_time: "0812345678",
    otp_code_hash: null,
    otp_expires_at: null,
    otp_attempts: 0,
    otp_requested_at: null,
    linked_at: "2026-01-01T00:00:00.000Z",
  };

  it("dispatches a case-lookup command to handleCaseLookupCommand with the resolved agentId", async () => {
    const s = makeSvc({ accountRow: linkedAccount });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "เคส ลักทรัพย์", "rt1");
    expect(handleCaseLookupCommand).toHaveBeenCalledWith(AGENT_ID, "ลักทรัพย์", "rt1");
    expect(replyLineMessage).not.toHaveBeenCalled();
  });

  it("dispatches a timeline command to handleTimelineListCommand with the resolved agentId", async () => {
    const s = makeSvc({ accountRow: linkedAccount });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ไทม์ไลน์ CASE-001", "rt1");
    expect(handleTimelineListCommand).toHaveBeenCalledWith(AGENT_ID, "CASE-001", "rt1");
  });

  it("dispatches an add-timeline command to handleAddTimelineEntryCommand with the resolved agentId", async () => {
    const s = makeSvc({ accountRow: linkedAccount });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "เพิ่มไทม์ไลน์ CASE-001 พบเป้าหมายที่ห้างสรรพสินค้า", "rt1");
    expect(handleAddTimelineEntryCommand).toHaveBeenCalledWith(
      AGENT_ID,
      "CASE-001",
      "พบเป้าหมายที่ห้างสรรพสินค้า",
      "rt1",
    );
    expect(replyLineMessage).not.toHaveBeenCalled();
  });

  it("gates the add-timeline command behind linked status same as other commands", async () => {
    await handleLineMessage(LINE_USER_ID, "เพิ่มไทม์ไลน์ CASE-001 พบเป้าหมายที่ห้างสรรพสินค้า", "rt1");
    expect(handleAddTimelineEntryCommand).not.toHaveBeenCalled();
    expect(lastReply()).toBe(msg.notLinkedHelp(LINE_USER_ID));
  });

  it("dispatches an intel command to handleIntelCommand with the resolved agentId", async () => {
    const s = makeSvc({ accountRow: linkedAccount });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ข่าวกรอง CASE-2026-0042", "rt1");
    expect(handleIntelCommand).toHaveBeenCalledWith(AGENT_ID, "CASE-2026-0042", "rt1");
    expect(replyLineMessage).not.toHaveBeenCalled();
  });

  it("gates the intel command behind linked status same as other commands", async () => {
    await handleLineMessage(LINE_USER_ID, "ข่าวกรอง CASE-2026-0042", "rt1");
    expect(handleIntelCommand).not.toHaveBeenCalled();
    expect(lastReply()).toBe(msg.notLinkedHelp(LINE_USER_ID));
  });

  it("replies with LINKED_HELP for an unrecognized command from a linked user", async () => {
    const s = makeSvc({ accountRow: linkedAccount });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "สวัสดี", "rt1");
    expect(lastReply()).toBe(msg.LINKED_HELP);
  });
});

describe("handleLineMessage — line_accounts lookup failure", () => {
  it("replies GENERIC_ERROR when the initial line_accounts fetch errors", async () => {
    const s = makeSvc({ fetchError: { message: "db down" } });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "สวัสดี", "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);
  });
});

describe("handleLineMediaMessage (Round 3 — image/location dispatch)", () => {
  const FUTURE = new Date(Date.now() + 5 * 60_000).toISOString();
  const PAST = new Date(Date.now() - 5 * 60_000).toISOString();
  const PENDING_ENTRY_ID = "entry-1";
  const PENDING_CASE_ID = "case-1";

  const linkedAccount = (overrides: Partial<AccountRow> = {}): AccountRow => ({
    id: ACCOUNT_ID,
    agent_id: AGENT_ID,
    phone_at_link_time: "0812345678",
    otp_code_hash: null,
    otp_expires_at: null,
    otp_attempts: 0,
    otp_requested_at: null,
    linked_at: "2026-01-01T00:00:00.000Z",
    pending_attachment_entry_id: null,
    pending_attachment_case_id: null,
    pending_attachment_expires_at: null,
    ...overrides,
  });

  it("gates behind linked status — unlinked media is ignored silently and never dispatched", async () => {
    await handleLineMediaMessage(LINE_USER_ID, { type: "image", messageId: "m1" }, "rt1");
    expect(handleAttachPhotoCommand).not.toHaveBeenCalled();
    expect(handleAttachLocationCommand).not.toHaveBeenCalled();
    expect(replyLineMessage).not.toHaveBeenCalled();
  });

  it("replies GENERIC_ERROR when the line_accounts fetch errors", async () => {
    const s = makeSvc({ fetchError: { message: "db down" } });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMediaMessage(LINE_USER_ID, { type: "image", messageId: "m1" }, "rt1");
    expect(lastReply()).toBe(msg.GENERIC_ERROR);
    expect(handleAttachPhotoCommand).not.toHaveBeenCalled();
  });

  it("replies NO_PENDING_ATTACHMENT (empty-state, not GENERIC_ERROR) when no window is open", async () => {
    const s = makeSvc({ accountRow: linkedAccount() });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMediaMessage(LINE_USER_ID, { type: "image", messageId: "m1" }, "rt1");
    expect(lastReply()).toBe(msg.NO_PENDING_ATTACHMENT);
    expect(lastReply()).not.toBe(msg.GENERIC_ERROR);
    expect(handleAttachPhotoCommand).not.toHaveBeenCalled();
  });

  it("replies NO_PENDING_ATTACHMENT when the window has already expired", async () => {
    const s = makeSvc({
      accountRow: linkedAccount({
        pending_attachment_entry_id: PENDING_ENTRY_ID,
        pending_attachment_case_id: PENDING_CASE_ID,
        pending_attachment_expires_at: PAST,
      }),
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMediaMessage(LINE_USER_ID, { type: "image", messageId: "m1" }, "rt1");
    expect(lastReply()).toBe(msg.NO_PENDING_ATTACHMENT);
    expect(handleAttachPhotoCommand).not.toHaveBeenCalled();
  });

  it("dispatches an image message to handleAttachPhotoCommand with agentId/pendingCaseId/pendingEntryId/messageId when a valid window is open", async () => {
    const s = makeSvc({
      accountRow: linkedAccount({
        pending_attachment_entry_id: PENDING_ENTRY_ID,
        pending_attachment_case_id: PENDING_CASE_ID,
        pending_attachment_expires_at: FUTURE,
      }),
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMediaMessage(LINE_USER_ID, { type: "image", messageId: "m1" }, "rt1");
    expect(handleAttachPhotoCommand).toHaveBeenCalledWith(
      AGENT_ID,
      PENDING_CASE_ID,
      PENDING_ENTRY_ID,
      "m1",
      "rt1",
    );
    expect(handleAttachLocationCommand).not.toHaveBeenCalled();
    expect(replyLineMessage).not.toHaveBeenCalled();
  });

  it("dispatches a location message to handleAttachLocationCommand with agentId/pendingCaseId/pendingEntryId/lat/lng/address when a valid window is open", async () => {
    const s = makeSvc({
      accountRow: linkedAccount({
        pending_attachment_entry_id: PENDING_ENTRY_ID,
        pending_attachment_case_id: PENDING_CASE_ID,
        pending_attachment_expires_at: FUTURE,
      }),
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMediaMessage(
      LINE_USER_ID,
      { type: "location", latitude: 13.75, longitude: 100.5, address: "123 Main St" },
      "rt1",
    );
    expect(handleAttachLocationCommand).toHaveBeenCalledWith(
      AGENT_ID,
      PENDING_CASE_ID,
      PENDING_ENTRY_ID,
      13.75,
      100.5,
      "123 Main St",
      "rt1",
    );
    expect(handleAttachPhotoCommand).not.toHaveBeenCalled();
  });
});

describe("customer-message capture (Creative Studio inbox)", () => {
  it("captureCustomerMessage is called for unlinked free text, with no bot reply", async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSvc().client as never);
    await handleLineMessage("Uunlinked", "ติด GPS รถแฟนได้ไหม", "tok");
    expect(vi.mocked(captureCustomerMessage)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(captureCustomerMessage).mock.calls[0][0]).toMatchObject({ lineUserId: "Uunlinked", text: "ติด GPS รถแฟนได้ไหม", isLinkedAgent: false });
    expect(replyLineMessage).not.toHaveBeenCalled();
  });
  it("is NOT called for unlinked link/verify commands", async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSvc().client as never);
    await handleLineMessage("Uunlinked", "ผูกบัญชี 0812345678", "tok");
    await handleLineMessage("Uunlinked", "123456", "tok");
    expect(vi.mocked(captureCustomerMessage)).not.toHaveBeenCalled();
  });
  it("is NOT called for linked agents", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSvc({
        accountRow: {
          id: "33333333-3333-3333-3333-333333333333",
          agent_id: AGENT_ID,
          phone_at_link_time: "0812345678",
          otp_code_hash: null,
          otp_expires_at: null,
          otp_attempts: 0,
          otp_requested_at: null,
          linked_at: "2026-01-01T00:00:00.000Z",
          pending_attachment_entry_id: null,
          pending_attachment_case_id: null,
          pending_attachment_expires_at: null,
        } as never,
      }).client as never,
    );
    await handleLineMessage("Ulinked", "สวัสดีครับ", "tok");
    expect(vi.mocked(captureCustomerMessage)).not.toHaveBeenCalled();
  });
});
