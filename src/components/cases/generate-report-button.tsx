"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { generateCaseReport } from "@/app/(dashboard)/reports/actions";
import { Button } from "@/components/ui/button";

export function GenerateReportButton({ caseId }: { caseId: string }) {
  const t = useTranslations("reports");
  const [pending, start] = useTransition();
  const router = useRouter();

  function run() {
    start(async () => {
      const res = await generateCaseReport(caseId);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.generated"));
      router.refresh();
    });
  }

  return (
    <Button onClick={run} disabled={pending} variant="secondary" size="sm">
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {t("generateButton")}
    </Button>
  );
}
