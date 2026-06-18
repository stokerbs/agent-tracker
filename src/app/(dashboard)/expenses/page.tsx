import type { Metadata } from "next";
import { Suspense } from "react";
import { Receipt, TrendingUp } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { getExpenses } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
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
import type { ExpenseCategory } from "@/lib/types";

export const metadata: Metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set<string>(["fuel", "toll", "parking", "food", "hotel", "misc"]);

interface Props {
  searchParams: Promise<{ q?: string; category?: string; from?: string; to?: string }>;
}

export default async function ExpensesPage({ searchParams }: Props) {
  await requireProfile();
  const t = await getTranslations("expenses");
  const locale = await getLocale();
  const sp = await searchParams;
  const expenses = (await getExpenses()) as any[];

  // Stats always reflect full unfiltered dataset
  const now = new Date();
  const thisMonth = expenses.filter((e) => {
    const d = new Date(e.expense_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const allTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = thisMonth.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {});
  const monthName = now.toLocaleString(locale === "th" ? "th-TH" : "en-US", {
    month: "long",
    year: "numeric",
  });

  // Filter table rows
  const search = sp.q?.toLowerCase().trim() ?? "";
  const categoryFilter = VALID_CATEGORIES.has(sp.category ?? "") ? (sp.category as ExpenseCategory) : null;
  const fromDate = sp.from ?? null;
  const toDate = sp.to ?? null;

  const filtered = expenses.filter((e) => {
    if (search) {
      const agentName = (e.agents?.full_name ?? "").toLowerCase();
      const notes = (e.notes ?? "").toLowerCase();
      if (!agentName.includes(search) && !notes.includes(search)) return false;
    }
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (fromDate && e.expense_date < fromDate) return false;
    if (toDate && e.expense_date > toDate) return false;
    return true;
  });

  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <ExportExpensesButton expenses={filtered} />
        <AddExpenseDialog />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("stats.thisMonth")}
          value={formatCurrency(monthTotal)}
          icon={<Receipt className="h-5 w-5" />}
          accent="text-blue-500"
          hint={monthName}
        />
        <StatCard
          label={t("stats.allTime")}
          value={formatCurrency(allTotal)}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="text-emerald-500"
        />
        <StatCard
          label={t("stats.entriesThisMonth")}
          value={thisMonth.length}
          icon={<Receipt className="h-5 w-5" />}
          accent="text-violet-500"
        />
      </div>

      {Object.keys(byCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("summaryByCategory")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(byCategory).map(([cat, total]) => (
              <Badge key={cat} variant="secondary" className="text-sm">
                {t(`categories.${cat as keyof typeof byCategory}` as any)}:{" "}
                {formatCurrency(total)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

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
                  <TableHead>{t("table.notes")}</TableHead>
                  <TableHead className="text-right">{t("table.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{formatDate(e.expense_date)}</TableCell>
                    <TableCell className="text-sm">{e.agents?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {t(`categories.${e.category}` as any)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {e.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(e.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
