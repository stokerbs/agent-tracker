"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateInvoice } from "@/app/(dashboard)/invoices/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/lib/types";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue"];

const EMPTY_LINE = (): InvoiceLineItem => ({
  description: "",
  quantity: 1,
  unit_price: 0,
  total: 0,
});

interface Props {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditInvoiceDialog({ invoice, open, onOpenChange, onSuccess }: Props) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const [pending, start] = useTransition();

  const initialLines: InvoiceLineItem[] =
    Array.isArray(invoice.line_items) && invoice.line_items.length > 0
      ? (invoice.line_items as InvoiceLineItem[])
      : [EMPTY_LINE()];

  const [lines, setLines] = useState<InvoiceLineItem[]>(initialLines);
  const [status, setStatus] = useState<InvoiceStatus>(invoice.status);

  const total = lines.reduce((s, l) => s + l.total, 0);

  function updateLine(idx: number, field: keyof InvoiceLineItem, raw: string) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const val = field === "description" ? raw : parseFloat(raw) || 0;
        const updated = { ...l, [field]: val };
        if (field === "quantity" || field === "unit_price") {
          updated.total = parseFloat((updated.quantity * updated.unit_price).toFixed(2));
        }
        return updated;
      }),
    );
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setLines(initialLines);
      setStatus(invoice.status);
    }
    onOpenChange(v);
  }

  function submit(formData: FormData) {
    formData.set("line_items", JSON.stringify(lines));
    formData.set("status", status);
    start(async () => {
      const res = await updateInvoice(invoice.id, formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("editDialog.toast.success"));
      onOpenChange(false);
      onSuccess?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("editDialog.description")}{" "}
            <span className="font-mono text-primary">{invoice.invoice_number}</span>
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">{t("createDialog.fields.invoiceTitle")}</Label>
            <Input
              id="edit-title"
              name="title"
              defaultValue={invoice.title}
              required
            />
          </div>

          {/* Status + Due date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("table.status")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`status.${s}` as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-due_date">{t("createDialog.fields.dueDate")}</Label>
              <Input
                id="edit-due_date"
                name="due_date"
                type="date"
                defaultValue={invoice.due_date ?? ""}
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <Label>{t("createDialog.fields.lineItems")}</Label>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <div className="grid grid-cols-[1fr_56px_96px_80px_32px] gap-2 bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{t("createDialog.fields.itemDescription")}</span>
                <span className="text-right">{t("createDialog.fields.qty")}</span>
                <span className="text-right">{t("createDialog.fields.unitPrice")}</span>
                <span className="text-right">{t("createDialog.fields.total")}</span>
                <span />
              </div>
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_56px_96px_80px_32px] gap-2 border-t border-border/40 px-3 py-2"
                >
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                    placeholder="e.g. Surveillance operations"
                    className="h-7 text-xs"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, "quantity", e.target.value)}
                    className="h-7 text-right text-xs font-mono"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={line.unit_price}
                    onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                    className="h-7 text-right text-xs font-mono"
                  />
                  <div className="flex h-7 items-center justify-end font-mono text-xs">
                    {line.total.toLocaleString()}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setLines((p) => p.filter((_, j) => j !== i))}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setLines((p) => [...p, EMPTY_LINE()])}
              >
                <Plus className="h-3 w-3" /> {t("createDialog.fields.addLine")}
              </Button>
              <span className="font-mono text-sm font-semibold">
                {t("createDialog.fields.totalAmount")}: {total.toLocaleString()} {invoice.currency}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">{t("createDialog.fields.notes")}</Label>
            <Textarea
              id="edit-notes"
              name="notes"
              defaultValue={invoice.notes ?? ""}
              placeholder={t("createDialog.fields.notesPlaceholder")}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("editDialog.saveButton")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
