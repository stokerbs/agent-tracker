"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole } from "@/lib/auth";
import { generateReport } from "@/lib/ai-report";
import type { Case, TimelineEntry } from "@/lib/types";

/**
 * Generates an AI surveillance report for a case from its timeline entries
 * and persists it as a draft report.
 */
export async function generateCaseReport(caseId: string) {
  const profile = await requireProfile();
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

  const sections = await generateReport({
    caseRecord: caseRecord as Case,
    entries: (entries as TimelineEntry[]) ?? [],
  });

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

  if (error) return { error: error.message };

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
  if (error) return { error: error.message };
  revalidatePath("/reports");
  return { ok: true };
}
