import "server-only";

import { reportError } from "@/lib/errors";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

/**
 * Push a plain-text LINE message to the configured owner/admin recipient(s) via
 * the Detective Pulse Official Account (Messaging API). Best-effort and
 * env-gated: no-ops unless BOTH LINE_CHANNEL_ACCESS_TOKEN and LINE_NOTIFY_USER_ID
 * are set, and never throws — a LINE failure must never break the triggering
 * request. LINE_NOTIFY_USER_ID may be a comma-separated list to ping several
 * people (e.g. owner + a partner).
 *
 * Used by the notification pipeline (notifications.ts) for marketing/admin
 * events (new lead, AI-chat case, job application) so the owner gets pinged in
 * LINE on top of the in-app + native push.
 */
export async function pushLineNotify(text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const targets = (process.env.LINE_NOTIFY_USER_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || targets.length === 0) return;

  try {
    await Promise.all(
      targets.map(async (to) => {
        const res = await fetch(LINE_PUSH_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          // LINE text messages cap at 5000 chars.
          body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
        });
        if (!res.ok) {
          console.error(`[line] push failed status=${res.status}: ${(await res.text()).slice(0, 200)}`);
        }
      }),
    );
  } catch (err) {
    reportError(err, "line:push");
  }
}
