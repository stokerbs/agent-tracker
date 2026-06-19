"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { addExpense } from "@/app/(dashboard)/expenses/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExpenseCategory } from "@/lib/types";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "fuel", "toll", "parking", "meals", "accommodation", "transportation", "office", "misc",
];

export function AddExpenseDialog({ caseId }: { caseId?: string } = {}) {
  const t = useTranslations("expenses.dialog");
  const tCategories = useTranslations("expenses.categories");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }));
  }, []);

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = await addExpense(formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.success"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4" /> {t("submitButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
          {caseId && <input type="hidden" name="case_id" value={caseId} />}

          <div className="space-y-2">
            <Label htmlFor="category">{t("categoryLabel")}</Label>
            <Select name="category" defaultValue="misc">
              <SelectTrigger id="category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((k) => (
                  <SelectItem key={k} value={k}>{tCategories(k)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t("amountLabel")}</Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense_date">{t("dateLabel")}</Label>
            <Input id="expense_date" name="expense_date" type="date" defaultValue={today} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense_time">{t("timeLabel") ?? "Time"}</Label>
            <Input id="expense_time" name="expense_time" type="time" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="vendor_name">{t("vendorLabel") ?? "Vendor"}</Label>
            <Input id="vendor_name" name="vendor_name" placeholder="e.g. PTT, Grab, 7-Eleven" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipt">{t("receiptLabel")}</Label>
            <Input id="receipt" name="receipt" type="file" accept="image/*,application/pdf" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("notesLabel")}</Label>
            <Input id="notes" name="notes" placeholder={t("notesPlaceholder")} />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("submitButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
