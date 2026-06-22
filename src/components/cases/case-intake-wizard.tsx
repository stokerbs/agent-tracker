"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, X, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { INTAKE_ACCEPT, INTAKE_ALLOWED_MIME_TYPES, INTAKE_MAX_FILES } from "@/lib/constants";
import { confirmIntake, discardIntake } from "@/app/(dashboard)/cases/intake/actions";
import type { IntakeAnalyzeResult, IntakeExtraction } from "@/lib/types";
import { IntakeReview } from "./intake/intake-review";

type Step = "upload" | "analyzing" | "review";

export function CaseIntakeWizard() {
  const t = useTranslations("cases.intake");
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<IntakeAnalyzeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Object URLs for image thumbnails on the review screen.
  const thumbsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const f of files) {
      if (f.type.startsWith("image/")) map[f.name] = URL.createObjectURL(f);
    }
    thumbsRef.current = map;
    return () => Object.values(map).forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) =>
      (INTAKE_ALLOWED_MIME_TYPES as readonly string[]).includes(f.type),
    );
    const rejected = list.length - incoming.length;
    if (rejected > 0) toast.error(t("rejectedTypes", { count: rejected }));
    setFiles((prev) => {
      const merged = [...prev];
      for (const f of incoming) {
        if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
      }
      return merged.slice(0, INTAKE_MAX_FILES);
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function analyze() {
    if (files.length === 0) return;
    setStep("analyzing");
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    try {
      const res = await fetch("/api/cases/intake/analyze", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? t("analyzeFailed"));
        setStep("upload");
        return;
      }
      setResult(json as IntakeAnalyzeResult);
      setStep("review");
    } catch {
      toast.error(t("analyzeFailed"));
      setStep("upload");
    }
  }

  function back() {
    // Abandon the staged files for this intake, return to upload.
    if (result) void discardIntake(result.intakeId);
    setResult(null);
    setStep("upload");
  }

  async function confirm(edited: IntakeExtraction) {
    if (!result) return;
    setSubmitting(true);
    try {
      const res = await confirmIntake({
        intakeId: result.intakeId,
        files: result.files,
        extraction: edited,
      });
      if ("error" in res) {
        toast.error(res.error);
        setSubmitting(false);
        return;
      }
      toast.success(t("created"));
      router.push(`/cases/${res.id}`);
    } catch {
      toast.error(t("createFailed"));
      setSubmitting(false);
    }
  }

  if (step === "review" && result) {
    return (
      <IntakeReview
        initial={result.extraction}
        thumbnails={thumbsRef.current}
        submitting={submitting}
        onBack={back}
        onConfirm={confirm}
      />
    );
  }

  if (step === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card py-20">
        <div className="relative">
          <Sparkles className="h-10 w-10 text-primary" />
          <Loader2 className="absolute -right-2 -top-2 h-5 w-5 animate-spin text-primary" />
        </div>
        <div className="text-center">
          <p className="font-semibold">{t("analyzing")}</p>
          <p className="text-sm text-muted-foreground">{t("analyzingHint", { count: files.length })}</p>
        </div>
      </div>
    );
  }

  // upload step
  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/50 py-16 text-center transition-colors hover:border-primary/50 hover:bg-card"
      >
        <UploadCloud className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">{t("dropTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("dropHint")}</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={INTAKE_ACCEPT}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={analyze} disabled={files.length === 0}>
          <Sparkles className="mr-1.5 h-4 w-4" />
          {t("analyzeBtn", { count: files.length })}
        </Button>
      </div>
    </div>
  );
}
