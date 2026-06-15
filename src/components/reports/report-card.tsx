"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { approveReport } from "@/app/(dashboard)/reports/actions";
import { exportReportDocx, exportReportPdf } from "@/lib/export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import type { Case, Report } from "@/lib/types";

const STATUS_BADGE: Record<Report["status"], string> = {
  draft: "bg-slate-500/15 text-slate-500",
  submitted: "bg-amber-500/15 text-amber-600",
  approved: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-red-500/15 text-red-600",
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
  const [expanded, setExpanded] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const exportRef = caseRecord
    ? { case_number: caseRecord.case_number, client_name: caseRecord.client_name, case_type: caseRecord.case_type, target_name: subjectName ?? null }
    : undefined;

  function approve(clientVisible: boolean) {
    start(async () => {
      const res = await approveReport(report.id, clientVisible);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Report approved");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> {report.title}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Generated {formatDate(report.created_at)}
          </p>
        </div>
        <Badge className={`border-transparent ${STATUS_BADGE[report.status]}`}>
          {report.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {report.executive_summary}
        </p>

        {expanded && (
          <div className="space-y-3 rounded-lg bg-muted/40 p-4 text-sm">
            <Section title="Chronological Report" body={report.body} chrono />
            <Section title="Observations" body={report.observations} />
            <Section title="Conclusion" body={report.conclusion} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Hide" : "View full report"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportReportPdf({ report, caseRecord: exportRef })}>
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportReportDocx({ report, caseRecord: exportRef })}>
                Download DOCX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canApprove && report.status !== "approved" && (
            <Button
              variant="success"
              size="sm"
              onClick={() => approve(true)}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve & publish
            </Button>
          )}
          {report.status === "approved" && report.is_client_visible && (
            <Badge variant="secondary">Visible to client</Badge>
          )}
        </div>
      </CardContent>
    </Card>
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
      body.split("2. CHRONOLOGICAL SURVEILLANCE REPORT")[1]?.split("3. OBSERVATIONS")[0]?.trim() ??
      body;
  }
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 whitespace-pre-line text-muted-foreground">{text || "—"}</p>
    </div>
  );
}
