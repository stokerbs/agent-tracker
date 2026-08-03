import "server-only";

import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/security/encryption";
import { parsePhone } from "@/lib/contact/phone";
import { sendSms } from "@/lib/sms/twilio";
import { replyLineMessage } from "@/lib/line/reply";
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  isOtpExpired,
  canRequestNewOtp,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
} from "@/lib/line/otp";
import * as msg from "@/lib/line/messages";
import { handleCaseLookupCommand } from "@/lib/line/commands/case";
import { handleTimelineListCommand } from "@/lib/line/commands/timeline";
import { handleAddTimelineEntryCommand } from "@/lib/line/commands/add-timeline";

/**
 * Command router/dispatcher for the LINE-bot webhook (Round 1: phone+OTP
 * account linking, plus a gate for the case/timeline commands implemented
 * elsewhere — see src/lib/line/commands/case.ts and
 * src/lib/line/commands/timeline.ts (read-only) and
 * src/lib/line/commands/add-timeline.ts (write, Round 2 — text-only case
 * timeline entries, see that file's module doc) for that extension point).
 *
 * Every inbound text message flows through handleLineMessage(), which:
 *   1. Resolves the LINE user (source.userId) -> line_accounts row -> agent_id.
 *      This is the ONLY place agent identity is derived; every downstream
 *      command handler receives an already-resolved, already-verified
 *      agentId — never a raw value from the LINE payload.
 *   2. Parses the message text into a Command (see parseCommand()).
 *   3. "link" and "verify" are always handled regardless of link state (you
 *      have to be able to link/verify precisely because you aren't linked
 *      yet). Every OTHER command is gated behind "is this LINE user linked" —
 *      unlinked users get a help/link-prompt message instead.
 *
 * Uses the service-role Supabase client throughout: a LINE webhook request
 * carries no Supabase session/auth.uid(), so there is no user-scoped client
 * to use here (same rationale documented in
 * supabase/migrations/0109_line_accounts.sql). Authorization is enforced in
 * this application layer instead (LINE signature verification happens
 * upstream in route.ts; OTP possession proves phone ownership here).
 */

/** Shape of the columns selected from line_accounts by handleLineMessage() below. */
type LineAccountLookup = {
  id: string;
  agent_id: string | null;
  phone_at_link_time: string | null;
  otp_code_hash: string | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  otp_requested_at: string | null;
  linked_at: string | null;
};

type AgentPhoneRow = { id: string; phone: string | null };

// ── Command parsing ─────────────────────────────────────────────────────────

type Command =
  | { type: "link"; phone: string }
  | { type: "verify"; code: string }
  | { type: "case"; args: string }
  | { type: "timeline"; args: string }
  | { type: "add_timeline"; caseNumber: string; text: string }
  | { type: "help" };

const LINK_KEYWORDS = /^(?:link|ผูกบัญชี|ผูก|เชื่อมบัญชี|เชื่อมต่อบัญชี)\s+(.+)$/iu;
const CASE_KEYWORDS = /^(?:case|เคส)\s+(.+)$/iu;
const TIMELINE_KEYWORDS = /^(?:timeline|ไทม์ไลน์|ไทม์ไลน)\s*(.*)$/iu;
// Write command (Round 2): "เพิ่มไทม์ไลน์ <รหัสเคส> <ข้อความ>" / "บันทึกไทม์ไลน์ <รหัสเคส> <ข้อความ>".
// First captured group is the case number, second is the entry text. Its
// keyword prefixes ("เพิ่มไทม์ไลน์"/"บันทึกไทม์ไลน์") never start with, and so
// never collide with, the plain TIMELINE_KEYWORDS prefixes ("timeline" /
// "ไทม์ไลน์" / "ไทม์ไลน") — still checked BEFORE TIMELINE_KEYWORDS in
// parseCommand() below out of caution, since TIMELINE_KEYWORDS' `\s*(.*)`
// tail is unanchored/greedy enough that any future edit narrowing its
// keyword list could otherwise silently start swallowing this command.
const ADD_TIMELINE_KEYWORDS = /^(?:add.?timeline|เพิ่มไทม์ไลน์|บันทึกไทม์ไลน์)\s+(\S+)\s+(.+)$/iu;
const OTP_PATTERN = /^\d{6}$/;

