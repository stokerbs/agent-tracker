"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Copy,
  Check,
  Loader2,
  MapPin,
  Printer,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TimelineEntryCard } from "@/components/cases/timeline-entry-card";
import { TimelineEvidenceGallery } from "@/components/timeline/timeline-evidence-gallery";
import { ObservationUploader } from "@/components/timeline/observation-uploader";
import { generateReport } from "@/app/(dashboard)/timeline/actions";
import type { ReportType } from "@/app/(dashboard)/timeline/actions";
import type { TimelineEntry } from "@/lib/types";

type EntryFull = TimelineEntry & {
  agents: { full_name: string; agent_code: string } | null;
  cases: { case_number: string } | null;
};
type DateGroup = { date: string; entries: EntryFull[] };
type CaseGroup = { caseId: string; caseNumber: string; dates: DateGroup[] };

interface Props {
  caseGroups: CaseGroup[];
  canEdit: boolean;
  isAdmin: boolean;
}

function fmtDate(dateStr: string, locale: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(
    locale === "th" ? "th-TH" : "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" },
  );
}

function entryCount(n: number, t: ReturnType<typeof useTranslations<"timeline.section">>) {
  return n === 1 ? t("entry") : t("entries", { count: n });
}

interface SummaryState {
  open: boolean;
  text: string;
  title: string;
  copied: boolean;
}

