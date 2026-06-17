import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/reports"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          รายงานทั้งหมด
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <div className="flex items-center gap-1.5 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">{report.title}</span>
        </div>
      </div>

      {/* Case context */}
      {caseInfo && (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            คดี{" "}
            <span className="font-mono font-semibold text-primary">{caseInfo.case_number}</span>
            {caseInfo.case_type && <span> · {caseInfo.case_type}</span>}
            {caseInfo.displayClientName && <span> · ลูกค้า: {caseInfo.displayClientName}</span>}
          </p>
        </div>
      )}

      <ReportEditor
        report={report}
        versions={versions}
        canApprove={canApprove}
        language="th"
      />
    </div>
  );
}
