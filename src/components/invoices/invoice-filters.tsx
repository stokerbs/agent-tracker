"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { InvoiceStatus } from "@/lib/types";

const STATUSES: Array<InvoiceStatus | "all"> = ["all", "draft", "sent", "paid", "overdue"];

export function InvoiceFilters({ count }: { count: number }) {
  const t = useTranslations("invoices");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const status = (params.get("status") ?? "all") as InvoiceStatus | "all";

  function push(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  const hasFilters = q || status !== "all";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-8 text-sm"
          placeholder={t("filter.searchPlaceholder")}
          defaultValue={q}
          onChange={(e) => push({ q: e.target.value })}
        />
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => push({ status: s })}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              status === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {s === "all" ? t("filter.all") : t(`status.${s}`)}
          </button>
        ))}
      </div>

      {/* Clear + count */}
      <div className="ml-auto flex items-center gap-3">
        {hasFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            {t("filter.clear")}
          </button>
        )}
        <span className="text-xs text-muted-foreground">
          {t("filter.count", { count })}
        </span>
      </div>
    </div>
  );
}
