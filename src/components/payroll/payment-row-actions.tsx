"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, CheckCircle2, Clock, XCircle, SlidersHorizontal } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updatePaymentStatus, adjustPayment, deletePayment } from "@/app/(dashboard)/payroll/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PayrollStatus } from "@/lib/types";

interface Props {
  paymentId: string;
  currentStatus: PayrollStatus;
  currentAmount: number;
}

export function PaymentRowActions({ paymentId, currentStatus, currentAmount }: Props) {
  const t = useTranslations("payroll");
  const [pending, start] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const router = useRouter();

  function mark(status: PayrollStatus) {
    start(async () => {
      try {
        await updatePaymentStatus(paymentId, status);
        router.refresh();
      } catch {
        toast.error("Failed to update status.");
      }
    });
  }

  function handleDelete() {
    start(async () => {
      try {
        await deletePayment(paymentId);
        setDeleteOpen(false);
        toast.success("Entry deleted");
        router.refresh();
      } catch {
        toast.error("Failed to delete entry.");
      }
    });
  }

  function handleAdjust(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newAmount = parseFloat(fd.get("new_amount") as string);
    const reason = fd.get("reason") as string;
    start(async () => {
      try {
        await adjustPayment(paymentId, newAmount, reason);
        toast.success(t("adjust.toast.success"));
        setAdjustOpen(false);
        router.refresh();
      } catch {
        toast.error("Failed to adjust amount.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" disabled={pending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {currentStatus !== "paid" && (
            <DropdownMenuItem onClick={() => mark("paid")} className="gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              {t("actions.markPaid")}
            </DropdownMenuItem>
          )}
          {currentStatus !== "pending" && (
            <DropdownMenuItem onClick={() => mark("pending")} className="gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              {t("actions.markPending")}
            </DropdownMenuItem>
          )}
          {currentStatus !== "cancelled" && (
            <DropdownMenuItem onClick={() => mark("cancelled")} className="gap-2">
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
              {t("actions.markCancelled")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setAdjustOpen(true)} className="gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-blue-500" />
            {t("actions.adjust")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("actions.deleteConfirm")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Adjust Amount Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("adjust.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new_amount">{t("adjust.newAmountLabel")}</Label>
              <Input
                id="new_amount"
                name="new_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={currentAmount}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">{t("adjust.reasonLabel")}</Label>
              <Input
                id="reason"
                name="reason"
                placeholder={t("adjust.reasonPlaceholder")}
                required
              />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAdjustOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("adjust.submitButton")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("actions.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("actions.deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending} className="gap-2">
              <Trash2 className="h-4 w-4" />
              {t("actions.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
