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

// ── AI report generation ──────────────────────────────────────────────────────

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

/** Regenerate AI content for an existing report, saving old content as a version first. */
export async function regenerateReport(reportId: string, language: ReportLanguage = "th") {
  const profile = await requireRole(["admin", "supervisor"]);
  const rl = checkRateLimit("report", profile.id);
  if (!rl.allowed) {
    const minutes = Math.ceil(rl.retryAfterMs / 60_000);
    return {
      error: `Rate limit reached. Retry in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }
  const supabase = await createClient();

  const { data: existingReport } = await supabase
    .from("reports")
    .select("*, cases(*)")
    .eq("id", reportId)
    .single();
  if (!existingReport) return { error: "Report not found" };

  const caseRecord = existingReport.cases as unknown as Case | null;
  if (!caseRecord) return { error: "Case not found" };

  // Snapshot current content as a new version before overwriting.
  await _createVersion(supabase, reportId, existingReport, profile.id);

  const { data: entries } = await supabase
    .from("timeline_entries")
    .select("*")
    .eq("case_id", caseRecord.id)
    .order("entry_date")
    .order("entry_time");

  let sections!: AiReportSections;
  let source!: ReportSource;
  try {
    const result = await generateReport({
      caseRecord,
      entries: (entries as TimelineEntry[]) ?? [],
      language,
    });
    sections = result.sections;
    source = result.source;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Regeneration failed." };
  }

  const isThai = language === "th";
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

  const { error } = await supabase
    .from("reports")
    .update({
      executive_summary: sections.executive_summary,
      body,
      observations: sections.observations,
      conclusion: sections.conclusion,
      status: "draft",
      edited_by: profile.id,
      edited_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) return { error: handleDbError(error, "reports") };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "report_regenerated",
    entity: "reports",
    entity_id: reportId,
    metadata: { source, language },
  });

  revalidatePath(`/reports/${reportId}/edit`);
  revalidatePath("/reports");
  return { ok: true, source };
}

// ── Editing ───────────────────────────────────────────────────────────────────

interface ReportContent {
  executive_summary: string;
  body: string;
  observations: string;
  conclusion: string;
}

/** Save a draft edit — creates a new version snapshot + audit log entry. */
export async function saveReportDraft(reportId: string, content: ReportContent) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  // Create version before overwriting.
  const { data: existing } = await supabase
    .from("reports")
    .select("executive_summary, body, observations, conclusion")
    .eq("id", reportId)
    .single();

  if (existing) {
    await _createVersion(supabase, reportId, existing, profile.id);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("reports")
    .update({
      executive_summary: content.executive_summary,
      body: content.body,
      observations: content.observations,
      conclusion: content.conclusion,
      edited_by: profile.id,
      edited_at: now,
    })
    .eq("id", reportId);
  if (error) return { error: handleDbError(error, "reports") };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "report_edited",
    entity: "reports",
    entity_id: reportId,
    metadata: {},
  });

  revalidatePath(`/reports/${reportId}/edit`);
  revalidatePath("/reports");
  return { ok: true };
}

/** Submit a report for supervisor/admin review. */
export async function submitReportForReview(reportId: string) {
  await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status: "review" })
    .eq("id", reportId);
  if (error) return { error: handleDbError(error, "reports") };
  revalidatePath(`/reports/${reportId}/edit`);
  revalidatePath("/reports");
  return { ok: true };
}

// ── Approval ──────────────────────────────────────────────────────────────────

export async function approveReport(reportId: string, clientVisible: boolean) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("reports")
    .select("generated_by, case_id, cases(case_number, client_id)")
    .eq("id", reportId)
    .single();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("reports")
    .update({
      status: "approved",
      approved_by: profile.id,
      approved_at: now,
      is_client_visible: clientVisible,
    })
    .eq("id", reportId);
  if (error) return { error: handleDbError(error, "reports") };

  const caseRow = report?.cases as unknown as { case_number: string; client_id: string | null } | null;
  const caseNumber = caseRow?.case_number ?? "unknown";

  // Audit log.
  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "report_approved",
    entity: "reports",
    entity_id: reportId,
    metadata: { case_number: caseNumber, client_visible: clientVisible },
  });

  // Notify author (non-blocking).
  if (report?.generated_by && report.generated_by !== profile.id) {
    void notifyUsers([report.generated_by], {
      type: "report",
      title: "Report approved",
      body: `Your report for case ${caseNumber} has been approved.`,
      link: report.case_id ? `/cases/${report.case_id}` : "/reports",
    });
  }

  // Email client if client-visible (non-blocking).
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

  revalidatePath(`/reports/${reportId}/edit`);
  revalidatePath("/reports");
  return { ok: true };
}

// ── Rejection ─────────────────────────────────────────────────────────────────

export async function rejectReport(reportId: string, notes: string) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("reports")
    .select("generated_by, case_id, cases(case_number)")
    .eq("id", reportId)
    .single();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("reports")
    .update({
      status: "rejected",
      rejected_by: profile.id,
      rejected_at: now,
      rejection_notes: notes.trim() || null,
    })
    .eq("id", reportId);
  if (error) return { error: handleDbError(error, "reports") };

  const caseNumber = (report?.cases as unknown as { case_number: string } | null)?.case_number ?? "unknown";

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "report_rejected",
    entity: "reports",
    entity_id: reportId,
    metadata: { case_number: caseNumber, notes: notes.trim() || null },
  });

  if (report?.generated_by && report.generated_by !== profile.id) {
    void notifyUsers([report.generated_by], {
      type: "report",
      title: "Report rejected",
      body: notes.trim()
        ? `Your report for case ${caseNumber} was rejected: ${notes.trim()}`
        : `Your report for case ${caseNumber} was rejected.`,
      link: report.case_id ? `/reports/${reportId}/edit` : "/reports",
    });
  }

  revalidatePath(`/reports/${reportId}/edit`);
  revalidatePath("/reports");
  return { ok: true };
}

// ── Archive / delete ──────────────────────────────────────────────────────────

export async function archiveReport(reportId: string) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) return { error: handleDbError(error, "reports") };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "report_archived",
    entity: "reports",
    entity_id: reportId,
    metadata: {},
  });

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

// ── Helpers ───────────────────────────────────────────────────────────────────

// Supabase client type is complex — use unknown for the generic helper.
// eslint-disable-next-line
async function _createVersion(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, reportId: string, snapshot: Record<string, string | null | undefined>, editorId: string) {
  // Get next version number.
  const { data: latest } = await supabase
    .from("report_versions")
    .select("version_number")
    .eq("report_id", reportId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (latest?.version_number ?? 0) + 1;

  await supabase.from("report_versions").insert({
    report_id: reportId,
    version_number: nextVersion,
    content: {
      executive_summary: snapshot.executive_summary ?? null,
      body: snapshot.body ?? null,
      observations: snapshot.observations ?? null,
      conclusion: snapshot.conclusion ?? null,
    },
    edited_by: editorId,
  });
}
