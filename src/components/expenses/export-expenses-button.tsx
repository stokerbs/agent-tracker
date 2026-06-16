"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { exportExpensesPdf, type ExpenseRow } from "@/lib/export";
import { Button } from "@/components/ui/button";

export function ExportExpensesButton({ expenses }: { expenses: ExpenseRow[] }) {
  const t = useTranslations("expenses");
  const [pending, start] = useTransition();

  function handleExport() {
    start(async () => {
      await exportExpensesPdf({ expenses, title: t("exportTitle") });
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleExport}
      disabled={pending || expenses.length === 0}
    >
      <Download className="h-4 w-4" />
      {t("exportPdf")}
    </Button>
  );
}
