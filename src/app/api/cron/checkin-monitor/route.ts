import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyUsers, notifyRole, getCaseRecipients, notificationLinks } from "@/lib/notifications";
import { evaluateCheckin, DEFAULT_GRACE_MIN, type CheckinStage } from "@/lib/ops/checkin";

export const maxDuration = 60;

/**
 * GET /api/cron/checkin-monitor
 * Vercel Cron (every 5 min) — per-case agent check-in cadence.
 *
 * For each open case with a check-in interval set, compares the latest timeline
 * entry (any entry resets the clock) to the required gap. When overdue it
 * reminds the assigned agents (push); if it stays overdue past the grace window
 * it escalates to supervisors/admins. A per-case stage dedupes notifications.
 *
 * Auth: fail-closed CRON_SECRET bearer, same as the other crons.
 */
interface CaseRow {
  id: string;
  case_number: string;
  created_at: string;
  checkin_interval_minutes: number | null;
  checkin_stage: string | null;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const graceMin = Number(process.env.CHECKIN_GRACE_MIN) > 0 ? Number(process.env.CHECKIN_GRACE_MIN) : DEFAULT_GRACE_MIN;
  const svc = createServiceClient();
  const now = new Date();

  const { data: cases, error } = await svc
    .from("cases")
    .select("id, case_number, created_at, checkin_interval_minutes, checkin_stage")
    .neq("status", "closed")
    .not("checkin_interval_minutes", "is", null);

  if (error) {
    console.error("[cron] checkin-monitor case query failed:", error.message);
    return NextResponse.json({ error: "case query failed" }, { status: 500 });
  }

  let scanned = 0;
  let reminded = 0;
  let escalated = 0;

  for (const c of (cases ?? []) as CaseRow[]) {
    if (!c.checkin_interval_minutes) continue;
    scanned++;

    // Latest timeline entry = the freshest report; fall back to case start.
    const { data: latest } = await svc
      .from("timeline_entries")
      .select("created_at")
      .eq("case_id", c.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastReportAt = latest?.created_at ?? c.created_at;

    const { stage, action } = evaluateCheckin({
      intervalMin: c.checkin_interval_minutes,
      lastReportAt,
      now,
      graceMin,
      stage: (c.checkin_stage as CheckinStage) ?? "ok",
    });

    if (action === "remind") {
      const { agents } = await getCaseRecipients(c.id);
      await notifyUsers(agents, {
        type: "case",
        title: "ถึงเวลารายงาน",
        body: `กรุณาบันทึกไทม์ไลน์ของคดี ${c.case_number} (รอบทุก ${c.checkin_interval_minutes} นาที)`,
        url: notificationLinks.case(c.id),
        entityId: c.id,
        priority: "high",
      });
      reminded++;
    } else if (action === "escalate") {
      await notifyRole(["admin", "supervisor"], {
        type: "system",
        title: `⚠️ คดี ${c.case_number} ไม่มีรายงานตามรอบ`,
        body: `ยังไม่มีการบันทึกไทม์ไลน์เกินกำหนด (รอบทุก ${c.checkin_interval_minutes} นาที)`,
        url: notificationLinks.case(c.id),
        entityId: c.id,
        priority: "high",
      });
      escalated++;
    }

    if (stage !== (c.checkin_stage ?? "ok")) {
      await svc.from("cases").update({ checkin_stage: stage }).eq("id", c.id);
    }
  }

  const result = { ok: true, scanned, reminded, escalated };
  console.log("[cron] checkin-monitor", result);
  return NextResponse.json(result);
}
