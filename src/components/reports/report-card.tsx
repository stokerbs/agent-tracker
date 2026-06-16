"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { approveReport } from "@/app/(dashboard)/reports/actions";
import { exportReportDocx, exportReportPdf } from "@/lib/export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatDate } from "@/lib/utils";
import type { Case, Report } from "@/lib/types";

const STATUS_META: Record<
  Report["status"],
  { badge: string; label: string }
> = {
  draft:     { badge: "bg-slate-500/10 text-slate-400 border-slate-500/20",   label: "DRAFT" },
  submitted: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",   label: "REVIEW" },
  approved:  { badge: "bg-success/10 text-success border-success/20",         label: "APPROVED" },
  rejected:  { badge: "bg-destructive/10 text-destructive border-destructive/20", label: "REJECTED" },
};

export function ReportCard({
  report,
  caseRecord,
  subjectName,
  canApprove,
}: {
  report: Report;
  caseRecord?: Case | null;
  subjectName?: string | null;
  canApprove: boolean;
}) {
  const t = useTranslations("reports");
  const [expanded, setExpanded] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const statusMeta = STATUS_META[report.status];

  const exportRef = caseRecord
    ? {
        case_number: caseRecord.case_number,
        client_name: caseRecord.client_name,
        case_type: caseRecord.case_type,
        target_name: subjectName ?? null,
      }
    : undefined;

  function approve(clientVisible: boolean) {
    start(async () => {
      const res = await approveReport(report.id, clientVisible);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.approved"));
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card transition-colors hover:border-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">{report.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("generated", { date: formatDate(report.created_at) })}
              {report.approved_at && ` · Approved ${formatDate(report.approved_at)}`}
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            "shrink-0 border text-[9px] font-bold uppercase tracking-widest",
            statusMeta.badge,
          )}
        >
          {statusMeta.label}
        </Badge>
      </div>

      {/* Summary */}
      {report.executive_summary && (
        <p className="mt-3 px-5 text-sm leading-relaxed text-muted-foreground line-clamp-2">
          {report.executive_summary}
        </p>
      )}

      {/* Expanded full report */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-5 mt-4 space-y-4 rounded-lg border border-border/50 bg-muted/30 p-4 text-sm">
              <Section title={t("sections.chronological")} body={report.body} chrono />
              <Section title={t("sections.observations")} body={report.observations} />
              <Section title={t("sections.conclusion")} body={report.conclusion} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((e) => !e)}
          className="h-7 gap-1.5 text-xs"
        >
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
          {expanded ? t("hide") : t("viewFull")}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> {t("exportLabel")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => exportReportPdf({ report, caseRecord: exportRef })}>
              {t("downloadPdf")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportReportDocx({ report, caseRecord: exportRef })}>
              {t("downloadDocx")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {canApprove && report.status !== "approved" && (
          <Button
            variant="success"
            size="sm"
            onClick={() => approve(true)}
            disabled={pending}
            className="h-7 gap-1.5 text-xs"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {t("approveButton")}
          </Button>
        )}

        {report.status === "approved" && report.is_client_visible && (
          <div className="flex items-center gap-1 text-xs text-success">
            <Shield className="h-3 w-3" />
            {t("visibleToClient")}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  body,
  chrono,
}: {
  title: string;
  body: string | null;
  chrono?: boolean;
}) {
  let text = body ?? "";
  if (chrono && body) {
    text =
      body.split("2. CHRONOLOGICAL SURVEILLANCE REPORT")[1]
        ?.split("3. OBSERVATIONS")[0]
        ?.trim() ?? body;
  }
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
        {text || "—"}
      </p>
    </div>
  );
}
