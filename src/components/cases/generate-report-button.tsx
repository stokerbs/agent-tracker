"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { generateCaseReport } from "@/app/(dashboard)/reports/actions";
import { Button } from "@/components/ui/button";
import type { ReportLanguage } from "@/lib/types";

export function GenerateReportButton({ caseId }: { caseId: string }) {
  const t = useTranslations("reports");
  const [pending, start] = useTransition();
  const [language, setLanguage] = useState<ReportLanguage>("th");
  const router = useRouter();

  function run() {
    start(async () => {
      const res = await generateCaseReport(caseId, language);
      if (res?.error) { toast.error(res.error); return; }
      const providerLabel =
        res.source === "claude" ? " · Claude AI" : " · Template Engine";
      toast.success(t("toast.generated") + providerLabel);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium">
        <button
          type="button"
          onClick={() => setLanguage("th")}
          disabled={pending}
          className={`px-3 py-1.5 transition-colors ${
            language === "th"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          ไทย
        </button>
        <button
          type="button"
          onClick={() => setLanguage("en")}
          disabled={pending}
          className={`px-3 py-1.5 transition-colors ${
            language === "en"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          EN
        </button>
      </div>
      <Button onClick={run} disabled={pending} variant="secondary" size="sm">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {t("generateButton")}
      </Button>
    </div>
  );
}