/** Forgiving text-command parser — see module doc for the design rationale. */
export function parseCommand(raw: string): Command {
  const text = raw.trim();

  if (OTP_PATTERN.test(text)) return { type: "verify", code: text };

  const link = text.match(LINK_KEYWORDS);
  if (link) return { type: "link", phone: link[1]!.trim() };

  const caseMatch = text.match(CASE_KEYWORDS);
  if (caseMatch) return { type: "case", args: caseMatch[1]!.trim() };

  // Checked before TIMELINE_KEYWORDS — see the constant's comment above.
  const addTimeline = text.match(ADD_TIMELINE_KEYWORDS);
  if (addTimeline) {
    return { type: "add_timeline", caseNumber: addTimeline[1]!.trim(), text: addTimeline[2]!.trim() };
  }

  const timeline = text.match(TIMELINE_KEYWORDS);
  if (timeline) return { type: "timeline", args: timeline[1]!.trim() };

  return { type: "help" };
}

// ── Logging helpers ──────────────────────────────────────────────────────────

/** Never log a full LINE userId or phone/OTP — a short, non-reversible-enough reference is enough for correlating log lines. */
function redact(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

// ── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * Handle one inbound LINE text message. Called by the webhook route for
 * every `message` event with `message.type === "text"`.
 */
export async function handleLineMessage(
  lineUserId: string,
  text: string,
  replyToken: string,
): Promise<void> {
  const svc = createServiceClient();
  const command = parseCommand(text);

  const { data: account, error: fetchError } = await svc
    .from("line_accounts")
    .select(
      "id, agent_id, phone_at_link_time, otp_code_hash, otp_expires_at, otp_attempts, otp_requested_at, linked_at",
    )
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (fetchError) {
    console.error(`[line:router] line_accounts lookup failed userId=${redact(lineUserId)}`, fetchError);
    await replyLineMessage(replyToken, msg.GENERIC_ERROR);
    return;
  }

  const isLinked = Boolean(account?.agent_id && account?.linked_at);

  console.log(
    `[line:router] dispatch userId=${redact(lineUserId)} command=${command.type} linked=${isLinked}`,
  );

  if (command.type === "link") {
    await handleLinkCommand(svc, lineUserId, account, command.phone, replyToken);
    return;
  }

  if (command.type === "verify") {
    await handleVerifyCommand(svc, lineUserId, account, command.code, replyToken);
    return;
  }

  // Every other command is gated behind "is this LINE user linked".
  if (!isLinked) {
    console.log(`[line:router] blocked unlinked user command=${command.type} userId=${redact(lineUserId)}`);
    await replyLineMessage(replyToken, msg.notLinkedHelp(lineUserId));
    return;
  }

  const agentId = account!.agent_id!;
  switch (command.type) {
    case "case":
      await handleCaseLookupCommand(agentId, command.args, replyToken);
      return;
    case "timeline":
      await handleTimelineListCommand(agentId, command.args, replyToken);
      return;
    case "add_timeline":
      await handleAddTimelineEntryCommand(agentId, command.caseNumber, command.text, replyToken);
      return;
    default:
      await replyLineMessage(replyToken, msg.LINKED_HELP);
  }
}

// ── link command ──────────────────────────────────────────────────────────

/**
 * Compares two phone values for equality, canonicalizing local-vs-
 * international format differences via parsePhone()'s TH-region E.164 output
 * when BOTH sides parse to a possible number (e.g. "0812345678" and
 * "+66 81 234 5678" are the same number but normalizePhone()'s naive
 * digit-strip alone ("0812345678" vs "66812345678") would never say so).
 * Falls back to the plain digit-only compare when either side fails to
 * parse — agents.phone is free-text and not guaranteed to be a valid TH
 * number, so an unparseable stored value must not newly become a non-match
 * for everything; it just loses the format-canonicalization benefit.
 */
function phoneMatches(a: string, b: string): boolean {
  const pa = parsePhone(a, "TH");
  const pb = parsePhone(b, "TH");
  if (pa.e164 && pb.e164) return pa.e164 === pb.e164;
  return normalizePhone(a) === normalizePhone(b);
}

async function findUniqueAgentByPhone(
  svc: ReturnType<typeof createServiceClient>,
  rawPhone: string,
): Promise<{ ok: true; agent: AgentPhoneRow } | { ok: false; count: number }> {
  const { data, error } = await svc.from("agents").select("id, phone").not("phone", "is", null);
  if (error) {
    console.error("[line:router] agents lookup failed", error);
    return { ok: false, count: 0 };
  }
  const matches = ((data ?? []) as AgentPhoneRow[]).filter(
    (a) => a.phone && phoneMatches(a.phone, rawPhone),
  );
  if (matches.length !== 1) return { ok: false, count: matches.length };
  return { ok: true, agent: matches[0]! };
}

/**
 * Enumeration-resistance design note (security review Finding 2, and its
 * Finding 1 rate-limit companion):
 *
 * Every outcome below whose existence depends on whether `rawPhone` matched
 * a real agent (unique match / zero match / ambiguous match / target rate-
 * limited) MUST reply with the exact same text (msg.LINK_REQUEST_ACK) and in
 * roughly the same latency — otherwise the reply content or its timing
 * becomes an oracle an unauthenticated LINE user can use to test whether an
 * arbitrary phone number belongs to a registered agent (agents.phone is
 * sensitive PII).
 *
 * To hold that invariant we:
 *   1. Resolve the match (one DB round-trip either way — same cost whether
 *      it matches or not).
 *   2. Reply with the generic ack IMMEDIATELY once the outcome is decided —
 *      before doing any of the slow, match-only work (OTP upsert, target
 *      rate-limit check, Twilio SMS call). That slow work can no longer make
 *      the match path visibly slower than the no-match path, because the
 *      user-visible reply no longer waits on it.
 *   3. Defer the match-only work to next/server's after() (same pattern as
 *      src/app/api/agents/location/route.ts and
 *      src/app/api/marketing/lead/route.ts — verified to flush reliably in
 *      Vercel Route Handlers after the response is sent, unlike a bare
 *      un-awaited promise which risks being frozen mid-flight). Any failure
 *      in there (upsert error, target rate-limit hit, Twilio failure) is
 *      logged server-side only — it can never become a second, distinct
 *      user-facing reply, since that would itself be a match/no-match
 *      oracle (a distinct "SMS failed" reply can only ever fire on the
 *      branch that got as far as calling Twilio, i.e. only on a real
 *      match).
 *
 * Two replies stay intentionally distinct and are NOT covered by the above:
 *   - RATE_LIMITED (the per-LINE-identity `line_otp_request` bucket): fires
 *     before rawPhone is even parsed, so it can't depend on — and doesn't
 *     leak anything about — the phone's match status.
 *   - OTP_COOLDOWN: fires off `account.otp_requested_at`, which reflects a
 *     PRIOR link attempt by this same LINE identity, checked before the
 *     CURRENT rawPhone is normalized/matched at all. It says nothing about
 *     whether the phone in *this* message matches anything.
 *   - ALREADY_LINKED / INVALID_PHONE: depend only on this LINE identity's
 *     own state or on input format, never on another phone's match status.
 */
async function handleLinkCommand(
  svc: ReturnType<typeof createServiceClient>,
  lineUserId: string,
  account: LineAccountLookup | null,
  rawPhone: string,
  replyToken: string,
): Promise<void> {
  if (account?.agent_id && account?.linked_at) {
    console.log(`[line:link] already-linked lineAccountId=${account.id}`);
    await replyLineMessage(replyToken, msg.ALREADY_LINKED);
    return;
  }

  const rl = await checkRateLimit("line_otp_request", lineUserId);
  if (!rl.allowed) {
    console.warn(`[line:link] rate-limited userId=${redact(lineUserId)}`);
    await replyLineMessage(replyToken, msg.RATE_LIMITED);
    return;
  }

  if (account?.otp_requested_at && !canRequestNewOtp(account.otp_requested_at)) {
    console.log(`[line:link] otp-cooldown-active lineAccountId=${account.id}`);
    await replyLineMessage(replyToken, msg.OTP_COOLDOWN);
    return;
  }

  const normalizedInput = normalizePhone(rawPhone);
  if (normalizedInput.length < 8) {
    console.log(`[line:link] invalid-phone-format userId=${redact(lineUserId)}`);
    await replyLineMessage(replyToken, msg.INVALID_PHONE);
    return;
  }

  const match = await findUniqueAgentByPhone(svc, rawPhone);
  if (!match.ok) {
    // Deliberately identical reply/timing to the matched path below — never
    // leak whether 0 or >1 agents matched, or that a match happened at all.
    console.log(`[line:link] no-unique-agent-match count=${match.count} userId=${redact(lineUserId)}`);
    await replyLineMessage(replyToken, msg.LINK_REQUEST_ACK);
    return;
  }

  // Reply now — identical text/timing to the no-match path — BEFORE doing
  // any of the match-only work below, so neither the message nor the
  // latency reveals that a match occurred.
  await replyLineMessage(replyToken, msg.LINK_REQUEST_ACK);

  const agentId = match.agent.id;
  const agentPhone = match.agent.phone;

  after(async () => {
    // Second rate limit, scoped to the RESOLVED TARGET agent rather than the
    // requesting LINE identity (Finding 1) — a fresh LINE identity is free
    // to create, so line_otp_request alone can't stop many distinct
    // identities from each requesting an OTP for the same victim phone.
    // This bounds how many OTP SMS a single agent can receive per hour no
    // matter how many LINE identities are asking. Deliberately checked here
    // (post-reply), not before replying, so it doesn't affect the ack's
    // content or timing (see the SMS-bombing target user's DoS risk).
    const targetRl = await checkRateLimit("line_otp_request_target", agentId);
    if (!targetRl.allowed) {
      console.warn(`[line:link] target-rate-limited agentId=${agentId}`);
      return;
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();

    // Upsert by line_user_id. Deliberately does NOT include agent_id/linked_at
    // — those are only ever set by a successful verify, never here, so a
    // repeated/failed link attempt can never silently link an account.
    const { data: upserted, error: upsertError } = await svc
      .from("line_accounts")
      .upsert(
        {
          line_user_id: lineUserId,
          phone_at_link_time: rawPhone.trim(),
          otp_code_hash: otpHash,
          otp_expires_at: expiresAt,
          otp_attempts: 0,
          otp_requested_at: now.toISOString(),
        },
        { onConflict: "line_user_id" },
      )
      .select("id")
      .single();

    if (upsertError || !upserted) {
      console.error("[line:link] upsert failed", upsertError);
      return;
    }

    const phoneInfo = parsePhone(agentPhone ?? "", "TH");
    const smsTarget = phoneInfo.e164 ?? agentPhone!;
    const smsResult = await sendSms(
      smsTarget,
      `รหัส OTP ยืนยันบัญชี Detective Pulse ของคุณคือ ${otp} (หมดอายุใน 10 นาที) กรุณาอย่าเปิดเผยรหัสนี้กับผู้อื่น`,
    );

    if (!smsResult.ok) {
      console.error(`[line:link] sms-send-failed lineAccountId=${upserted.id} reason=${smsResult.error}`);
      return;
    }

    console.log(`[line:link] otp-sent lineAccountId=${upserted.id}`);
  });
}

// ── verify command ────────────────────────────────────────────────────────

async function handleVerifyCommand(
  svc: ReturnType<typeof createServiceClient>,
  lineUserId: string,
  account: LineAccountLookup | null,
  code: string,
  replyToken: string,
): Promise<void> {
  if (account?.agent_id && account?.linked_at) {
    await replyLineMessage(replyToken, msg.ALREADY_LINKED);
    return;
  }

  if (!account || !account.otp_code_hash || !account.otp_expires_at) {
    console.log(`[line:verify] no-pending-otp userId=${redact(lineUserId)}`);
    await replyLineMessage(replyToken, msg.NO_PENDING_LINK);
    return;
  }

  if (account.otp_attempts >= OTP_MAX_ATTEMPTS) {
    console.warn(`[line:verify] locked-out lineAccountId=${account.id}`);
    await replyLineMessage(replyToken, msg.OTP_LOCKED);
    return;
  }

  if (isOtpExpired(account.otp_expires_at)) {
    console.log(`[line:verify] otp-expired lineAccountId=${account.id}`);
    await replyLineMessage(replyToken, msg.OTP_EXPIRED);
    return;
  }

  const rl = await checkRateLimit("line_otp_verify", lineUserId);
  if (!rl.allowed) {
    console.warn(`[line:verify] rate-limited userId=${redact(lineUserId)}`);
    await replyLineMessage(replyToken, msg.RATE_LIMITED);
    return;
  }

  const valid = verifyOtpHash(code, account.otp_code_hash);
  if (!valid) {
    const nextAttempts = account.otp_attempts + 1;
    const { error: incError } = await svc
      .from("line_accounts")
      .update({ otp_attempts: nextAttempts })
      .eq("id", account.id);
    if (incError) console.error("[line:verify] attempt-increment failed", incError);

    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      console.warn(`[line:verify] locked-out-after-failed-attempt lineAccountId=${account.id}`);
      await replyLineMessage(replyToken, msg.OTP_LOCKED);
    } else {
      console.log(`[line:verify] invalid-code lineAccountId=${account.id}`);
      await replyLineMessage(replyToken, msg.OTP_INVALID);
    }
    return;
  }

  if (!account.phone_at_link_time) {
    console.error(`[line:verify] missing-phone-at-link-time lineAccountId=${account.id}`);
    await replyLineMessage(replyToken, msg.GENERIC_ERROR);
    return;
  }

  // Re-resolve the candidate agent at verify time too (not just at link
  // time) — defense-in-depth against the matching phone having changed/
  // become ambiguous in the interim between the link and verify messages.
  const match = await findUniqueAgentByPhone(svc, account.phone_at_link_time);
  if (!match.ok) {
    console.error(
      `[line:verify] candidate-agent-no-longer-unique count=${match.count} lineAccountId=${account.id}`,
    );
    await replyLineMessage(replyToken, msg.GENERIC_ERROR);
    return;
  }

  const { error: linkError } = await svc
    .from("line_accounts")
    .update({
      agent_id: match.agent.id,
      linked_at: new Date().toISOString(),
      otp_code_hash: null,
      otp_expires_at: null,
      otp_attempts: 0,
      otp_requested_at: null,
    })
    .eq("id", account.id);

  if (linkError) {
    // Unique-violation (23505) on line_accounts_agent_id_unique means this
    // agent got linked to a different LINE account in the interim.
    if ((linkError as { code?: string }).code === "23505") {
      console.warn(`[line:verify] agent-already-linked-elsewhere lineAccountId=${account.id}`);
      await replyLineMessage(replyToken, msg.AGENT_ALREADY_LINKED);
      return;
    }
    console.error("[line:verify] link update failed", linkError);
    await replyLineMessage(replyToken, msg.GENERIC_ERROR);
    return;
  }

  console.log(`[line:verify] linked lineAccountId=${account.id}`);
  await replyLineMessage(replyToken, msg.LINK_SUCCESS);
}
