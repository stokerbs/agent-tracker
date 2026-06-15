import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ReportCard } from "@/components/reports/report-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Case, Report } from "@/lib/types";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const profile = await requireProfile();
  const staff = isStaff(profile.role);
  const supabase = await createClient();

  const { data } = await supabase
    .from("reports")
    .select("*, cases(*)")
    .order("created_at", { ascending: false });

  const reports = (data ?? []) as (Report & { cases: Case | null })[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surveillance Reports"
        description="AI-generated reports across all cases. Approve to publish to clients."
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No reports yet"
          description="Open a case and use “Generate AI Report” to produce one."
        />
      ) : (
        <div className="grid gap-4">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              caseRecord={r.cases}
              canApprove={staff}
            />
          ))}
        </div>
      )}
    </div>
  );
}
