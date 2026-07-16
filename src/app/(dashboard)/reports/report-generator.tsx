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
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateReport, generateRangeReport } from "@/app/(dashboard)/timeline/actions";
import type { ReportType, ReportPhoto, ReportBlock } from "@/app/(dashboard)/timeline/actions";
import { bangkokDateKey } from "@/lib/utils";

interface CaseOption {
  id: string;
  caseNumber: string;
  clientName: string | null;
}

interface Props {
  cases: CaseOption[];
}

type Mode = "single" | "range";

// Short, clickable label for a URL — long Google Maps links (esp. Thai queries
// that percent-encode into huge strings) become "📍 แผนที่"; other links show as-is.
function linkLabel(url: string) {
  return /google\.[a-z.]+\/maps/i.test(url) ? "📍 แผนที่" : url;
}

// Turn http(s) URLs in plain report text into clickable (shortened) links.
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-500 underline underline-offset-2 break-all">
        {linkLabel(part)}
      </a>
    ) : (
      part
    ),
  );
}

function todayBangkok() {
  return bangkokDateKey();
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

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const URL_RE = /(https?:\/\/[^\s)]+)/g;
const linkifyHtml = (escaped: string) => escaped.replace(URL_RE, (m) => `<a href="${m}">${linkLabel(m)}</a>`);

type PrintArgs =
  | { header: string; blocks: ReportBlock[]; footer: string } // per-entry layout (single date)
  | { text: string; photos: ReportPhoto[] };                   // flat layout (range / fallback)

function buildPrintBody(a: PrintArgs): string {
  if ("blocks" in a) {
    const head = a.header ? `<pre>${linkifyHtml(escapeHtml(a.header))}</pre>` : "";
    const body = a.blocks
      .map(
        (b) => `<section class="block">
  <p class="obs">${escapeHtml(b.text)}</p>
  ${b.photos.length ? `<div class="gallery">${b.photos.map((p) => `<figure><img src="${escapeHtml(p.url)}" loading="eager" /></figure>`).join("")}</div>` : ""}
  ${b.location ? `<p class="loc">📍 <a href="${escapeHtml(b.location.url)}">${escapeHtml(b.location.name)}</a></p>` : ""}
</section>`,
      )
      .join("");
    const foot = a.footer ? `<pre>${escapeHtml(a.footer)}</pre>` : "";
    return head + body + foot;
  }
  const gallery = a.photos.length
    ? `<h2 class="gallery-title">ภาพประกอบหลักฐาน / Evidence Photos (${a.photos.length})</h2>
       <div class="gallery">${a.photos.map((p) => `<figure><img src="${escapeHtml(p.url)}" loading="eager" /><figcaption>${escapeHtml(p.label)}</figcaption></figure>`).join("")}</div>`
    : "";
  return `<pre>${linkifyHtml(escapeHtml(a.text))}</pre>${gallery}`;
}

