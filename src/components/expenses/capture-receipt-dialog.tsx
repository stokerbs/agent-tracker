"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileText,
  Images,
  Loader2,
  ScanLine,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  scanReceipt,
  saveOcrExpense,
  uploadReceiptPdf,
} from "@/app/(dashboard)/expenses/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ExpenseCategory, ExtractedExpense } from "@/lib/types";

const CATEGORIES: ExpenseCategory[] = [
  "fuel", "toll", "parking", "meals", "accommodation", "transportation", "office", "misc",
];

interface CaseOption {
  id: string;
  case_number: string;
}

interface Props {
  cases?: CaseOption[];
  caseId?: string;
}

interface ReviewState {
  receiptPath: string;
  previewUrl: string | null;
  isPdf: boolean;
  extracted: ExtractedExpense;
  vendor_name: string;
  category: ExpenseCategory;
  amount: string;
  vat_amount: string;
  expense_date: string;
  expense_time: string;
  receipt_number: string;
  notes: string;
  case_id: string;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 80
      ? "border-success/40 bg-success/10 text-success"
      : confidence >= 60
        ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
        : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", color)}>
      {confidence}% confidence
    </span>
  );
}

function emptyExtracted(): ExtractedExpense {
  return {
    vendor_name: null, category: "misc", amount: null, vat_amount: null,
    expense_date: null, expense_time: null, receipt_number: null, notes: null,
    confidence: 0,
    field_confidence: { vendor_name: 0, category: 0, amount: 0, vat_amount: 0, expense_date: 0, expense_time: 0, receipt_number: 0 },
  };
}

