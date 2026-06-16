import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("reports");
  const staff = isStaff(profile.role);
  const supabase = await createClient();

  const { data } = await supabase
    .from("reports")
    .select("*, cases(*)")
    .order("created_at", { ascending: false });

  const reports = (data ?? []) as (Report & { cases: Case | null })[];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={t("noTitle")}
          description={t("noDescription")}
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
