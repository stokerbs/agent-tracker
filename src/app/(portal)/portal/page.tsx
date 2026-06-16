import type { Metadata } from "next";
import { FileText, Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReportCard } from "@/components/reports/report-card";
import { InvoiceCard } from "@/components/invoices/invoice-card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Case, Invoice, Report } from "@/lib/types";

export const metadata: Metadata = { title: "Client Portal" };
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const profile = await requireProfile();
  const t = await getTranslations("portal");
  const supabase = await createClient();

  const [{ data: reportsRaw }, { data: invoicesRaw }] = await Promise.all([
    supabase
      .from("reports")
      .select("*, cases(*)")
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("*")
      .order("issued_date", { ascending: false }),
  ]);

  const reports = (reportsRaw ?? []) as (Report & { cases: Case | null })[];
  const invoices = (invoicesRaw ?? []) as Invoice[];
  const firstName = profile.full_name?.split(" ")[0] ?? "Client";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("welcome", { name: firstName })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">
            <FileText className="mr-1 h-4 w-4" /> {t("tabs.reports")}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Receipt className="mr-1 h-4 w-4" /> {t("tabs.invoices")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          {reports.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t("noReports")}
              description={t("noReportsDescription")}
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

        <TabsContent value="invoices" className="space-y-3">
          {invoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title={t("noInvoices")}
              description={t("noInvoicesDescription")}
            />
          ) : (
            invoices.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} canManage={false} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
