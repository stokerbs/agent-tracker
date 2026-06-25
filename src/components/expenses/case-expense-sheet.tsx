"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Images,
  Loader2,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  addExpense,
  saveOcrExpense,
  scanReceipt,
  uploadReceiptPdf,
} from "@/app/(dashboard)/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { bangkokDateKey, cn } from "@/lib/utils";
import type { ExpenseCategory, ExtractedExpense } from "@/lib/types";

const CATEGORIES: ExpenseCategory[] = [
  "fuel",
  "toll",
  "parking",
  "meals",
  "accommodation",
  "transportation",
  "office",
  "misc",
];

type Step = "menu" | "scanning" | "review" | "manual";

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
}

function emptyExtracted(): ExtractedExpense {
  return {
    vendor_name: null,
    category: "misc",
    amount: null,
    vat_amount: null,
    expense_date: null,
    expense_time: null,
    receipt_number: null,
    notes: null,
    confidence: 0,
    field_confidence: {
      vendor_name: 0,
      category: 0,
      amount: 0,
      vat_amount: 0,
      expense_date: 0,
      expense_time: 0,
      receipt_number: 0,
    },
  };
}

function todayBkk() {
  return bangkokDateKey();
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const t = useTranslations("expenses.capture");
  const color =
    confidence >= 80
      ? "border-success/40 bg-success/10 text-success"
      : confidence >= 60
        ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
        : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", color)}>
      {t("confidencePct", { confidence })}
    </span>
  );
}

function OptionTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 active:bg-muted/50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

