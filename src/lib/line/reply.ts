import "server-only";

import { reportError } from "@/lib/errors";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

/**
 * Reply to a specific LINE webhook event via its (single-use, short-lived —
 * roughly 1 minute) replyToken. Best-effort and non-throwing, matching the
 * conventions of src/lib/line/notify.ts's pushLineNotify(): a LINE API
 * failure must never break/throw out of the webhook request that's calling
 * it. No-ops silently if LINE_CHANNEL_ACCESS_TOKEN isn't configured or
 * replyToken is empty.
 */
export async function replyLineMessage(replyToken: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken) return;

  try {
    const res = await fetch(LINE_REPLY_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        replyToken,
        // LINE text messages cap at 5000 chars — mirrors pushLineNotify's guard.
        messages: [{ type: "text", text: text.slice(0, 4900) }],
      }),
    });
    if (!res.ok) {
      console.error(`[line] reply failed status=${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  } catch (err) {
    reportError(err, "line:reply");
  }
}
