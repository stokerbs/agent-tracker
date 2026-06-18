import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReportEditor } from "@/components/reports/report-editor";
import type { Report, ReportVersion } from "@/lib/types";

export const metadata: Metadata = { title: "Edit Report" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportEditPage({ params }: Props) {
  const { id } = await params;
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: reportData } = await supabase
    .from("reports")
    .select("*, cases(case_number, case_type, client_name, clients(name))")
    .eq("id", id)
    .single();

  if (!reportData) notFound();

  const report = reportData as Report;
  const caseInfoRaw = reportData.cases as {
    case_number: string;
    case_type: string | null;
    client_name: string | null;
    clients: { name: string } | null;
  } | null;

  // Prefer the joined clients.name (stays accurate) over the legacy client_name denorm.
  const caseInfo = caseInfoRaw
    ? {
        ...caseInfoRaw,
        displayClientName: caseInfoRaw.clients?.name ?? caseInfoRaw.client_name,
      }
    : null;

  const { data: versionsData } = await supabase
    .from("report_versions")
    .select("*")
    .eq("report_id", id)
    .order("version_number", { ascending: false });

  const versions = (versionsData ?? []) as ReportVersion[];
  const canApprove = isStaff(profile.role);

  return (
    <ReportEditor
      report={report}
      versions={versions}
      canApprove={canApprove}
      language="th"
      caseInfo={caseInfo}
    />
  );
}
