"use client";

import { useTranslations } from "next-intl";
import type { PayrollStatus } from "@/lib/types";

const STATUS_STYLES: Record<PayrollStatus, string> = {
  pending:   "border-amber-500/40 bg-amber-500/10 text-amber-500",
  paid:      "border-green-500/40 bg-green-500/10 text-green-500",
  cancelled: "border-red-500/40 bg-red-500/10 text-red-500",
  adjusted:  "border-blue-500/40 bg-blue-500/10 text-blue-500",
};

interface Props {
  status: PayrollStatus;
  paidByName?: string | null;
}

export function PaymentStatusBadge({ status, paidByName }: Props) {
  const t = useTranslations("payroll");
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status]}`}>
        {t(`status.${status}` as any)}
      </span>
      {status === "paid" && paidByName && (
        <span className="text-[10px] text-muted-foreground">
          {t("actions.paidBy", { name: paidByName })}
        </span>
      )}
    </div>
  );
}
