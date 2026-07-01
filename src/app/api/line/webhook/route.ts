import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";

// LINE Messaging API webhook for the Detective Pulse Official Account.
//
// Primary purpose today: help the owner discover their LINE `userId` — message
// the OA and it replies with your userId, which you then set as
// LINE_NOTIFY_USER_ID to receive lead/case notifications. It also verifies the
// X-Line-Signature so the endpoint can safely grow into two-way handling later.
//
// Requires LINE_CHANNEL_SECRET (to verify) + LINE_CHANNEL_ACCESS_TOKEN (to reply).

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
}

export async function POST(request: NextRequest) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  // Read the raw body FIRST — signature is computed over the exact bytes.
  const raw = await request.text();

  // Verify the request genuinely came from LINE (HMAC-SHA256, base64).
  if (secret) {
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("base64");
    const got = request.headers.get("x-line-signature") ?? "";
    const a = Buffer.from(expected);
    const b = Buffer.from(got);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ ok: true }); // still 200 so LINE's verify passes
  }

  for (const ev of events) {
    const userId = ev.source?.userId;
    if (ev.type === "message" && ev.replyToken && token && userId) {
      try {
        await fetch(LINE_REPLY_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({
            replyToken: ev.replyToken,
            messages: [
              {
                type: "text",
                text:
                  `✅ เชื่อมต่อ Detective Pulse สำเร็จ\n\nuserId ของคุณคือ:\n${userId}\n\n` +
                  `นำค่านี้ไปตั้งเป็น LINE_NOTIFY_USER_ID เพื่อรับแจ้งเตือนลูกค้า/เคสใหม่ทาง LINE ครับ`,
              },
            ],
          }),
        });
      } catch (e) {
        console.error("[line-webhook] reply failed:", e instanceof Error ? e.message : e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
