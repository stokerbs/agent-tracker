"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentStatusBadge } from "./payment-status-badge";
import { PaymentRowActions } from "./payment-row-actions";
import { bulkMarkPaid } from "@/app/(dashboard)/payroll/actions";
import type { AgentPayment, PayrollStatus, UserRole } from "@/lib/types";

const STATUSES: PayrollStatus[] = ["pending", "paid", "cancelled", "adjusted"];

interface PaymentRow extends AgentPayment {
  agents?: { full_name: string } | null;
  cases?: { case_number: string } | null;
  paid_by_name?: string | null;
}

interface Props {
  payments: PaymentRow[];
  userRole: UserRole;
}

export function PayrollListClient({ payments, userRole }: Props) {
  const t = useTranslations("payroll");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();

  const isStaff = userRole === "admin" || userRole === "supervisor";

  function push(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function pushDebounced(key: string, value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push(key, value), 300);
  }

  function clearAll() {
    router.push(pathname);
    setSelected(new Set());
  }

  const hasFilters = sp.has("q") || sp.has("status") || sp.has("from") || sp.has("to");

  const q = sp.get("q")?.toLowerCase() ?? "";
  const statusFilter = sp.get("status") ?? "";
  const fromFilter = sp.get("from") ?? "";
  const toFilter = sp.get("to") ?? "";

  const filtered = payments.filter((p) => {
    if (q && !p.agents?.full_name.toLowerCase().includes(q) && !(p.notes ?? "").toLowerCase().includes(q)) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (fromFilter && p.work_date < fromFilter) return false;
    if (toFilter && p.work_date > toFilter) return false;
    return true;
  });

  const filteredTotal = filtered.reduce((s, p) => s + Number(p.amount), 0);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const pendingIds = filtered.filter((p) => p.status === "pending").map((p) => p.id);
    setSelected((prev) => {
      if (pendingIds.every((id) => prev.has(id))) return new Set();
      return new Set(pendingIds);
    });
  }

  function handleBulkPaid() {
    const ids = Array.from(selected);
    startBulk(async () => {
      try {
        await bulkMarkPaid(ids);
        setSelected(new Set());
        toast.success(t("bulk.markPaid"));
        router.refresh();
      } catch {
        toast.error("Failed to mark as paid.");
      }
    });
  }

  const pendingInFiltered = filtered.filter((p) => p.status === "pending");
  const allPendingSelected = pendingInFiltered.length > 0 && pendingInFiltered.every((p) => selected.has(p.id));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="h-8 w-48 pl-8 text-xs"
            placeholder={t("filters.searchPlaceholder")}
            defaultValue={sp.get("q") ?? ""}
            onChange={(e) => pushDebounced("q", e.target.value)}
          />
        </div>

        <Select value={sp.get("status") ?? "all"} onValueChange={(v) => push("status", v)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder={t("filters.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t(`status.${s}` as any)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{t("filters.from")}</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            defaultValue={sp.get("from") ?? ""}
            onChange={(e) => push("from", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{t("filters.to")}</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            defaultValue={sp.get("to") ?? ""}
            onChange={(e) => push("to", e.target.value)}
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 gap-1 text-xs">
            <X className="h-3 w-3" />
            {t("filters.clearFilters")}
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {t("filters.results", { count: filtered.length, total: filteredTotal.toLocaleString("th-TH") })}
        </span>
      </div>

      {/* Bulk bar */}
      {isStaff && selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{t("bulk.selected", { count: selected.size })}</span>
          <Button size="sm" onClick={handleBulkPaid} disabled={bulkPending} className="h-7 gap-1.5 text-xs">
            <CheckSquare className="h-3.5 w-3.5" />
            {t("bulk.markPaid")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="h-7 text-xs">
            {t("bulk.deselect")}
          </Button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-md border py-12 text-center">
          <p className="text-sm font-medium">{t("filters.noResults")}</p>
          <p className="text-xs text-muted-foreground">{t("filters.noResultsDescription")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {isStaff && (
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      onChange={toggleAll}
                      aria-label="Select all pending"
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                  </th>
                )}
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t("table.date")}</th>
                {isStaff && <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t("table.agent")}</th>}
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t("table.case")}</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t("table.amount")}</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t("table.notes")}</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t("table.status")}</th>
                {isStaff && <th className="w-8 px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  {isStaff && (
                    <td className="px-3 py-2">
                      {p.status === "pending" && (
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleOne(p.id)}
                          aria-label="Select row"
                          className="h-4 w-4 cursor-pointer accent-primary"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{p.work_date}</td>
                  {isStaff && (
                    <td className="px-3 py-2 font-medium">{p.agents?.full_name ?? "—"}</td>
                  )}
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.cases?.case_number ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    ฿{Number(p.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.notes ?? "—"}</td>
                  <td className="px-3 py-2">
                    <PaymentStatusBadge status={p.status} paidByName={p.paid_by_name} />
                  </td>
                  {isStaff && (
                    <td className="px-3 py-2">
                      <PaymentRowActions
                        paymentId={p.id}
                        currentStatus={p.status}
                        currentAmount={Number(p.amount)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/20">
                {isStaff && <td />}
                <td colSpan={isStaff ? 3 : 2} className="px-3 py-2 text-xs text-muted-foreground font-medium">
                  {t("table.total")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  ฿{filteredTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={isStaff ? 3 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
