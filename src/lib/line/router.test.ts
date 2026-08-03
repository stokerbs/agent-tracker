import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/sms/twilio", () => ({ sendSms: vi.fn() }));
vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));
vi.mock("@/lib/line/commands/case", () => ({ handleCaseLookupCommand: vi.fn() }));
vi.mock("@/lib/line/commands/timeline", () => ({ handleTimelineListCommand: vi.fn() }));

import { handleLineMessage, parseCommand } from "./router";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms/twilio";
import { replyLineMessage } from "@/lib/line/reply";
import { handleCaseLookupCommand } from "@/lib/line/commands/case";
import { handleTimelineListCommand } from "@/lib/line/commands/timeline";
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

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 10, retryAfterMs: 0 });
  vi.mocked(sendSms).mockResolvedValue({ ok: true });
  vi.mocked(createServiceClient).mockReturnValue(makeSvc().client as never);
});
afterEach(() => vi.clearAllMocks());

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
});

describe("handleLineMessage — unlinked, non link/verify command", () => {
  it("replies with the not-linked help prompt (including the userId)", async () => {
    await handleLineMessage(LINE_USER_ID, "สวัสดี", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.notLinkedHelp(LINE_USER_ID));
  });

  it("does not call the case/timeline stub handlers", async () => {
    await handleLineMessage(LINE_USER_ID, "เคส foo", "rt1");
    expect(handleCaseLookupCommand).not.toHaveBeenCalled();
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.notLinkedHelp(LINE_USER_ID));
  });
});

describe("handleLineMessage — link command", () => {
  it("replies NO_MATCH and does not upsert when zero agents match the phone (non-enumerating)", async () => {
    const s = makeSvc({ agentsRows: [] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    expect(lastReply()).toBe(msg.NO_MATCH);
    expect(s.upsertedWith).toBeUndefined();
  });

  it("replies NO_MATCH (same text) when the phone matches more than one agent", async () => {
    const s = makeSvc({
      agentsRows: [
        { id: "a1", phone: "081-234-5678" },
        { id: "a2", phone: "0812345678" },
      ],
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    expect(lastReply()).toBe(msg.NO_MATCH);
  });

  it("on a unique match: upserts line_accounts, sends the OTP by SMS, and replies OTP_SENT", async () => {
    const s = makeSvc({ agentsRows: [{ id: AGENT_ID, phone: "0812345678" }] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);

    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");

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

    expect(lastReply()).toBe(msg.OTP_SENT);
  });

  it("replies SMS_FAILED (but has already upserted the OTP) when Twilio fails", async () => {
    vi.mocked(sendSms).mockResolvedValue({ ok: false, error: "http_400" });
    const s = makeSvc({ agentsRows: [{ id: AGENT_ID, phone: "0812345678" }] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await handleLineMessage(LINE_USER_ID, "ผูกบัญชี 0812345678", "rt1");
    expect(lastReply()).toBe(msg.SMS_FAILED);
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
