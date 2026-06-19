"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateExpenseStatus, softDeleteExpense } from "@/app/(dashboard)/expenses/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExpenseStatus } from "@/lib/types";

interface Props {
  expenseId: string;
  currentStatus: ExpenseStatus;
}

export function ExpenseRowActions({ expenseId, currentStatus }: Props) {
  const t = useTranslations("expenses.actions");
  const [pending, start] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();

  function mark(status: ExpenseStatus) {
    start(async () => {
      const res = await updateExpenseStatus(expenseId, status);
      if ("error" in res) { toast.error(res.error); return; }
      router.refresh();
    });
  }

  function handleDelete() {
    start(async () => {
      const res = await softDeleteExpense(expenseId);
      if ("error" in res) { toast.error(res.error); return; }
      setDeleteOpen(false);
      toast.success("Expense deleted");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            disabled={pending}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {currentStatus !== "paid" && (
            <DropdownMenuItem onClick={() => mark("paid")} className="gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              {t("markPaid")}
            </DropdownMenuItem>
          )}
          {currentStatus !== "reimbursed" && (
            <DropdownMenuItem onClick={() => mark("reimbursed")} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
              {t("markReimbursed")}
            </DropdownMenuItem>
          )}
          {currentStatus !== "pending" && (
            <DropdownMenuItem onClick={() => mark("pending")} className="gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              {t("markPending")}
            </DropdownMenuItem>
          )}
          {currentStatus !== "cancelled" && (
            <DropdownMenuItem onClick={() => mark("cancelled")} className="gap-2">
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
              {t("markCancelled")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending} className="gap-2">
              <Trash2 className="h-4 w-4" />
              {t("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
