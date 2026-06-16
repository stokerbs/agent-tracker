import type { Metadata } from "next";
import { AlertTriangle, Banknote, Briefcase, FileText, Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReportCard } from "@/components/reports/report-card";
import { InvoiceCard } from "@/components/invoices/invoice-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FadeUp } from "@/components/shared/motion";
import { formatCurrency } from "@/lib/utils";
import type { Case, Client, Invoice, Report } from "@/lib/types";

export const metadata: Metadata = { title: "Client Portal" };
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const profile = await requireProfile();
  const t = await getTranslations("portal");
  const supabase = await createClient();

  const [{ data: reportsRaw }, { data: invoicesRaw }, { data: casesRaw }, { data: clientRaw }] =
    await Promise.all([
      supabase
        .from("reports")
        .select("*, cases(*)")
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("*")
        .order("issued_date", { ascending: false }),
      supabase
        .from("cases")
        .select("id,status")
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("name,company")
        .eq("profile_id", profile.id)
        .maybeSingle(),
    ]);

  const reports  = (reportsRaw  ?? []) as (Report & { cases: Case | null })[];
  const invoices = (invoicesRaw ?? []) as Invoice[];
  const cases    = (casesRaw    ?? []) as Pick<Case, "id" | "status">[];
  const client   = clientRaw as Pick<Client, "name" | "company"> | null;

  const firstName   = profile.full_name?.split(" ")[0] ?? client?.name ?? "Client";
  const companyLine = client?.company ?? null;

  // Stats
  const openCases   = cases.filter((c) => c.status !== "closed").length;
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);
  const totalPaid   = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const overdueTotal    = overdueInvoices.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <FadeUp>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("welcome", { name: firstName })}
          </h1>
          {companyLine && (
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">{companyLine}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </FadeUp>

      {/* Stat cards */}
      <FadeUp delay={0.04}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={t("stats.openCases")}
            value={openCases}
            icon={<Briefcase className="h-4 w-4" />}
            accentBar={openCases > 0 ? "primary" : undefined}
          />
          <StatCard
            label={t("stats.reports")}
            value={reports.length}
            icon={<FileText className="h-4 w-4" />}
            accentBar={reports.length > 0 ? "success" : undefined}
          />
          <StatCard
            label={t("stats.outstanding")}
            value={formatCurrency(outstanding)}
            icon={<Banknote className="h-4 w-4" />}
            accentBar={outstanding > 0 ? "warning" : undefined}
          />
          <StatCard
            label={t("stats.paid")}
            value={formatCurrency(totalPaid)}
            icon={<Banknote className="h-4 w-4" />}
            accentBar={totalPaid > 0 ? "success" : undefined}
          />
        </div>
      </FadeUp>

      {/* Overdue alert */}
      {overdueInvoices.length > 0 && (
        <FadeUp delay={0.07}>
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {t("overdueAlert", {
                count: overdueInvoices.length,
                total: formatCurrency(overdueTotal),
              })}
            </p>
          </div>
        </FadeUp>
      )}

      {/* Tabs */}
      <FadeUp delay={0.1}>
        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">
              <FileText className="mr-1 h-4 w-4" />
              {t("tabs.reports")}
              {reports.length > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {reports.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <Receipt className="mr-1 h-4 w-4" />
              {t("tabs.invoices")}
              {overdueInvoices.length > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  {overdueInvoices.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-4 space-y-4">
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

          <TabsContent value="invoices" className="mt-4 space-y-3">
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
      </FadeUp>
    </div>
  );
}
