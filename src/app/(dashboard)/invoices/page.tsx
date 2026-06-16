import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { CreateInvoiceDialog } from "@/components/invoices/create-invoice-dialog";
import { InvoiceCard } from "@/components/invoices/invoice-card";
import type { Invoice, Client, Case } from "@/lib/types";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("invoices");
  const supabase = await createClient();

  const [{ data: invoicesRaw }, { data: clientsRaw }, { data: casesRaw }] =
    await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("*").order("name"),
      supabase.from("cases").select("id,case_number,client_id,client_name").order("case_number"),
    ]);

  const invoices = (invoicesRaw ?? []) as Invoice[];
  const clients = (clientsRaw ?? []) as Client[];
  const cases = (casesRaw ?? []) as Case[];

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);
  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <FadeUp>
        <PageHeader title={t("title")} description={t("description")}>
          <CreateInvoiceDialog clients={clients} cases={cases} />
        </PageHeader>
      </FadeUp>

      <FadeUp delay={0.05}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("stats.count")}
            value={invoices.length}
            icon={<Banknote className="h-4 w-4" />}
            accentBar="primary"
          />
          <StatCard
            label={t("stats.totalInvoiced")}
            value={`฿${totalInvoiced.toLocaleString()}`}
            icon={<Banknote className="h-4 w-4" />}
          />
          <StatCard
            label={t("stats.paid")}
            value={`฿${totalPaid.toLocaleString()}`}
            icon={<Banknote className="h-4 w-4" />}
            accentBar="success"
          />
          <StatCard
            label={t("stats.outstanding")}
            value={`฿${totalOutstanding.toLocaleString()}`}
            icon={<Banknote className="h-4 w-4" />}
            accentBar="warning"
          />
        </div>
      </FadeUp>

      {invoices.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-6 w-6" />}
          title={t("noTitle")}
          description={t("noDescription")}
        />
      ) : (
        <StaggerGrid>
          {invoices.map((invoice) => (
            <StaggerItem key={invoice.id}>
              <InvoiceCard
                invoice={invoice}
                client={clientMap.get(invoice.client_id) ?? null}
                canManage
              />
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </div>
  );
}
