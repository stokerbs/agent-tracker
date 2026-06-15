import type { Metadata } from "next";
import { Receipt, TrendingUp } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getExpenses } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
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
import { EXPENSE_CATEGORY_META } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  await requireProfile();
  const expenses = (await getExpenses()) as any[];

  const now = new Date();
  const thisMonth = expenses.filter((e) => {
    const d = new Date(e.expense_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const allTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // Category breakdown for this month.
  const byCategory = thisMonth.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Management"
        description="Field reimbursements and monthly summaries."
      >
        <AddExpenseDialog />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="This month"
          value={formatCurrency(monthTotal)}
          icon={<Receipt className="h-5 w-5" />}
          accent="text-blue-500"
          hint={now.toLocaleString("en-US", { month: "long", year: "numeric" })}
        />
        <StatCard
          label="All time"
          value={formatCurrency(allTotal)}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="text-emerald-500"
        />
        <StatCard
          label="Entries this month"
          value={thisMonth.length}
          icon={<Receipt className="h-5 w-5" />}
          accent="text-violet-500"
        />
      </div>

      {Object.keys(byCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Summary by Category</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(byCategory).map(([cat, total]) => (
              <Badge key={cat} variant="secondary" className="text-sm">
                {EXPENSE_CATEGORY_META[cat as keyof typeof EXPENSE_CATEGORY_META]?.label ?? cat}:{" "}
                {formatCurrency(total)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title="No expenses logged"
                description="Submit your first field expense to start tracking."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{formatDate(e.expense_date)}</TableCell>
                    <TableCell className="text-sm">{e.agents?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {EXPENSE_CATEGORY_META[e.category as keyof typeof EXPENSE_CATEGORY_META]?.label ?? e.category}
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
