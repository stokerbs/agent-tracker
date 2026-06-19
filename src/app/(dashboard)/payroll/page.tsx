import type { Metadata } from "next";
import { Suspense } from "react";
import { Wallet, Clock, CheckCircle2, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAgents, getCases } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AddPaymentDialog } from "@/components/payroll/add-payment-dialog";
import { PayrollListClient } from "@/components/payroll/payroll-list-client";
import type { AgentPayment } from "@/lib/types";

export const metadata: Metadata = { title: "Payroll" };
export const dynamic = "force-dynamic";

interface PaymentRow extends AgentPayment {
  agents?: { full_name: string } | null;
  cases?: { case_number: string } | null;
  paid_by_name?: string | null;
}

export default async function PayrollPage() {
  const profile = await requireProfile();
  const t = await getTranslations("payroll");
  const supabase = await createClient();
  const staff = isStaff(profile.role);

  const paymentsQuery = supabase
    .from("agent_payments")
    .select("*, agents(full_name), cases(case_number), profiles!agent_payments_paid_by_fkey(full_name)")
    .order("work_date", { ascending: false });

  const [paymentsResult, agents, cases] = await Promise.all([
    paymentsQuery,
    staff ? getAgents() : Promise.resolve([]),
    staff ? getCases() : Promise.resolve([]),
  ]);

  const rawPayments: PaymentRow[] = ((paymentsResult.data ?? []) as any[]).map((p) => ({
    ...p,
    paid_by_name: (p.profiles as { full_name: string | null } | null)?.full_name ?? null,
  }));

  const pendingTotal = rawPayments.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);
  const paidTotal    = rawPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
  const cancelledTotal = rawPayments.filter((p) => p.status === "cancelled").reduce((s, p) => s + Number(p.amount), 0);

  const title = staff ? t("title") : t("myTitle");
  const description = staff ? t("description") : t("myDescription");

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description}>
        {staff && (
          <AddPaymentDialog agents={agents} cases={cases} />
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("stats.pending")}
          value={`฿${pendingTotal.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`}
          icon={<Clock className="h-4 w-4" />}
          accent="text-amber-500"
        />
        <StatCard
          label={t("stats.paid")}
          value={`฿${paidTotal.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="text-green-500"
        />
        <StatCard
          label={t("stats.cancelled")}
          value={`฿${cancelledTotal.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`}
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      {/* List */}
      <Suspense>
        <PayrollListClient payments={rawPayments} userRole={profile.role} />
      </Suspense>
    </div>
  );
}
