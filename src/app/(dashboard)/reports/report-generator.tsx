"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateReport } from "@/app/(dashboard)/timeline/actions";
import type { ReportType } from "@/app/(dashboard)/timeline/actions";

interface CaseOption {
  id: string;
  caseNumber: string;
  clientName: string | null;
}

interface Props {
  cases: CaseOption[];
}

function todayBangkok() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport(text: string, title: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html><head>
<title>${title}</title>
<style>
  body { font-family: 'Sarabun', 'Courier New', monospace; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 13px; line-height: 1.8; color: #111; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; }
  @media print { body { padding: 20px; } }
</style>
</head><body><pre>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`);
  win.document.close();
  win.print();
}

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "thai_client", label: "รายงาน TH" },
  { value: "english_client", label: "Report EN" },
  { value: "internal", label: "Internal" },
];

export function ReportGenerator({ cases }: Props) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [date, setDate] = useState(todayBangkok());
  const [reportType, setReportType] = useState<ReportType>("thai_client");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, startGenerate] = useTransition();

  const filtered = search.trim()
    ? cases.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
          (c.clientName ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : cases;

  const selectedCase = cases.find((c) => c.id === caseId);

  function handleGenerate() {
    if (!caseId || !date) return;
    startGenerate(async () => {
      const res = await generateReport(caseId, date, reportType);
      if (res.error) { toast.error(res.error); return; }
      setReportText(res.report ?? "");
      setCopied(false);
      setDialogOpen(true);
    });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filename = `${selectedCase?.caseNumber ?? "report"}-${date}-${reportType}.txt`;
  const dialogTitle = `${selectedCase?.caseNumber ?? ""} · ${date}`;

  return (
    <>
      <div className="space-y-6">
        {/* Case search + selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Case</label>
          {cases.length > 8 && (
            <input
              type="text"
              placeholder="Search by case number or client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">No cases found</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCaseId(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/40 ${
                    caseId === c.id ? "bg-primary/10 font-medium text-primary" : "text-foreground"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-mono">{c.caseNumber}</span>
                  {c.clientName && (
                    <span className="text-xs text-muted-foreground">{c.clientName}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <label htmlFor="report-date" className="text-sm font-medium">Date</label>
          <input
            id="report-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Report type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Report type</label>
          <div className="flex gap-2">
            {REPORT_TYPES.map((rt) => (
              <button
                key={rt.value}
                type="button"
                onClick={() => setReportType(rt.value)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  reportType === rt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate */}
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !caseId || !date}
          className="w-full gap-2"
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
          ) : (
            <><FileText className="h-4 w-4" /> Generate Report</>
          )}
        </Button>
      </div>

      {/* Result dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription className="sr-only">Generated surveillance report</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-4 font-mono text-xs leading-relaxed">
            {reportText}
          </pre>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => printReport(reportText, dialogTitle)}
            >
              <Printer className="h-3.5 w-3.5" /> PDF / Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => downloadText(reportText, filename)}
            >
              <Download className="h-3.5 w-3.5" /> Download TXT
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleCopy}>
              {copied ? (
                <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
              ) : (
                <><Copy className="h-3.5 w-3.5" /> Copy</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
