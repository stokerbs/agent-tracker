import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { handleLineMessage, handleLineMediaMessage } from "@/lib/line/router";

// LINE Messaging API webhook for the Detective Pulse Official Account.
//
// Verifies X-Line-Signature (HMAC-SHA256, timing-safe compare) then routes
// every text message through src/lib/line/router.ts's command dispatcher:
// phone+OTP account linking ("link"/"verify"), gated read-only commands for
// already-linked agents (case lookup / timeline list — implemented in
// src/lib/line/commands/*), and a help/link-prompt reply for everything
// else. See router.ts's module doc for the full dispatch flow.
//
// Image and location message events (Round 3: photo/location follow-up
// attachments to a just-added timeline entry) are routed to
// handleLineMediaMessage() instead — see router.ts's module doc. Stickers
// and any other message type remain silently ignored.
//
// Requires LINE_CHANNEL_SECRET (to verify) + LINE_CHANNEL_ACCESS_TOKEN (to reply).

/**
 * LINE webhook `message` event shapes this route understands. This repo does
 * not depend on LINE's official SDK (not present in package.json, and this
 * is the only call site parsing webhook payloads), so these are hand-typed
 * to match LINE's documented Messaging API webhook event schema:
 *   - text:     { type: "text", text: string }
 *   - image:    { type: "image", id: string } — `id` is the LINE Content API
 *               messageId used to download the raw bytes (see
 *               src/lib/line/content.ts's downloadLineContent()).
 *   - location: { type: "location", title?: string, address?: string,
 *               latitude: number, longitude: number }
 * Any other `type` (sticker, video, audio, file, ...) is left untyped here
 * and simply ignored by the loop below.
 */
interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: {
    type: string;
    text?: string;
    id?: string;
    title?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  // Fail CLOSED: an unconfigured LINE_CHANNEL_SECRET must never be treated as
  // "skip verification" — this feature now gates OTP-triggering SMS sends and
  // case/timeline PII reads behind this webhook, so an unverified request
  // must be rejected exactly like a bad signature, not silently processed.
  if (!secret) {
    console.error("[line-webhook] LINE_CHANNEL_SECRET is not configured — rejecting request");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Read the raw body FIRST — signature is computed over the exact bytes.
  const raw = await request.text();

  // Verify the request genuinely came from LINE (HMAC-SHA256, base64).
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("base64");
  const got = request.headers.get("x-line-signature") ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ ok: true }); // still 200 so LINE's verify passes
  }

  for (const ev of events) {
    const userId = ev.source?.userId;
    if (ev.type !== "message" || !ev.replyToken || !token || !userId) continue;

    const message = ev.message;
    if (!message) continue;

    try {
      if (message.type === "text" && typeof message.text === "string") {
        await handleLineMessage(userId, message.text, ev.replyToken);
      } else if (message.type === "image" && typeof message.id === "string") {
        // `message.id` is the LINE Content API messageId — the real bytes
        // are fetched later by src/lib/line/commands/attach-photo.ts via
        // src/lib/line/content.ts's downloadLineContent(), not here.
        await handleLineMediaMessage(userId, { type: "image", messageId: message.id }, ev.replyToken);
      } else if (
        message.type === "location" &&
        typeof message.latitude === "number" &&
        typeof message.longitude === "number"
      ) {
        // Prefer LINE's `address` field; fall back to `title` (a
        // user-supplied label, e.g. "Home") when address is absent. Both
        // are optional per LINE's schema. Bounds/precision validation of
        // lat/lng is deliberately NOT done here — that's
        // attach-location.ts's job (see its module doc).
        await handleLineMediaMessage(
          userId,
          {
            type: "location",
            latitude: message.latitude,
            longitude: message.longitude,
            address: message.address ?? message.title ?? null,
          },
          ev.replyToken,
        );
      }
      // Anything else (sticker, video, audio, file, …) is silently ignored.
    } catch (e) {
      console.error("[line-webhook] dispatch failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true });
}
