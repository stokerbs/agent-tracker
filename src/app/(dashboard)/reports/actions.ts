"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateReport } from "@/lib/ai-report";
import { sendReportApprovedEmail } from "@/lib/email";
import type { AiReportSections, Case, TimelineEntry } from "@/lib/types";

/**
 * Generates an AI surveillance report for a case from its timeline entries
 * and persists it as a draft report.
 */
export async function generateCaseReport(caseId: string) {
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

  let sections: AiReportSections;
  try {
    sections = await generateReport({
      caseRecord: caseRecord as Case,
      entries: (entries as TimelineEntry[]) ?? [],
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Report generation failed." };
  }

  const body = [
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
  ].join("\n");

  const { data, error } = await supabase
    .from("reports")
    .insert({
      case_id: caseId,
      title: `Surveillance Report — ${(caseRecord as Case).case_number}`,
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

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/reports");
  return { ok: true, id: data?.id as string };
}

export async function approveReport(reportId: string, clientVisible: boolean) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();
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

  // If client-visible, email the client (non-blocking).
  if (clientVisible) {
    const { data: report } = await supabase
      .from("reports")
      .select("case_id")
      .eq("id", reportId)
      .single();

    if (report?.case_id) {
      const { data: caseRow } = await supabase
        .from("cases")
        .select("case_number,client_id")
        .eq("id", report.case_id)
        .single();

      if (caseRow?.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("email,name")
          .eq("id", caseRow.client_id)
          .single();

        if (client?.email) {
          void sendReportApprovedEmail({
            to: client.email,
            clientName: client.name,
            caseNumber: caseRow.case_number,
          });
        }
      }
    }
  }

  revalidatePath("/reports");
  return { ok: true };
}
