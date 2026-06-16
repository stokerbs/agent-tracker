"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { recordPayment } from "@/app/(dashboard)/invoices/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const METHODS = ["bank_transfer", "cash", "credit_card", "cheque", "other"] as const;

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  onSuccess?: () => void;
}

export function RecordPaymentDialog({
  invoiceId,
  invoiceNumber,
  amount,
  currency,
  onSuccess,
}: Props) {
  const t = useTranslations("invoices.recordPayment");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<string>("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [ref, setRef] = useState("");

  function handleSubmit() {
    if (!method) return;
    start(async () => {
      const res = await recordPayment(invoiceId, {
        paid_at: new Date(paidAt).toISOString(),
        payment_method: method,
        payment_ref: ref.trim(),
      });
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("success"));
      setOpen(false);
      setMethod("");
      setRef("");
      onSuccess?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <CreditCard className="h-3.5 w-3.5" />
          {t("button")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {invoiceNumber} · {amount.toLocaleString()} {currency}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment date */}
          <div className="space-y-1.5">
            <Label>{t("paidAt")}</Label>
            <Input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <Label>{t("method")}</Label>
            <Select value={method} onValueChange={setMethod} required>
              <SelectTrigger>
                <SelectValue placeholder={t("methodPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`methods.${m}` as Parameters<typeof t>[0])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reference */}
          <div className="space-y-1.5">
            <Label>{t("reference")}</Label>
            <Input
              placeholder={t("referencePlaceholder")}
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={pending || !method}
              className="gap-2"
            >
              <CreditCard className="h-4 w-4" />
              {t("confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