export function CaptureReceiptDialog({ cases = [], caseId = "" }: Props) {
  const t = useTranslations("expenses.capture");
  const tCat = useTranslations("expenses.categories");
  const router = useRouter();

  // Three separate hidden file inputs for Take Photo / Gallery / PDF
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [saving, startSave] = useTransition();

  function todayBangkok() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  }

  function reset() {
    setReview(null);
    setScanning(false);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    if (pdfRef.current) pdfRef.current.value = "";
  }

  function buildReview(
    receiptPath: string,
    previewUrl: string | null,
    isPdf: boolean,
    extracted: ExtractedExpense,
  ): ReviewState {
    return {
      receiptPath, previewUrl, isPdf, extracted,
      vendor_name: extracted.vendor_name ?? "",
      category: extracted.category,
      amount: extracted.amount != null ? String(extracted.amount) : "",
      vat_amount: extracted.vat_amount != null ? String(extracted.vat_amount) : "",
      expense_date: extracted.expense_date ?? todayBangkok(),
      expense_time: extracted.expense_time ?? "",
      receipt_number: extracted.receipt_number ?? "",
      notes: extracted.notes ?? "",
      case_id: caseId,
    };
  }

  async function handleImageFile(file: File) {
    setScanning(true);
    const fd = new FormData();
    fd.append("receipt", file);
    const res = await scanReceipt(fd);
    setScanning(false);

    if ("error" in res) {
      toast.error(t("toast.scanError"));
      if (res.receiptPath) {
        setReview(buildReview(res.receiptPath, URL.createObjectURL(file), false, emptyExtracted()));
      }
      return;
    }
    setReview(buildReview(res.receiptPath, URL.createObjectURL(file), false, res.extracted));
  }

  async function handlePdfFile(file: File) {
    setScanning(true);
    const fd = new FormData();
    fd.append("receipt", file);
    const res = await uploadReceiptPdf(fd);
    setScanning(false);

    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    // PDF: no OCR — go directly to manual review with today's date pre-filled
    setReview(buildReview(res.receiptPath, null, true, emptyExtracted()));
  }

  function handleSave() {
    if (!review) return;
    const amount = parseFloat(review.amount);
    if (!amount || isNaN(amount)) { toast.error("Amount is required"); return; }
    if (!review.expense_date) { toast.error("Date is required"); return; }

    startSave(async () => {
      const res = await saveOcrExpense({
        receiptPath: review.receiptPath,
        caseId: review.case_id || null,
        category: review.category,
        amount,
        expenseDate: review.expense_date,
        expenseTime: review.expense_time || null,
        vendorName: review.vendor_name || null,
        vatAmount: review.vat_amount ? parseFloat(review.vat_amount) : null,
        receiptNumber: review.receipt_number || null,
        notes: review.notes || null,
        ocrConfidence: review.extracted.confidence || null,
        ocrRaw: review.isPdf ? null : review.extracted,
      });
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("toast.success"));
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  const confidence = review?.extracted.confidence ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ScanLine className="h-4 w-4" />
          {t("button")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-muted-foreground" />
            {review ? t("reviewTitle") : t("title")}
          </DialogTitle>
        </DialogHeader>

        {/* Hidden file inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
        />
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfFile(f); }}
        />

        {/* ── Step 1: Upload ── */}
        {!review && (
          <div className="px-5 pb-5">
            {scanning ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">{t("analyzing")}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {/* Take Photo */}
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-4 rounded-lg border border-border px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
                >
                  <Camera className="h-8 w-8 shrink-0 text-muted-foreground/60" />
                  <div>
                    <p className="text-sm font-medium">{t("takePhoto")}</p>
                    <p className="text-xs text-muted-foreground">{t("takePhotoHint")}</p>
                  </div>
                </button>

                {/* Choose from Gallery */}
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="flex items-center gap-4 rounded-lg border border-border px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
                >
                  <Images className="h-8 w-8 shrink-0 text-muted-foreground/60" />
                  <div>
                    <p className="text-sm font-medium">{t("chooseGallery")}</p>
                    <p className="text-xs text-muted-foreground">{t("chooseGalleryHint")}</p>
                  </div>
                </button>

                {/* Upload PDF */}
                <button
                  type="button"
                  onClick={() => pdfRef.current?.click()}
                  className="flex items-center gap-4 rounded-lg border border-border px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
                >
                  <FileText className="h-8 w-8 shrink-0 text-muted-foreground/60" />
                  <div>
                    <p className="text-sm font-medium">{t("uploadPdf")}</p>
                    <p className="text-xs text-muted-foreground">{t("uploadPdfHint")}</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {review && (
          <div className="overflow-y-auto px-5 pb-5" style={{ maxHeight: "75vh" }}>
            {/* Confidence / PDF banner */}
            <div className="mb-4 flex items-center justify-between gap-2">
              {review.isPdf ? (
                <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" /> PDF — enter details manually
                </span>
              ) : (
                <ConfidenceBadge confidence={confidence} />
              )}
              {!review.isPdf && confidence > 0 && confidence < 80 && (
                <span className="flex items-center gap-1 text-xs text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {confidence < 60 ? t("confidenceLow") : t("confidenceMed")}
                </span>
              )}
              {!review.isPdf && confidence >= 80 && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Looks good — verify before saving
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Receipt preview */}
              {review.previewUrl && !review.isPdf && (
                <div className="sm:col-span-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={review.previewUrl}
                    alt="Receipt"
                    className="max-h-40 w-full rounded-lg border border-border bg-muted/30 object-contain"
                  />
                </div>
              )}

              {/* Vendor */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("vendorLabel")}</Label>
                <Input
                  value={review.vendor_name}
                  onChange={(e) => setReview((r) => r && { ...r, vendor_name: e.target.value })}
                  placeholder="e.g. PTT, Grab, Central Food"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={review.category}
                  onValueChange={(v) => setReview((r) => r && { ...r, category: v as ExpenseCategory })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{tCat(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label>Amount (THB)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={review.amount}
                  onChange={(e) => setReview((r) => r && { ...r, amount: e.target.value })}
                />
              </div>

              {/* VAT */}
              <div className="space-y-1.5">
                <Label>{t("vatLabel")}</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={review.vat_amount}
                  onChange={(e) => setReview((r) => r && { ...r, vat_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              {/* Receipt number */}
              <div className="space-y-1.5">
                <Label>{t("receiptNoLabel")}</Label>
                <Input
                  value={review.receipt_number}
                  onChange={(e) => setReview((r) => r && { ...r, receipt_number: e.target.value })}
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={review.expense_date}
                  onChange={(e) => setReview((r) => r && { ...r, expense_date: e.target.value })}
                />
              </div>

              {/* Time */}
              <div className="space-y-1.5">
                <Label>{t("timeLabel")}</Label>
                <Input
                  type="time"
                  value={review.expense_time}
                  onChange={(e) => setReview((r) => r && { ...r, expense_time: e.target.value })}
                />
              </div>

              {/* Case (optional) */}
              {cases.length > 0 && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t("caseLabel")}</Label>
                  <Select
                    value={review.case_id || "none"}
                    onValueChange={(v) => setReview((r) => r && { ...r, case_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("casePlaceholder")}</SelectItem>
                      {cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.case_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Notes</Label>
                <Input
                  value={review.notes}
                  onChange={(e) => setReview((r) => r && { ...r, notes: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("saveButton")}
              </Button>
              <Button variant="outline" onClick={() => reset()} disabled={saving} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                {t("scanAnother")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
