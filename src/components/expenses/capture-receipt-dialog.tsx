"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  ScanLine,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { scanReceipt, saveOcrExpense } from "@/app/(dashboard)/expenses/actions";
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
  previewUrl: string;
  extracted: ExtractedExpense;
  // user-editable fields
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

export function CaptureReceiptDialog({ cases = [], caseId = "" }: Props) {
  const t = useTranslations("expenses.capture");
  const tCat = useTranslations("expenses.categories");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
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
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setScanning(true);
    const fd = new FormData();
    fd.append("receipt", file);
    const res = await scanReceipt(fd);
    setScanning(false);

    if ("error" in res) {
      toast.error(t("toast.scanError"));
      // Keep the uploaded path if available so user can still proceed manually
      if (res.receiptPath) {
        setReview({
          receiptPath: res.receiptPath,
          previewUrl: URL.createObjectURL(file),
          extracted: {
            vendor_name: null, category: "misc", amount: null, vat_amount: null,
            expense_date: null, expense_time: null, receipt_number: null, notes: null,
            confidence: 0,
            field_confidence: { vendor_name: 0, category: 0, amount: 0, vat_amount: 0, expense_date: 0, expense_time: 0, receipt_number: 0 },
          },
          vendor_name: "", category: "misc", amount: "",
          vat_amount: "", expense_date: todayBangkok(), expense_time: "",
          receipt_number: "", notes: "", case_id: caseId,
        });
      }
      return;
    }

    const e = res.extracted;
    setReview({
      receiptPath: res.receiptPath,
      previewUrl: URL.createObjectURL(file),
      extracted: e,
      vendor_name: e.vendor_name ?? "",
      category: e.category,
      amount: e.amount != null ? String(e.amount) : "",
      vat_amount: e.vat_amount != null ? String(e.vat_amount) : "",
      expense_date: e.expense_date ?? todayBangkok(),
      expense_time: e.expense_time ?? "",
      receipt_number: e.receipt_number ?? "",
      notes: e.notes ?? "",
      case_id: caseId,
    });
  }

  function handleSave() {
    if (!review) return;
    const amount = parseFloat(review.amount);
    if (!amount || isNaN(amount)) {
      toast.error("Amount is required");
      return;
    }
    if (!review.expense_date) {
      toast.error("Date is required");
      return;
    }
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
        ocrRaw: review.extracted,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
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

        {/* ── Step 1: Upload ── */}
        {!review && (
          <div className="px-5 pb-5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            {scanning ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">{t("analyzing")}</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border py-12 text-center transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <Camera className="h-10 w-10 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">{t("dropzoneLabel")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("dropzoneHint")}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
                  {t("analyzeButton")}
                </span>
              </button>
            )}
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {review && (
          <div className="overflow-y-auto px-5 pb-5" style={{ maxHeight: "75vh" }}>
            {/* Confidence banner */}
            <div className="mb-4 flex items-center justify-between">
              <ConfidenceBadge confidence={confidence} />
              {confidence > 0 && confidence < 80 && (
                <span className="flex items-center gap-1 text-xs text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {confidence < 60 ? t("confidenceLow") : t("confidenceMed")}
                </span>
              )}
              {confidence >= 80 && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Looks good — verify before saving
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Receipt thumbnail */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="sm:col-span-2">
                <img
                  src={review.previewUrl}
                  alt="Receipt"
                  className="max-h-40 w-full rounded-lg border border-border object-contain bg-muted/30"
                />
              </div>

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
                  type="number"
                  step="0.01"
                  min="0"
                  value={review.amount}
                  onChange={(e) => setReview((r) => r && { ...r, amount: e.target.value })}
                />
              </div>

              {/* VAT */}
              <div className="space-y-1.5">
                <Label>{t("vatLabel")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
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
              <Button
                variant="outline"
                onClick={() => reset()}
                disabled={saving}
                className="gap-1.5"
              >
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
