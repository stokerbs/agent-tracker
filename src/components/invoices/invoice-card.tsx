"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateInvoiceStatus } from "@/app/(dashboard)/invoices/actions";
import { exportInvoicePdf } from "@/lib/export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatDate } from "@/lib/utils";
import type { Invoice, Client, InvoiceStatus } from "@/lib/types";

const STATUS_META: Record<InvoiceStatus, { badge: string }> = {
  draft:   { badge: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  sent:    { badge: "bg-primary/10 text-primary border-primary/20" },
  paid:    { badge: "bg-success/10 text-success border-success/20" },
  overdue: { badge: "bg-destructive/10 text-destructive border-destructive/20" },
};

const NEXT_STATUSES: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft:   ["sent"],
  sent:    ["paid", "overdue"],
  paid:    [],
  overdue: ["paid"],
};

export function InvoiceCard({
  invoice,
  client,
  canManage = false,
}: {
  invoice: Invoice;
  client?: Client | null;
  canManage?: boolean;
}) {
  const t = useTranslations("invoices");
  const [pending, start] = useTransition();
  const router = useRouter();

  const statusMeta = STATUS_META[invoice.status];
  const statusLabel = t(`statusBadge.${invoice.status}` as Parameters<typeof t>[0]);
  const nextStatuses = NEXT_STATUSES[invoice.status];

  function changeStatus(status: InvoiceStatus) {
    start(async () => {
      const res = await updateInvoiceStatus(invoice.id, status);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("updateStatus.toast.success"));
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-border">
      {/* Left: invoice info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-primary">
            {invoice.invoice_number}
          </span>
          <Badge
            className={cn(
              "border text-[9px] font-bold uppercase tracking-widest",
              statusMeta.badge,
            )}
          >
            {statusLabel}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-sm font-medium">{invoice.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {client?.name ?? "—"}
          {invoice.issued_date && ` · ${t("table.issued")}: ${formatDate(invoice.issued_date)}`}
          {invoice.due_date && ` · ${t("table.due")}: ${formatDate(invoice.due_date)}`}
        </p>
      </div>

      {/* Right: amount + actions */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-base font-bold">
          {invoice.amount.toLocaleString()} {invoice.currency}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => exportInvoicePdf({ invoice, client })}
          title={t("downloadPdf")}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>

        {canManage && nextStatuses.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">{t("markAs")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {nextStatuses.map((s) => (
                <DropdownMenuItem key={s} onClick={() => changeStatus(s)}>
                  {t(`status.${s}` as Parameters<typeof t>[0])}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
