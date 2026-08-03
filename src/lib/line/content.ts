import "server-only";

/**
 * LINE Content API download helper (infra-only — Round 3 wiring).
 *
 * Fetches the raw bytes of a message's attached content (image/video/audio/
 * file) via LINE's Content API: `GET
 * https://api-data.line.me/v2/bot/message/{messageId}/content`, authenticated
 * with the same LINE_CHANNEL_ACCESS_TOKEN bearer token used by
 * src/lib/line/reply.ts's replyLineMessage(). Follows the same
 * never-throw/"return { ok: false } on any failure" style as
 * src/lib/sms/twilio.ts's sendSms() and replyLineMessage() — a LINE API
 * outage or missing/invalid messageId must never crash the webhook handler
 * that calls this.
 *
 * Deliberately does NOT perform any file-type/size validation — that's the
 * responsibility of the caller (see src/lib/line/commands/attach-photo.ts's
 * module doc), using this repo's existing conventions in
 * src/lib/security/file-validation.ts.
 */

const LINE_CONTENT_API_BASE = "https://api-data.line.me/v2/bot/message";

export type DownloadLineContentResult =
  | { ok: true; data: Buffer; contentType: string }
  | { ok: false; error: string };

/**
 * Download a LINE message's attached content by its `messageId` (the
 * `message.id` field on an image/video/audio LINE webhook event).
 *
 * @param messageId - The LINE messageId to fetch content for. Never logged
 *   verbatim beyond what's already logged by the caller — this function
 *   itself only logs the HTTP status / error class on failure, never the
 *   response body (which is binary content, not sensitive text, but still
 *   not useful to log).
 */
export async function downloadLineContent(messageId: string): Promise<DownloadLineContentResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error("[line:content] LINE_CHANNEL_ACCESS_TOKEN is not configured");
    return { ok: false, error: "not_configured" };
  }

  if (!messageId) {
    return { ok: false, error: "missing_message_id" };
  }

  try {
    const res = await fetch(`${LINE_CONTENT_API_BASE}/${encodeURIComponent(messageId)}/content`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error(`[line:content] download failed status=${res.status}`);
      return { ok: false, error: `http_${res.status}` };
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const arrayBuffer = await res.arrayBuffer();
    return { ok: true, data: Buffer.from(arrayBuffer), contentType };
  } catch (err) {
    console.error("[line:content] download threw:", err instanceof Error ? err.message : "unknown error");
    return { ok: false, error: "exception" };
  }
}
