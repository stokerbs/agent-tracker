"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createInvoice } from "@/app/(dashboard)/invoices/actions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client, Case, InvoiceLineItem } from "@/lib/types";

const EMPTY_LINE = (): InvoiceLineItem => ({
  description: "",
  quantity: 1,
  unit_price: 0,
  total: 0,
});

export function CreateInvoiceDialog({
  clients,
  cases,
  defaultClientId,
  defaultCaseId,
  trigger,
}: {
  clients: Client[];
  cases: Case[];
  defaultClientId?: string;
  defaultCaseId?: string;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selectedClient, setSelectedClient] = useState(defaultClientId ?? "");
  const [lines, setLines] = useState<InvoiceLineItem[]>([EMPTY_LINE()]);

  const locked = Boolean(defaultClientId);

  const clientCases = cases.filter((c) => c.client_id === selectedClient);
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

  function submit(formData: FormData) {
    formData.set("line_items", JSON.stringify(lines));
    formData.set("client_id", selectedClient);
    start(async () => {
      const res = await createInvoice(formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("createDialog.toast.success"));
      setOpen(false);
      setLines([EMPTY_LINE()]);
      setSelectedClient(defaultClientId ?? "");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> {t("newInvoice")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("createDialog.title")}</DialogTitle>
          <DialogDescription>{t("createDialog.description")}</DialogDescription>
        </DialogHeader>

        <form action={submit} className="space-y-5">
          {/* Client + Case row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("createDialog.fields.client")}</Label>
              <Select
                value={selectedClient}
                onValueChange={locked ? undefined : setSelectedClient}
                required
                disabled={locked}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("createDialog.fields.clientPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="client_id" value={selectedClient} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("createDialog.fields.case")}</Label>
              <Select
                name="case_id"
                defaultValue={defaultCaseId}
                disabled={locked || !selectedClient}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("createDialog.fields.casePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {clientCases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_number} · {c.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">{t("createDialog.fields.invoiceTitle")}</Label>
            <Input
              id="title"
              name="title"
              placeholder={t("createDialog.fields.invoiceTitlePlaceholder")}
              required
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="issued_date">{t("createDialog.fields.issuedDate")}</Label>
              <Input
                id="issued_date"
                name="issued_date"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_date">{t("createDialog.fields.dueDate")}</Label>
              <Input id="due_date" name="due_date" type="date" />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <Label>{t("createDialog.fields.lineItems")}</Label>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_56px_96px_80px_32px] gap-2 bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{t("createDialog.fields.itemDescription")}</span>
                <span className="text-right">{t("createDialog.fields.qty")}</span>
                <span className="text-right">{t("createDialog.fields.unitPrice")}</span>
                <span className="text-right">{t("createDialog.fields.total")}</span>
                <span />
              </div>
              {/* Rows */}
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
                {t("createDialog.fields.totalAmount")}: {total.toLocaleString()} THB
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("createDialog.fields.notes")}</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder={t("createDialog.fields.notesPlaceholder")}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !selectedClient}>
              {t("createDialog.createButton")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
