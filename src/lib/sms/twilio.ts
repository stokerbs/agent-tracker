import "server-only";

/**
 * Minimal Twilio REST API wrapper for sending SMS (currently only used to
 * deliver LINE-bot account-linking OTPs — see src/lib/line/router.ts).
 *
 * Plain `fetch` against Twilio's REST API — no SDK dependency (none is
 * present in package.json and this is the only call site, so a full SDK
 * isn't warranted). Matches the best-effort/non-throwing style of
 * src/lib/line/notify.ts's pushLineNotify(): every failure mode (missing
 * env, non-2xx response, network error) is caught and turned into a
 * { ok: false } result instead of a thrown exception, so a Twilio outage
 * never crashes the caller (the LINE webhook handler).
 *
 * Never logs the message body (which may contain a raw OTP) or the Twilio
 * auth token — only the HTTP status / error class on failure.
 */

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export interface SendSmsResult {
  ok: boolean;
  /** Short, non-sensitive failure reason for logging — never message content. */
  error?: "not_configured" | `http_${number}` | "exception";
}

/**
 * Send a single SMS via Twilio.
 *
 * @param to   - Destination number, ideally E.164 (e.g. "+66812345678").
 *               Twilio will reject malformed numbers with a non-2xx response,
 *               which surfaces here as { ok: false, error: "http_400" }.
 * @param body - Message text. Never logged.
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.error("[sms:twilio] missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER");
    return { ok: false, error: "not_configured" };
  }

  try {
    const params = new URLSearchParams({ To: to, From: from, Body: body });
    const res = await fetch(`${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      body: params.toString(),
    });

    if (!res.ok) {
      console.error(`[sms:twilio] send failed status=${res.status}`);
      return { ok: false, error: `http_${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error("[sms:twilio] send threw:", err instanceof Error ? err.message : "unknown error");
    return { ok: false, error: "exception" };
  }
}
