import { NextResponse, type NextRequest } from "next/server";
import { mineLineInbox } from "@/lib/studio/faq-mining";
import { pushLineNotify } from "@/lib/line/notify";
import { reportError } from "@/lib/errors";

// Weekly (Mon 01:30 Asia/Bangkok): mine recurring customer questions from the
// redacted LINE OA inbox into studio_customer_questions, purge processed rows
// older than the retention window, and ping the owner when something new landed.
// Auth: fail-closed CRON_SECRET bearer (same as the other /api/cron routes).

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await mineLineInbox({ userId: null });
    if (!result.ok) {
      console.error("[cron:studio-faq-mine] failed:", result.error);
      return NextResponse.json({ ok: false, error: "mine_failed", detail: result.error }, { status: 500 });
    }
    if (result.inserted > 0 || result.merged > 0) {
      await pushLineNotify(
        `🧠 Creative Studio: ขุดคำถามลูกค้าจาก LINE แล้ว\n` +
          `• ข้อความที่ประมวลผล: ${result.messages}\n` +
          `• คำถามใหม่: ${result.inserted} · รวมกับที่มี: ${result.merged}\n\n` +
          `ตรวจและอนุมัติให้ AI ใช้: https://detectivepulse.app/studio/knowledge?tab=questions`,
      );
    }
    return NextResponse.json({ ...result, ok: true });
  } catch (e) {
    reportError(e, "cron:studio-faq-mine");
    console.error("[cron:studio-faq-mine] threw:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "mine_failed" }, { status: 500 });
  }
}
