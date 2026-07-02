import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { pushLineNotify } from "@/lib/line/notify";
import { reportError } from "@/lib/errors";

// Weekly ops digest to the owner's LINE (Mon 09:00 Thailand): last 7 days of
// leads (form + AI chat), job applications, and AI-article activity.
// Auth: fail-closed CRON_SECRET bearer (same as the other /api/cron routes).

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const svc = createServiceClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const head = { count: "exact" as const, head: true };

    const [leadsTotal, leadsFromChat, careers, articlesPublished, draftsPending] = await Promise.all([
      svc.from("marketing_leads").select("*", head).gte("created_at", since).then((r) => r.count ?? 0),
      svc.from("marketing_leads").select("*", head).gte("created_at", since).eq("source", "assistant").then((r) => r.count ?? 0),
      svc.from("recruitment_applications").select("*", head).gte("created_at", since).then((r) => r.count ?? 0),
      svc.from("marketing_articles").select("*", head).gte("published_at", since).eq("status", "published").then((r) => r.count ?? 0),
      svc.from("marketing_articles").select("*", head).eq("status", "draft").then((r) => r.count ?? 0),
    ]);
    const leadsFromForm = Math.max(0, leadsTotal - leadsFromChat);

    const text =
      `📊 สรุปรายสัปดาห์ Detective Pulse (7 วันล่าสุด)\n\n` +
      `👥 ลูกค้าติดต่อเข้า: ${leadsTotal} ราย\n` +
      `   • จากฟอร์ม: ${leadsFromForm}\n` +
      `   • จากแชท AI: ${leadsFromChat}\n` +
      `📄 ผู้สมัครร่วมงาน: ${careers} ราย\n` +
      `📝 บทความ AI เผยแพร่: ${articlesPublished} บทความ` +
      (draftsPending > 0 ? `\n⏳ บทความรออนุมัติ: ${draftsPending}` : "") +
      `\n\nดูรายละเอียด: https://detectivepulse.app/leads`;

    await pushLineNotify(text);

    return NextResponse.json({ ok: true, leadsTotal, leadsFromChat, careers, articlesPublished, draftsPending });
  } catch (e) {
    reportError(e, "cron:weekly-digest");
    console.error("[cron:weekly-digest] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "digest_failed" }, { status: 500 });
  }
}
