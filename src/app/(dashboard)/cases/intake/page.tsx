import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/shared/motion";
import { CaseIntakeWizard } from "@/components/cases/case-intake-wizard";

export const metadata: Metadata = { title: "AI Case Intake" };
export const dynamic = "force-dynamic";

export default async function CaseIntakePage() {
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("cases.intake");

  return (
    <div className="space-y-6 pb-12">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/cases">
          <ArrowLeft className="h-4 w-4" /> {t("backToCases")}
        </Link>
      </Button>

      <FadeUp>
        <PageHeader title={t("title")} description={t("description")} />
      </FadeUp>

      <FadeUp delay={0.05}>
        <CaseIntakeWizard />
      </FadeUp>
    </div>
  );
}
