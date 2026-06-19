import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock, Receipt, TrendingUp, CheckCircle2, RefreshCw } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExpenses } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { CaptureReceiptDialog } from "@/components/expenses/capture-receipt-dialog";
import { ExpenseRowActions } from "@/components/expenses/expense-row-actions";
import { ExportExpensesButton } from "@/components/expenses/export-expenses-button";
import { ExpenseFilters } from "@/components/expenses/expense-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExpenseCategory, ExpenseStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set<string>([
  "fuel", "toll", "parking", "meals", "accommodation", "transportation", "office", "misc",
]);

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  pending:     "border-amber-500/40 bg-amber-500/10 text-amber-500",
  paid:        "border-success/40 bg-success/10 text-success",
  reimbursed:  "border-blue-500/40 bg-blue-500/10 text-blue-500",
  cancelled:   "border-border/60 bg-muted/40 text-muted-foreground",
};

interface Props {
  searchParams: Promise<{ q?: string; category?: string; from?: string; to?: string }>;
}

export default async function ExpensesPage({ searchParams }: Props) {
  const profile = await requireProfile();
  const t = await getTranslations("expenses");
  const locale = await getLocale();
  const sp = await searchParams;
  const supabase = await createClient();
  const staff = isStaff(profile.role);

  const [expenses, casesRaw] = await Promise.all([
    getExpenses() as Promise<any[]>,
    supabase
      .from("cases")
      .select("id, case_number")
      .order("case_number", { ascending: true })
      .then(({ data }) => data ?? []),
  ]);

  // Stats: full unfiltered dataset
  const now = new Date();
  const bkkNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const thisMonth = expenses.filter((e: any) => {
    const d = new Date(e.expense_date + "T00:00:00");
    return d.getMonth() === bkkNow.getMonth() && d.getFullYear() === bkkNow.getFullYear();
  });

  const monthTotal = thisMonth.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const allTotal   = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  // Status totals (all expenses, not just this month)
  const pendingTotal     = expenses.filter((e: any) => e.status === "pending").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const paidTotal        = expenses.filter((e: any) => e.status === "paid").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const reimbursedTotal  = expenses.filter((e: any) => e.status === "reimbursed").reduce((s: number, e: any) => s + Number(e.amount), 0);

  const byCategory = thisMonth.reduce<Record<string, number>>((acc, e: any) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {});
  const monthName = bkkNow.toLocaleString(locale === "th" ? "th-TH" : "en-US", {
    month: "long", year: "numeric",
  });

  // Per-day breakdown (this month)
  const byDay = thisMonth.reduce<Record<string, number>>((acc, e: any) => {
    acc[e.expense_date] = (acc[e.expense_date] ?? 0) + Number(e.amount);
    return acc;
  }, {});
  const dayRows = Object.entries(byDay)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14);

  // Per-agent breakdown (this month)
  const byAgent = thisMonth.reduce<Record<string, number>>((acc, e: any) => {
    const name = e.agents?.full_name ?? "—";
    acc[name] = (acc[name] ?? 0) + Number(e.amount);
    return acc;
  }, {});
  const agentRows = Object.entries(byAgent).sort(([, a], [, b]) => b - a).slice(0, 8);

  // Per-case breakdown (this month)
  const byCase = thisMonth.reduce<Record<string, { caseNumber: string; total: number }>>((acc, e: any) => {
    if (!e.case_id) return acc;
    const cn = e.cases?.case_number ?? e.case_id.slice(0, 8);
    if (!acc[e.case_id]) acc[e.case_id] = { caseNumber: cn, total: 0 };
    acc[e.case_id].total += Number(e.amount);
    return acc;
  }, {});
  const caseRows = Object.values(byCase).sort((a, b) => b.total - a.total).slice(0, 8);

  // Filter table rows
  const search = sp.q?.toLowerCase().trim() ?? "";
  const categoryFilter = VALID_CATEGORIES.has(sp.category ?? "") ? (sp.category as ExpenseCategory) : null;
  const fromDate = sp.from ?? null;
  const toDate   = sp.to ?? null;

  const filtered = expenses.filter((e: any) => {
    if (search) {
      const agentName = (e.agents?.full_name ?? "").toLowerCase();
      const notes  = (e.notes ?? "").toLowerCase();
      const vendor = (e.vendor_name ?? "").toLowerCase();
      if (!agentName.includes(search) && !notes.includes(search) && !vendor.includes(search)) return false;
    }
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (fromDate && e.expense_date < fromDate) return false;
    if (toDate   && e.expense_date > toDate)   return false;
    return true;
  });

  const filteredTotal = filtered.reduce((s: number, e: any) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <ExportExpensesButton expenses={filtered} />
        <CaptureReceiptDialog cases={casesRaw} />
        <AddExpenseDialog />
      </PageHeader>

      {/* Status stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("stats.pending")}
          value={formatCurrency(pendingTotal)}
          icon={<Clock className="h-5 w-5" />}
          accent="text-amber-500"
          accentBar={pendingTotal > 0 ? "warning" : undefined}
        />
        <StatCard
          label={t("stats.paid")}
          value={formatCurrency(paidTotal)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="text-emerald-500"
          accentBar={paidTotal > 0 ? "success" : undefined}
        />
        <StatCard
          label={t("stats.reimbursed")}
          value={formatCurrency(reimbursedTotal)}
          icon={<RefreshCw className="h-5 w-5" />}
          accent="text-blue-500"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("stats.thisMonth")}
          value={formatCurrency(monthTotal)}
          icon={<Receipt className="h-5 w-5" />}
          accent="text-muted-foreground"
          hint={monthName}
        />
        <StatCard
          label={t("stats.allTime")}
          value={formatCurrency(allTotal)}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="text-muted-foreground"
        />
        <StatCard
          label={t("stats.entriesThisMonth")}
          value={thisMonth.length}
          icon={<Receipt className="h-5 w-5" />}
          accent="text-muted-foreground"
        />
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("summaryByCategory")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(byCategory).map(([cat, total]) => (
              <Badge key={cat} variant="secondary" className="text-sm">
                {t(`categories.${cat}` as any)}: {formatCurrency(total)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Breakdowns: by day / by agent / by case */}
      {thisMonth.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">By Day</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {dayRows.map(([date, total]) => (
                    <TableRow key={date}>
                      <TableCell className="py-1.5 text-xs">{formatDate(date)}</TableCell>
                      <TableCell className="py-1.5 text-right text-xs font-medium tabular-nums">{formatCurrency(total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {agentRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">By Agent</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {agentRows.map(([name, total]) => (
                      <TableRow key={name}>
                        <TableCell className="py-1.5 text-xs">{name}</TableCell>
                        <TableCell className="py-1.5 text-right text-xs font-medium tabular-nums">{formatCurrency(total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {caseRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">By Case</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {caseRows.map((row) => (
                      <TableRow key={row.caseNumber}>
                        <TableCell className="py-1.5 font-mono text-xs">{row.caseNumber}</TableCell>
                        <TableCell className="py-1.5 text-right text-xs font-medium tabular-nums">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main table */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <Suspense>
            <ExpenseFilters count={filtered.length} filteredTotal={filteredTotal} />
          </Suspense>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title={search || categoryFilter || fromDate || toDate ? t("filters.noResults") : t("noTitle")}
              description={search || categoryFilter || fromDate || toDate ? t("filters.noResultsDescription") : t("noDescription")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.date")}</TableHead>
                  <TableHead>{t("table.agent")}</TableHead>
                  <TableHead>{t("table.category")}</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>{t("table.notes")}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{t("table.amount")}</TableHead>
                  {staff && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e: any) => {
                  const status: ExpenseStatus = e.status ?? "pending";
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">{formatDate(e.expense_date)}</TableCell>
                      <TableCell className="text-sm">{e.agents?.full_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {t(`categories.${e.category}` as any)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[110px] truncate text-sm text-muted-foreground">
                        {e.vendor_name ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                        {e.notes ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status]}`}>
                            {t(`status.${status}` as any)}
                          </span>
                          {e.paid_by_name && (
                            <span className="text-[10px] text-muted-foreground">
                              {t("actions.paidBy", { name: e.paid_by_name })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(Number(e.amount))}
                      </TableCell>
                      {staff && (
                        <TableCell>
                          <ExpenseRowActions expenseId={e.id} currentStatus={status} />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