export function TimelineClient({ caseGroups, canEdit, isAdmin }: Props) {
  const t = useTranslations("timeline");
  const ts = useTranslations("timeline.section");
  const tai = useTranslations("timeline.ai");
  const locale = useLocale();

  const [collapsedCases, setCollapsedCases] = useState<Record<string, boolean>>({});
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [summaryState, setSummaryState] = useState<SummaryState>({ open: false, text: "", title: "", copied: false });
  const [summaryLoading, setSummaryLoading] = useState<string | null>(null); // `${caseId}::${date}::${format}`
  const [, startSummary] = useTransition();

  function toggleCase(caseId: string) {
    setCollapsedCases((prev) => ({ ...prev, [caseId]: !prev[caseId] }));
  }

  function toggleDate(key: string) {
    setCollapsedDates((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function downloadAsText(text: string, filename: string) {
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

  async function handleGenerateReport(caseId: string, date: string, reportType: ReportType) {
    const key = `${caseId}::${date}::${reportType}`;
    setSummaryLoading(key);
    startSummary(async () => {
      const res = await generateReport(caseId, date, reportType);
      setSummaryLoading(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const title = tai("reportTitle");
      setSummaryState({ open: true, text: res.report ?? "", title, copied: false });
    });
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setSummaryState((s) => ({ ...s, copied: true }));
    setTimeout(() => setSummaryState((s) => ({ ...s, copied: false })), 2000);
  }

  function isReportLoading(caseId: string, date: string, reportType: ReportType) {
    return summaryLoading === `${caseId}::${date}::${reportType}`;
  }

  return (
    <>
      <div className="space-y-4">
        {caseGroups.map((cg) => {
          const caseCollapsed = !!collapsedCases[cg.caseId];
          const totalCaseEntries = cg.dates.reduce((s, dg) => s + dg.entries.length, 0);

          return (
            <div key={cg.caseId} className="rounded-lg border bg-card">
              {/* Case header */}
              <button
                type="button"
                onClick={() => toggleCase(cg.caseId)}
                className="flex min-h-[52px] w-full items-center gap-2 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                {caseCollapsed ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="font-mono text-sm font-bold">{cg.caseNumber}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {entryCount(totalCaseEntries, ts)}
                </span>
              </button>

              {/* Case body */}
              {!caseCollapsed && (
                <div className="px-4 pb-4">
                  <div className="space-y-4">
                    {cg.dates.map((dg) => {
                      const dateKey = `${cg.caseId}::${dg.date}`;
                      const dateCollapsed = !!collapsedDates[dateKey];

                      return (
                        <div key={dg.date}>
                          {/* Date header — sticky on scroll */}
                          <div className="sticky top-0 z-10 mb-3 flex min-h-[44px] items-center gap-2 bg-background/95 backdrop-blur-sm">
                            <button
                              type="button"
                              onClick={() => toggleDate(dateKey)}
                              className="flex min-h-[44px] items-center gap-1.5 rounded px-1 text-left transition-colors hover:text-foreground"
                            >
                              {dateCollapsed ? (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                {fmtDate(dg.date, locale)}
                              </span>
                              <span className="text-xs text-muted-foreground/60">
                                {entryCount(dg.entries.length, ts)}
                              </span>
                            </button>

                            <div className="h-px flex-1 bg-border/40" />

                            {/* Thai Client Report button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                              onClick={() => handleGenerateReport(cg.caseId, dg.date, "thai_client")}
                              disabled={!!summaryLoading}
                            >
                              {isReportLoading(cg.caseId, dg.date, "thai_client") ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileText className="h-3 w-3" />
                              )}
                              {isReportLoading(cg.caseId, dg.date, "thai_client") ? tai("generating") : "รายงานลูกค้า TH"}
                            </Button>

                            {/* English Client Report button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                              onClick={() => handleGenerateReport(cg.caseId, dg.date, "english_client")}
                              disabled={!!summaryLoading}
                            >
                              {isReportLoading(cg.caseId, dg.date, "english_client") ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileText className="h-3 w-3" />
                              )}
                              {isReportLoading(cg.caseId, dg.date, "english_client") ? tai("generating") : "Client Report EN"}
                            </Button>

                            {/* Internal Report button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                              onClick={() => handleGenerateReport(cg.caseId, dg.date, "internal")}
                              disabled={!!summaryLoading}
                            >
                              {isReportLoading(cg.caseId, dg.date, "internal") ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileText className="h-3 w-3" />
                              )}
                              {isReportLoading(cg.caseId, dg.date, "internal") ? tai("generating") : "Internal Report"}
                            </Button>
                          </div>

                          {/* Date entries */}
                          {!dateCollapsed && (
                            <div className="relative pl-5">
                              <div className="absolute inset-y-0 left-[7px] w-px bg-border/50" />

                              <div className="space-y-0">
                                {dg.entries.map((e) => (
                                  <div key={e.id} className="group relative flex gap-4 pb-4 last:pb-0">
                                    {/* Timeline node */}
                                    <div className="absolute -left-[13px] mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
                                      <div className="h-2 w-2 rounded-full border-2 border-border bg-card ring-4 ring-background transition-colors group-hover:border-primary group-hover:bg-primary/20" />
                                    </div>

                                    {/* Time badge */}
                                    <span className="mt-3 shrink-0 font-mono text-xs text-muted-foreground/70">
                                      {e.entry_time?.slice(0, 5)}
                                    </span>

                                    {canEdit ? (
                                      <TimelineEntryCard
                                        entry={e}
                                        canEdit
                                        isAdmin={isAdmin}
                                        linkedEvidence={e.linked_evidence}
                                      />
                                    ) : (
                                      <div className="flex-1 rounded-lg border border-border/50 bg-card p-3 transition-colors hover:border-border">
                                        <p className="text-sm leading-snug text-foreground/90">
                                          {e.entry}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                          {e.agents?.full_name && (
                                            <span>{e.agents.full_name}</span>
                                          )}
                                          {e.location && (
                                            <span className="flex items-center gap-1">
                                              <MapPin className="h-3 w-3" />
                                              {e.location}
                                            </span>
                                          )}
                                        </div>
                                        {e.linked_evidence && e.linked_evidence.length > 0 && (
                                          <TimelineEvidenceGallery items={e.linked_evidence} />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Add observation — shown if canEdit */}
                              {canEdit && (
                                <div className="mt-4">
                                  <ObservationUploader caseId={cg.caseId} defaultDate={dg.date} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add observation for a new date */}
                    {canEdit && cg.dates.length === 0 && (
                      <ObservationUploader caseId={cg.caseId} />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Daily Summary Dialog */}
      <Dialog
        open={summaryState.open}
        onOpenChange={(open) => setSummaryState((s) => ({ ...s, open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{summaryState.title || tai("reportTitle")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("description")}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-4 font-mono text-xs leading-relaxed">
            {summaryState.text}
          </pre>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => printReport(summaryState.text, summaryState.title)}
            >
              <Printer className="h-3.5 w-3.5" />
              PDF / Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => downloadAsText(summaryState.text, `${summaryState.title}.txt`)}
            >
              <Download className="h-3.5 w-3.5" />
              Download TXT
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => handleCopy(summaryState.text)}
            >
              {summaryState.copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {summaryState.copied ? tai("copied") : tai("copy")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
