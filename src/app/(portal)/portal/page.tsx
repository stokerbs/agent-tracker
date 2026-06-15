import type { Metadata } from "next";
import { FileText, Receipt } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReportCard } from "@/components/reports/report-card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Case, Report } from "@/lib/types";

export const metadata: Metadata = { title: "Client Portal" };
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS ensures clients only see approved + client-visible reports for their cases.
  const { data } = await supabase
    .from("reports")
    .select("*, cases(*)")
    .order("created_at", { ascending: false });

  const reports = (data ?? []) as (Report & { cases: Case | null })[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {profile.full_name?.split(" ")[0] ?? "Client"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your approved surveillance reports and invoices.
        </p>
      </div>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">
            <FileText className="mr-1 h-4 w-4" /> Reports
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Receipt className="mr-1 h-4 w-4" /> Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          {reports.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No reports available yet"
              description="Approved reports for your cases will appear here. You can read and download each as a PDF."
            />
          ) : (
            reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                caseRecord={r.cases}
                canApprove={false}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="invoices">
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No invoices yet"
            description="Invoices issued for your engagements will be listed here."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
