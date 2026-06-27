"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ClipboardCheck, Clock, Check, X, Banknote, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { requestCase, type BoardCase } from "@/app/(dashboard)/cases/board-actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Agent-facing job board: browse open cases and request to claim them. */
export function BoardClaimList({ cases }: { cases: BoardCase[] }) {
  const t = useTranslations("board");
  const router = useRouter();
  const [pending, start] = useTransition();

  function claim(caseId: string) {
    start(async () => {
      const res = await requestCase(caseId);
      if (res && "error" in res) { toast.error(res.error); return; }
      toast.success(t("requestSent"));
      router.refresh();
    });
  }

  if (cases.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {cases.map((c) => {
        const pr = c.priority.toLowerCase();
        const prBorder =
          pr === "critical" || pr === "high" ? "border-l-destructive"
          : pr === "medium" ? "border-l-primary"
          : "border-l-muted-foreground/40";
        return (
          <Card key={c.id} className={cn("border-l-[3px] p-3.5", prBorder)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-primary">{c.case_number}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.case_type}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {t("slotsLeft", { remaining: c.remaining, slots: c.slots })}
              </span>
            </div>

            {(c.pay != null || c.startAt || c.duration || c.location) && (
              <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {c.pay != null && (
                  <span className="flex items-center gap-1.5 font-medium text-primary">
                    <Banknote className="h-3.5 w-3.5 shrink-0" />
                    {t("payValue", { pay: c.pay.toLocaleString("th-TH") })}
                  </span>
                )}
                {c.duration && (
                  <span className="flex items-center gap-1.5 text-foreground/80">
                    <Clock className="h-3.5 w-3.5 shrink-0" />{c.duration}
                  </span>
                )}
                {c.startAt && (
                  <span className="flex items-center gap-1.5 text-foreground/80">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {new Date(c.startAt).toLocaleString("th-TH", {
                      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
                    })}
                  </span>
                )}
                {c.location && (
                  <span className="col-span-2 flex items-center gap-1.5 text-foreground/80">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />{c.location}
                  </span>
                )}
              </div>
            )}

            <div className="mt-3">
              {c.myClaim === "pending" ? (
                <span className="flex items-center justify-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 py-2 text-xs font-medium text-warning">
                  <Clock className="h-3.5 w-3.5" /> {t("statusPending")}
                </span>
              ) : c.myClaim === "approved" ? (
                <Link
                  href={`/cases/${c.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-success/40 bg-success/10 py-2 text-xs font-medium text-success"
                >
                  <Check className="h-3.5 w-3.5" /> {t("statusApproved")}
                </Link>
              ) : c.myClaim === "rejected" ? (
                <span className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/40 py-2 text-xs font-medium text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> {t("statusRejected")}
                </span>
              ) : c.remaining <= 0 ? (
                <span className="flex items-center justify-center rounded-lg border border-border bg-secondary/40 py-2 text-xs font-medium text-muted-foreground">
                  {t("full")}
                </span>
              ) : (
                <Button
                  className="h-10 w-full gap-2 font-semibold uppercase tracking-wide"
                  onClick={() => claim(c.id)}
                  disabled={pending}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                  {t("claimButton")}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