function printReport(title: string, args: PrintArgs) {
  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html><head>
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Sarabun', 'Courier New', monospace; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 13px; line-height: 1.8; color: #111; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0; }
  .block { margin: 14px 0; padding-top: 12px; border-top: 1px solid #e5e5e5; }
  .block .obs { white-space: pre-wrap; margin: 0 0 8px; }
  .block .loc { margin: 8px 0 0; font-size: 12px; }
  .gallery { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 8px 0; }
  .gallery figure { margin: 0; page-break-inside: avoid; break-inside: avoid; }
  .gallery img { width: 100%; height: auto; border: 1px solid #ccc; border-radius: 6px; }
  .gallery figcaption { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.4; }
  .gallery-title { font-size: 15px; margin: 28px 0 12px; padding-top: 16px; border-top: 1px solid #ccc; }
  a { color: #1a56db; }
  @media print { body { padding: 20px; } }
</style>
</head><body>${buildPrintBody(args)}
<script>
  // Wait for evidence images to load before opening the print dialog so they
  // aren't blank in the PDF; fall back after a timeout if some are slow.
  (function () {
    var imgs = Array.prototype.slice.call(document.images);
    var pending = imgs.filter(function (i) { return !i.complete; }).length;
    function go() { window.focus(); window.print(); }
    if (pending === 0) { go(); return; }
    var done = 0, fired = false;
    function tick() { if (!fired && ++done >= pending) { fired = true; go(); } }
    imgs.forEach(function (i) { if (!i.complete) { i.addEventListener('load', tick); i.addEventListener('error', tick); } });
    setTimeout(function () { if (!fired) { fired = true; go(); } }, 6000);
  })();
</script>
</body></html>`);
  win.document.close();
}

export function ReportGenerator({ cases }: Props) {
  const t = useTranslations("reports");

  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("single");
  const [date, setDate] = useState(todayBangkok());
  const [startDate, setStartDate] = useState(todayBangkok());
  const [endDate, setEndDate] = useState(todayBangkok());
  const [reportType, setReportType] = useState<ReportType>("thai_client");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportPhotos, setReportPhotos] = useState<ReportPhoto[]>([]);
  // Single-date reports come back as per-entry blocks (obs → photos → location);
  // range reports come back flat (reportText + reportPhotos gallery).
  const [reportBlocks, setReportBlocks] = useState<ReportBlock[]>([]);
  const [reportHeader, setReportHeader] = useState("");
  const [reportFooter, setReportFooter] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, startGenerate] = useTransition();

  const REPORT_TYPES: { value: ReportType; label: string }[] = [
    { value: "thai_client", label: t("typeThai") },
    { value: "english_client", label: t("typeEnglish") },
    { value: "internal", label: t("typeInternal") },
  ];

  const filtered = search.trim()
    ? cases.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
          (c.clientName ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : cases;

  const selectedCase = cases.find((c) => c.id === caseId);

  function handleGenerate() {
    if (!caseId) return;
    if (mode === "single" && !date) return;
    if (mode === "range" && (!startDate || !endDate)) return;
    if (mode === "range" && startDate > endDate) {
      toast.error(t("rangeError"));
      return;
    }

    startGenerate(async () => {
      const res =
        mode === "single"
          ? await generateReport(caseId, date, reportType)
          : await generateRangeReport(caseId, startDate, endDate, reportType);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const r = res as {
        report?: string; header?: string; blocks?: ReportBlock[]; footer?: string; photos?: ReportPhoto[];
      };
      setReportText(r.report ?? "");
      setReportBlocks(r.blocks ?? []);
      setReportHeader(r.header ?? "");
      setReportFooter(r.footer ?? "");
      setReportPhotos(r.photos ?? []);
      setCopied(false);
      setDialogOpen(true);
    });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const dateSuffix = mode === "single" ? date : `${startDate}_${endDate}`;
  const filename = `${selectedCase?.caseNumber ?? "report"}-${dateSuffix}-${reportType}.txt`;
  const dialogTitle = `${selectedCase?.caseNumber ?? ""} · ${
    mode === "single" ? date : `${startDate} – ${endDate}`
  }`;

  const disabled =
    generating ||
    !caseId ||
    (mode === "single" ? !date : !startDate || !endDate);

  return (
    <>
      <div className="space-y-6">
        {/* Case search + selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("case")}</label>
          {cases.length > 8 && (
            <input
              type="text"
              placeholder={t("caseSearchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("noCasesFound")}</p>
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

        {/* Mode toggle: single day vs date range */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              mode === "single"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            {t("modeSingle")}
          </button>
          <button
            type="button"
            onClick={() => setMode("range")}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              mode === "range"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            {t("modeRange")}
          </button>
        </div>

        {/* Date inputs */}
        {mode === "single" ? (
          <div className="space-y-2">
            <label htmlFor="report-date" className="text-sm font-medium">{t("date")}</label>
            <input
              id="report-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="start-date" className="text-sm font-medium">{t("startDate")}</label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="end-date" className="text-sm font-medium">{t("endDate")}</label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {/* Report type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("reportType")}</label>
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
          disabled={disabled}
          className="w-full gap-2"
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {t("generating")}</>
          ) : (
            <><FileText className="h-4 w-4" /> {t("generate")}</>
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
          <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-md bg-muted/50 p-4 font-mono text-xs leading-relaxed">
            {reportBlocks.length > 0 ? (
              <>
                {reportHeader && <pre className="whitespace-pre-wrap">{linkify(reportHeader)}</pre>}
                {reportBlocks.map((b, i) => (
                  <div key={i} className="border-t border-border/40 pt-3 first:border-0 first:pt-0">
                    <p className="whitespace-pre-wrap">{b.text}</p>
                    {b.photos.length > 0 && (
                      <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                        {b.photos.map((p, j) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={j} src={p.url} alt="" className="aspect-square w-full rounded object-cover" />
                        ))}
                      </div>
                    )}
                    {b.location && (
                      <a href={b.location.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-sky-500 hover:underline">
                        📍 {b.location.name}
                      </a>
                    )}
                  </div>
                ))}
                {reportFooter && <pre className="whitespace-pre-wrap">{reportFooter}</pre>}
              </>
            ) : (
              <>
                <pre className="whitespace-pre-wrap">{linkify(reportText)}</pre>
                {reportPhotos.length > 0 && (
                  <div className="rounded-md border border-border p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      ภาพประกอบหลักฐาน · {reportPhotos.length} รูป (จะฝังในรายงานเมื่อพิมพ์/บันทึก PDF)
                    </p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {reportPhotos.map((p, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={p.url} alt={p.label} title={p.label} className="aspect-square w-full rounded object-cover" />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                printReport(
                  dialogTitle,
                  reportBlocks.length > 0
                    ? { header: reportHeader, blocks: reportBlocks, footer: reportFooter }
                    : { text: reportText, photos: reportPhotos },
                )
              }
            >
              <Printer className="h-3.5 w-3.5" /> {t("print")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => downloadText(reportText, filename)}
            >
              <Download className="h-3.5 w-3.5" /> {t("downloadTxt")}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleCopy}>
              {copied ? (
                <><Check className="h-3.5 w-3.5 text-green-500" /> {t("copied")}</>
              ) : (
                <><Copy className="h-3.5 w-3.5" /> {t("copy")}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