export function CaseExpenseSheet({ caseId }: { caseId: string }) {
  const t = useTranslations("expenses.capture");
  const tCat = useTranslations("expenses.categories");
  const tDialog = useTranslations("expenses.dialog");
  const tExpenses = useTranslations("expenses");
  const router = useRouter();

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [review, setReview] = useState<ReviewState | null>(null);
  const [saving, startSave] = useTransition();
  const [manualDate, setManualDate] = useState("");

  useEffect(() => {
    setManualDate(todayBkk());
  }, []);

  // FAB integration — shared with AddExpenseDialog so agents can trigger from tab bar
  useEffect(() => {
    function onFab(e: Event) {
      if ((e as CustomEvent<{ tab: string }>).detail?.tab === "expenses") {
        setOpen(true);
      }
    }
    document.addEventListener("case:fab", onFab);
    return () => document.removeEventListener("case:fab", onFab);
  }, []);

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) reset();
  }

  function reset() {
    setStep("menu");
    setReview(null);
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
      receiptPath,
      previewUrl,
      isPdf,
      extracted,
      vendor_name: extracted.vendor_name ?? "",
      category: extracted.category,
      amount: extracted.amount != null ? String(extracted.amount) : "",
      vat_amount: extracted.vat_amount != null ? String(extracted.vat_amount) : "",
      expense_date: extracted.expense_date ?? todayBkk(),
      expense_time: extracted.expense_time ?? "",
      receipt_number: extracted.receipt_number ?? "",
      notes: extracted.notes ?? "",
    };
  }

  async function handleImageFile(file: File) {
    setStep("scanning");
    const fd = new FormData();
    fd.append("receipt", file);
    const res = await scanReceipt(fd);

    if ("error" in res) {
      toast.error(t("toast.scanError"));
      if (res.receiptPath) {
        setReview(buildReview(res.receiptPath, URL.createObjectURL(file), false, emptyExtracted()));
        setStep("review");
      } else {
        setStep("menu");
      }
      return;
    }
    setReview(buildReview(res.receiptPath, URL.createObjectURL(file), false, res.extracted));
    setStep("review");
  }

  async function handlePdfFile(file: File) {
    setStep("scanning");
    const fd = new FormData();
    fd.append("receipt", file);
    const res = await uploadReceiptPdf(fd);

    if ("error" in res) {
      toast.error(res.error);
      setStep("menu");
      return;
    }
    setReview(buildReview(res.receiptPath, null, true, emptyExtracted()));
    setStep("review");
  }

  function handleSaveReview() {
    if (!review) return;
    const amount = parseFloat(review.amount);
    if (!amount || isNaN(amount)) {
      toast.error(t("amountRequired"));
      return;
    }
    if (!review.expense_date) {
      toast.error(t("dateRequired"));
      return;
    }
    startSave(async () => {
      const res = await saveOcrExpense({
        receiptPath: review.receiptPath,
        caseId,
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

  function handleSaveManual(formData: FormData) {
    formData.set("case_id", caseId);
    startSave(async () => {
      const res = await addExpense(formData);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(tDialog("toast.success"));
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  const confidence = review?.extracted.confidence ?? 0;
  const sheetTitle =
    step === "review"
      ? t("reviewTitle")
      : step === "manual"
        ? t("manualEntry")
        : tExpenses("addExpense");

  return (
    <>
      {/* Hidden file inputs — must live outside the Sheet to survive re-renders */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageFile(f);
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageFile(f);
        }}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handlePdfFile(f);
        }}
      />

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <Button className="h-9 gap-2">
            <Plus className="h-4 w-4" />
            {tExpenses("addExpense")}
          </Button>
        </SheetTrigger>

        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2 pr-8">
              {(step === "review" || step === "manual") && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <SheetTitle>{sheetTitle}</SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 pb-10">
            {/* ── Menu ── */}
            {step === "menu" && (
              <div className="grid gap-3 pt-1">
                <OptionTile
                  icon={<Camera className="h-5 w-5" />}
                  title={t("takePhoto")}
                  description={t("takePhotoHint")}
                  onClick={() => cameraRef.current?.click()}
                />
                <OptionTile
                  icon={<Images className="h-5 w-5" />}
                  title={t("chooseGallery")}
                  description={t("chooseGalleryHint")}
                  onClick={() => galleryRef.current?.click()}
                />
                <OptionTile
                  icon={<Pencil className="h-5 w-5" />}
                  title={t("manualEntry")}
                  description={t("manualEntryHint")}
                  onClick={() => setStep("manual")}
                />
              </div>
            )}

            {/* ── Scanning ── */}
            {step === "scanning" && (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">{t("analyzing")}</p>
              </div>
            )}

            {/* ── Review (OCR result) ── */}
            {step === "review" && review && (
              <div className="space-y-4 pt-2">
                {/* Confidence banner */}
                <div className="flex items-center justify-between gap-2">
                  {review.isPdf ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" /> {t("pdfManual")}
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
                      {t("confidenceHigh")}
                    </span>
                  )}
                </div>

                {/* Receipt thumbnail */}
                {review.previewUrl && !review.isPdf && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={review.previewUrl}
                    alt="Receipt"
                    className="max-h-44 w-full rounded-xl border border-border bg-muted/30 object-contain"
                  />
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{t("vendorLabel")}</Label>
                    <Input
                      value={review.vendor_name}
                      onChange={(e) =>
                        setReview((r) => r && { ...r, vendor_name: e.target.value })
                      }
                      placeholder={t("vendorPlaceholder")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{tDialog("categoryLabel")}</Label>
                    <Select
                      value={review.category}
                      onValueChange={(v) =>
                        setReview((r) => r && { ...r, category: v as ExpenseCategory })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {tCat(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{tDialog("amountLabel")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={review.amount}
                      onChange={(e) =>
                        setReview((r) => r && { ...r, amount: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t("vatLabel")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={review.vat_amount}
                      onChange={(e) =>
                        setReview((r) => r && { ...r, vat_amount: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{tDialog("dateLabel")}</Label>
                    <Input
                      type="date"
                      value={review.expense_date}
                      onChange={(e) =>
                        setReview((r) => r && { ...r, expense_date: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{tDialog("notesLabel")}</Label>
                    <Input
                      value={review.notes}
                      onChange={(e) =>
                        setReview((r) => r && { ...r, notes: e.target.value })
                      }
                      placeholder={t("notesPlaceholder")}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSaveReview}
                    disabled={saving}
                    className="flex-1 gap-2"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t("saveButton")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={reset}
                    disabled={saving}
                    className="gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("scanAnother")}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Manual entry ── */}
            {step === "manual" && (
              <form action={handleSaveManual} className="space-y-4 pt-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="man-category">{tDialog("categoryLabel")}</Label>
                    <Select name="category" defaultValue="misc">
                      <SelectTrigger id="man-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {tCat(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="man-amount">{tDialog("amountLabel")}</Label>
                    <Input
                      id="man-amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="man-date">{tDialog("dateLabel")}</Label>
                    <Input
                      id="man-date"
                      name="expense_date"
                      type="date"
                      defaultValue={manualDate}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="man-time">{tDialog("timeLabel")}</Label>
                    <Input id="man-time" name="expense_time" type="time" />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="man-vendor">{tDialog("vendorLabel")}</Label>
                    <Input
                      id="man-vendor"
                      name="vendor_name"
                      placeholder="e.g. PTT, Grab, 7-Eleven"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="man-notes">{tDialog("notesLabel")}</Label>
                    <Input
                      id="man-notes"
                      name="notes"
                      placeholder={tDialog("notesPlaceholder")}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tDialog("submitButton")}
                </Button>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
