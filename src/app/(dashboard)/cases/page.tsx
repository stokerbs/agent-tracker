import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Briefcase } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decryptField } from "@/lib/security/encryption";
import { PageHeader } from "@/components/shared/page-header";
import { CreateCaseDialog } from "@/components/cases/create-case-dialog";
import { CaseFilters } from "@/components/cases/case-filters";
import {
  CasePriorityBadge,
  CaseStatusBadge,
} from "@/components/shared/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { formatDate, cn } from "@/lib/utils";
import type { Case, CasePriority, CaseStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Cases" };
export const dynamic = "force-dynamic";

const PRIORITY_STRIPE: Record<string, string> = {
  critical: "bg-destructive",
  high:     "bg-orange-500",
  medium:   "bg-warning",
  low:      "bg-muted-foreground/40",
};

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
  }>;
}

export default async function CasesPage({ searchParams }: Props) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const t = await getTranslations("cases");
  const supabase = await createClient();

  let query = supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false });

  if (sp.q) {
    const like = `%${sp.q}%`;
    query = query.or(`case_number.ilike.${like},client_name.ilike.${like}`);
  }
  if (sp.status && sp.status !== "all") {
    query = query.eq("status", sp.status as CaseStatus);
  }
  if (sp.priority && sp.priority !== "all") {
    query = query.eq("priority", sp.priority as CasePriority);
  }

  const { data } = await query;
  const cases = (data ?? []) as Case[];

  const year = new Date().getFullYear();
  const { count: totalCount } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true });
  const seq = String((totalCount ?? 0) + 1).padStart(4, "0");
  const suggestedNumber = `CASE-${year}-${seq}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        {isStaff(profile.role) && (
          <CreateCaseDialog suggestedNumber={suggestedNumber} />
        )}
      </PageHeader>

      <Suspense>
        <CaseFilters count={cases.length} />
      </Suspense>

      {cases.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title={t("noTitle")}
          description={t("noDescription")}
        />
      ) : (
        <StaggerGrid className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cases.map((c) => {
            const targetName = c.target_name_enc ? decryptField(c.target_name_enc) : null;
            return (
              <StaggerItem key={c.id}>
                <Link
                  href={`/cases/${c.id}`}
                  className="group relative flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card transition-all duration-200 hover:border-border hover:shadow-sm focus-ring"
                >
                  {/* Priority stripe */}
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 w-0.5 rounded-l-lg",
                      PRIORITY_STRIPE[c.priority] ?? "bg-border",
                    )}
                  />

                  <div className="p-4 pl-5">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-semibold tracking-wider text-primary">
                        {c.case_number}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <CasePriorityBadge priority={c.priority} />
                        <CaseStatusBadge status={c.status} />
                      </div>
                    </div>

                    {/* Target / client */}
                    <div className="mt-2 space-y-0.5">
                      {targetName && (
                        <p className="truncate text-sm font-medium">{targetName}</p>
                      )}
                      <p className="truncate text-xs text-muted-foreground">
                        {c.client_name ?? "—"}
                        {c.case_type && (
                          <span className="text-muted-foreground/60"> · {c.case_type}</span>
                        )}
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground/60">
                      <span>{formatDate(c.start_date)}</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}
    </div>
  );
}
