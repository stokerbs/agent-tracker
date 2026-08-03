import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { handleLineMessage } from "@/lib/line/router";

// LINE Messaging API webhook for the Detective Pulse Official Account.
//
// Verifies X-Line-Signature (HMAC-SHA256, timing-safe compare) then routes
// every text message through src/lib/line/router.ts's command dispatcher:
// phone+OTP account linking ("link"/"verify"), gated read-only commands for
// already-linked agents (case lookup / timeline list — implemented in
// src/lib/line/commands/*, stubbed for now), and a help/link-prompt reply for
// everything else. See router.ts's module doc for the full dispatch flow.
//
// Requires LINE_CHANNEL_SECRET (to verify) + LINE_CHANNEL_ACCESS_TOKEN (to reply).

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
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
    // Only plain-text messages carry a command; anything else (sticker,
    // image, location, …) is silently ignored rather than routed.
    if (ev.message?.type !== "text" || typeof ev.message.text !== "string") continue;

    try {
      await handleLineMessage(userId, ev.message.text, ev.replyToken);
    } catch (e) {
      console.error("[line-webhook] dispatch failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true });
}
