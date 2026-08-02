"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { importAirTagPingsCsv, type CsvImportResult } from "@/app/(dashboard)/air-tags/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { buildAirTagCsvTemplate, isCsvFileName } from "./air-tag-dialog-utils";

interface Props {
  airTagId: string;
}

function readFileAsText(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(f);
  });
}

function downloadCsvTemplate(fileName: string) {
  const blob = new Blob([buildAirTagCsvTemplate()], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * "Import CSV" dialog — bulk-imports manually-collected AirTag positions via
 * importAirTagPingsCsv. The `.csv` extension check and template download
 * below are UX conveniences only; the server re-parses and re-validates the
 * raw CSV text itself, never trusting a client-parsed row array
 * (Golden Rule 1/2 — see the doc comment on importAirTagPingsCsv).
 */
export function ImportCsvDialog({ airTagId }: Props) {
  const t = useTranslations("airTags.csv");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  function reset() {
    setFile(null);
    setFileError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setResult(null);
    if (f && !isCsvFileName(f.name)) {
      setFile(null);
      setFileError(t("errors.notCsv"));
      return;
    }
    setFile(f);
    setFileError(null);
  }

  function handleSubmit() {
    if (!file) {
      toast.error(t("noFile"));
      return;
    }
    start(async () => {
      try {
        const csvText = await readFileAsText(file);
        const res = await importAirTagPingsCsv({ airTagId, csvText });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setResult(res);
        if (res.insertedCount > 0) {
          toast.success(t("toast.success", { count: res.insertedCount }));
          router.refresh();
        } else {
          toast.error(t("toast.noneInserted"));
        }
      } catch {
        toast.error(t("errors.readFailed"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Upload className="h-4 w-4" />
          {t("trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4 text-sky-500" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => downloadCsvTemplate("air-tag-positions-template.csv")}
          >
            <Download className="h-3.5 w-3.5" />
            {t("templateButton")}
          </Button>
          <p className="text-[11px] text-muted-foreground">{t("templateHint")}</p>

          <div className="space-y-1.5">
            <Label htmlFor="csv-file">{t("fields.file")}</Label>
            <input
              ref={fileInputRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={pending}
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-accent"
            />
            {fileError && <p className="text-[11px] text-destructive">{fileError}</p>}
          </div>

          {/* Per-row results summary */}
          {result && result.ok && (
            <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("results.inserted", { count: result.insertedCount })}
                </span>
                {result.skippedRows.length > 0 && (
                  <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    {t("results.skipped", { count: result.skippedRows.length })}
                  </span>
                )}
              </div>

              {result.skippedRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("results.noSkips")}</p>
              ) : (
                <div className="max-h-48 overflow-auto rounded border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t("results.rowCol")}</TableHead>
                        <TableHead className="text-xs">{t("results.reasonCol")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.skippedRows.map((r, i) => (
                        <TableRow key={`${r.row}-${i}`} className="text-xs">
                          <TableCell className="font-mono">{r.row}</TableCell>
                          <TableCell className="text-muted-foreground">{r.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {tCommon("close")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending || !file}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
