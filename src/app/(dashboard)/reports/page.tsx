import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ReportGenerator } from "./report-generator";
import type { Case } from "@/lib/types";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const profile = await requireProfile();
  if (!isStaff(profile.role)) redirect("/");

  const supabase = await createClient();

  let caseQuery = supabase
    .from("cases")
    .select("id, case_number, client_name")
    .order("case_number", { ascending: true });

  if (profile.role !== "admin") {
    const { data: agentRow } = await supabase
      .from("agents")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (agentRow) {
      const { data: caseAgents } = await supabase
        .from("case_agents")
        .select("case_id")
        .eq("agent_id", agentRow.id);

      const myCaseIds = (caseAgents ?? []).map((ca) => ca.case_id);
      if (myCaseIds.length === 0) {
        return (
          <div className="space-y-6">
            <PageHeader
              title="Daily Report Generator"
              description="Generate Thai, English, or Internal reports from timeline entries."
            />
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No cases assigned"
              description="You have no assigned cases to generate reports for."
            />
          </div>
        );
      }
      caseQuery = caseQuery.in("id", myCaseIds);
    }
  }

  const { data } = await caseQuery;
  const cases = (data ?? []) as Pick<Case, "id" | "case_number" | "client_name">[];

  const caseOptions = cases.map((c) => ({
    id: c.id,
    caseNumber: c.case_number,
    clientName: c.client_name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Report Generator"
        description="Select a case and date, then generate a Thai, English, or Internal surveillance report from timeline entries."
      />

      {caseOptions.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No cases"
          description="Create a case first before generating reports."
        />
      ) : (
        <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm">
          <ReportGenerator cases={caseOptions} />
        </div>
      )}
    </div>
  );
}
