"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Lock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { closeCase } from "@/app/(dashboard)/cases/actions";
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
import { cn } from "@/lib/utils";

interface Props {
  caseId: string;
  caseNumber: string;
  clientName: string | null;
  timelineCount: number;
  evidenceCount: number;
  reportCount: number;
  hasApprovedReport: boolean;
  hasInvoice: boolean;
}

function CheckItem({
  label,
  done,
  notDoneLabel,
}: {
  label: string;
  done: boolean;
  notDoneLabel: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      )}
      <div className="min-w-0">
        <p className={cn("text-sm", done ? "text-foreground" : "text-muted-foreground")}>
          {label}
        </p>
        {!done && (
          <p className="text-xs text-amber-500/80">{notDoneLabel}</p>
        )}
      </div>
    </div>
  );
}

export function CloseCaseDialog({
  caseId,
  caseNumber,
  clientName,
  timelineCount,
  evidenceCount,
  reportCount,
  hasApprovedReport,
  hasInvoice,
}: Props) {
  const t = useTranslations("cases.detail.closeCase");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [endDate, setEndDate] = useState("");
  useEffect(() => { setEndDate(new Date().toISOString().split("T")[0]); }, []);

  function handleClose() {
    start(async () => {
      const res = await closeCase(caseId, endDate);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("success"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <Lock className="h-4 w-4" />
          {t("button")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-destructive" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {caseNumber} · {clientName ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Case summary */}
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            {t("summary", { timeline: timelineCount, evidence: evidenceCount, reports: reportCount })}
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("checklist")}
            </p>
            <CheckItem
              label={t("checkApprovedReport")}
              done={hasApprovedReport}
              notDoneLabel={t("checkNotDone")}
            />
            <CheckItem
              label={t("checkInvoice")}
              done={hasInvoice}
              notDoneLabel={t("checkNotDone")}
            />
          </div>

          {/* End date */}
          <div className="space-y-1.5">
            <Label htmlFor="end-date">{t("endDate")}</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Warning */}
          <p className="text-xs text-muted-foreground">
            {t("description")}
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={handleClose}
              className="gap-2"
            >
              <Lock className="h-4 w-4" />
              {t("confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
