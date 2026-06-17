import type { Metadata } from "next";
import Link from "next/link";
import { Archive, FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ReportCard } from "@/components/reports/report-card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { Case, Report } from "@/lib/types";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ show_archived?: string }>;
}

export default async function ReportsPage({ searchParams }: Props) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const t = await getTranslations("reports");
  const staff = isStaff(profile.role);
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();
  const showArchived = sp.show_archived === "1";

  let query = supabase
    .from("reports")
    .select("*, cases(*)")
    .order("created_at", { ascending: false });

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  const { data } = await query;
  const reports = (data ?? []) as (Report & { cases: Case | null })[];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Link
          href={showArchived ? "/reports" : "/reports?show_archived=1"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            showArchived
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Archive className="h-3.5 w-3.5" />
          {showArchived ? "ดูรายงานที่ใช้งาน" : "เก็บถาวร"}
        </Link>
      </PageHeader>

      {reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={showArchived ? "ไม่มีรายงานที่เก็บถาวร" : t("noTitle")}
          description={showArchived ? "ยังไม่มีรายงานที่ถูกเก็บถาวร" : t("noDescription")}
        />
      ) : (
        <div className="grid gap-4">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              caseRecord={r.cases}
              canApprove={staff}
              canManage={staff}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
