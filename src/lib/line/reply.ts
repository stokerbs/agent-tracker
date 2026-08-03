import "server-only";

import { reportError } from "@/lib/errors";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

/**
 * LINE's reply API accepts an array of up to 5 messages per call, mixing
 * types. Currently used by the (Round 4) intel command, which needs to send
 * a text summary plus up to a few target/vehicle photos as real LINE image
 * messages in the same reply — see src/lib/line/commands/intel.ts's module
 * doc. `image` requires both URLs to be HTTPS, JPEG, and <=10MB per LINE's
 * API constraints — short-lived Supabase Storage signed URLs satisfy this
 * (see intel.ts's handoff doc for the exact bucket/pattern to use).
 */
export type LineOutboundMessage =
  | { type: "text"; text: string }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string };

/** LINE's hard cap on messages per reply call. */
const MAX_MESSAGES_PER_REPLY = 5;

/**
 * Reply to a specific LINE webhook event via its (single-use, short-lived —
 * roughly 1 minute) replyToken, with one or more messages (text and/or
 * image) in a single call. Best-effort and non-throwing, matching the
 * conventions of src/lib/line/notify.ts's pushLineNotify(): a LINE API
 * failure must never break/throw out of the webhook request that's calling
 * it. No-ops silently if LINE_CHANNEL_ACCESS_TOKEN isn't configured,
 * replyToken is empty, or `messages` is empty.
 *
 * Defensively truncates to LINE's 5-message-per-reply limit rather than
 * letting an over-long array silently fail the whole reply call — a caller
 * bug (e.g. handing in too many target photos) degrades to "fewer photos
 * sent" instead of "nothing sent at all".
 */
export async function replyLineMessages(
  replyToken: string,
  messages: LineOutboundMessage[],
): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken || messages.length === 0) return;

  let payload = messages;
  if (messages.length > MAX_MESSAGES_PER_REPLY) {
    console.warn(
      `[line] replyLineMessages truncating ${messages.length} messages to ${MAX_MESSAGES_PER_REPLY} (LINE per-reply limit)`,
    );
    payload = messages.slice(0, MAX_MESSAGES_PER_REPLY);
  }

  try {
    const res = await fetch(LINE_REPLY_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        replyToken,
        messages: payload.map((m) =>
          // LINE text messages cap at 5000 chars — mirrors pushLineNotify's guard.
          m.type === "text" ? { type: "text", text: m.text.slice(0, 4900) } : m,
        ),
      }),
    });
    if (!res.ok) {
      console.error(`[line] reply failed status=${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  } catch (err) {
    reportError(err, "line:reply");
  }
}

/**
 * Reply with a single text message. Kept as its own function (rather than
 * requiring every existing call site to switch to array-of-messages) since
 * it's by far the most common case across this bot's commands — implemented
 * in terms of replyLineMessages() so the two never drift.
 */
export async function replyLineMessage(replyToken: string, text: string): Promise<void> {
  await replyLineMessages(replyToken, [{ type: "text", text }]);
}
