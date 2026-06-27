import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyUsers, notificationLinks } from "@/lib/notifications";

export const maxDuration = 60;

/**
 * GET /api/cron/board-reminders
 * Vercel Cron — reminds agents whose claimed board job is about to start.
 *
 * Finds approved board claims not yet reminded whose case `board_start_at` falls
 * within the next REMINDER_WINDOW, notifies the agent (high priority), and marks
 * the claim reminded so it fires once. Auth: fail-closed CRON_SECRET bearer.
 */
const REMINDER_WINDOW_MS = 60 * 60 * 1000; // 60 minutes before start

interface ClaimRow {
  id: string;
  cases: { id: string; case_number: string; board_start_at: string | null } | null;
  agents: { profile_id: string | null } | null;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const { data } = await svc
    .from("case_claims")
    .select("id, cases!inner(id, case_number, board_start_at), agents!inner(profile_id)")
    .eq("status", "approved")
    .is("reminded_at", null);

  const rows = (data ?? []) as unknown as ClaimRow[];
  const due = rows.filter((r) => {
    const start = r.cases?.board_start_at;
    if (!start) return false;
    const t = new Date(start);
    return t > now && t <= windowEnd;
  });

  let sent = 0;
  for (const r of due) {
    const profileId = r.agents?.profile_id;
    const c = r.cases;
    if (!profileId || !c) continue;
    await notifyUsers([profileId], {
      type: "system",
      title: "Upcoming assignment",
      body: `Case ${c.case_number} starts soon.`,
      url: notificationLinks.case(c.id),
      entityId: c.id,
      priority: "high",
    });
    await svc.from("case_claims").update({ reminded_at: now.toISOString() }).eq("id", r.id);
    sent++;
  }

  console.log(`[cron] board-reminders sent=${sent} due=${due.length}`);
  return NextResponse.json({ ok: true, sent });
}
