"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateReport } from "@/lib/ai-report";
import { sendReportApprovedEmail } from "@/lib/email";
import { notifyRole, notifyUsers } from "@/lib/notifications";
import type { AiReportSections, Case, ReportLanguage, TimelineEntry } from "@/lib/types";
import type { ReportSource } from "@/lib/report-parser";

/**
 * Generates an AI surveillance report for a case from its timeline entries
 * and persists it as a draft report.
 */
export async function generateCaseReport(caseId: string, language: ReportLanguage = "th") {
  const profile = await requireRole(["admin", "supervisor", "agent"]);
  const rl = checkRateLimit("report", profile.id);
  if (!rl.allowed) {
    const minutes = Math.ceil(rl.retryAfterMs / 60_000);
    return {
      error: `Report generation limit reached (5 per hour). Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }
  const supabase = await createClient();

  const { data: caseRecord } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .single();
  if (!caseRecord) return { error: "Case not found" };

  const { data: entries } = await supabase
    .from("timeline_entries")
    .select("*")
    .eq("case_id", caseId)
    .order("entry_date")
    .order("entry_time");

  let sections!: AiReportSections;
  let source!: ReportSource;
  try {
    const result = await generateReport({
      caseRecord: caseRecord as Case,
      entries: (entries as TimelineEntry[]) ?? [],
      language,
    });
    sections = result.sections;
    source = result.source;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Report generation failed." };
  }

  const isThai = language === "th";
  // Provider tag embedded at end of body — parsed by UI/export, not displayed raw.
  const providerTag = `\n__PROVIDER:${source}__`;
  const body =
    (isThai
      ? [
          "1. สรุปผลการปฏิบัติงาน",
          sections.executive_summary,
          "",
          "2. ลำดับเหตุการณ์",
          sections.chronological_report,
          "",
          "3. ข้อสังเกต",
          sections.observations,
          "",
          "4. สรุป",
          sections.conclusion,
        ].join("\n")
      : [
          "1. EXECUTIVE SUMMARY",
          sections.executive_summary,
          "",
          "2. CHRONOLOGICAL SURVEILLANCE REPORT",
          sections.chronological_report,
          "",
          "3. OBSERVATIONS",
          sections.observations,
          "",
          "4. CONCLUSION",
          sections.conclusion,
        ].join("\n")) + providerTag;

  const title = isThai
    ? `รายงานการสอดแนม — ${(caseRecord as Case).case_number}`
    : `Surveillance Report — ${(caseRecord as Case).case_number}`;

  const { data, error } = await supabase
    .from("reports")
    .insert({
      case_id: caseId,
      title,
      executive_summary: sections.executive_summary,
      observations: sections.observations,
      conclusion: sections.conclusion,
      body,
      status: "draft",
      generated_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { error: handleDbError(error, "reports") };

  // Notify all supervisors/admins (non-blocking — failure does not abort).
  void notifyRole(
    ["admin", "supervisor"],
    {
      type: "report",
      title: "New report ready for review",
      body: `A report for case ${(caseRecord as Case).case_number} is awaiting approval.`,
      link: "/reports",
    },
    profile.id,
  );

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/reports");
  return { ok: true, id: data?.id as string, source };
}

export async function approveReport(reportId: string, clientVisible: boolean) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  // Fetch report + case before updating so we have context for notifications.
  const { data: report } = await supabase
    .from("reports")
    .select("generated_by, case_id, cases(case_number, client_id)")
    .eq("id", reportId)
    .single();

  const { error } = await supabase
    .from("reports")
    .update({
      status: "approved",
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
      is_client_visible: clientVisible,
    })
    .eq("id", reportId);
  if (error) return { error: handleDbError(error, "reports") };

  const caseRow = report?.cases as unknown as { case_number: string; client_id: string | null } | null;
  const caseNumber = caseRow?.case_number ?? "unknown";

  // Notify the report author (non-blocking).
  if (report?.generated_by && report.generated_by !== profile.id) {
    void notifyUsers([report.generated_by], {
      type: "report",
      title: "Report approved",
      body: `Your report for case ${caseNumber} has been approved.`,
      link: report.case_id ? `/cases/${report.case_id}` : "/reports",
    });
  }

  // Email the client if client-visible (non-blocking).
  if (clientVisible && caseRow?.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("email,name")
      .eq("id", caseRow.client_id)
      .single();
    if (client?.email) {
      void sendReportApprovedEmail({
        to: client.email,
        clientName: client.name,
        caseNumber,
      });
    }
  }

  revalidatePath("/reports");
  return { ok: true };
}

export async function archiveReport(reportId: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) return { error: handleDbError(error, "reports") };
  revalidatePath("/reports");
  return { ok: true };
}

export async function unarchiveReport(reportId: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ archived_at: null })
    .eq("id", reportId);
  if (error) return { error: handleDbError(error, "reports") };
  revalidatePath("/reports");
  return { ok: true };
}

export async function deleteReport(reportId: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: reportRecord } = await supabase
    .from("reports")
    .select("title, case_id")
    .eq("id", reportId)
    .single();

  const { error } = await supabase.from("reports").delete().eq("id", reportId);
  if (error) return { error: handleDbError(error, "reports") };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "hard_delete",
    entity: "reports",
    entity_id: reportId,
    metadata: { title: reportRecord?.title, case_id: reportRecord?.case_id },
  });

  revalidatePath("/reports");
  return { ok: true };
}
