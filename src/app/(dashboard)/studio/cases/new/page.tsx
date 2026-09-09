import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STUDIO_SETTINGS_ID } from "@/lib/studio/constants";
import type { PrivacyRules } from "@/lib/studio/types";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CaseForm } from "../case-form";

export const metadata: Metadata = { title: "เพิ่มเคส · Creative Studio" };
export const dynamic = "force-dynamic";

export default async function NewStudioCasePage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("studio_settings").select("privacy_rules").eq("id", STUDIO_SETTINGS_ID).maybeSingle();
  const rules = (data?.privacy_rules as Partial<PrivacyRules> | null) ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="เพิ่มเคส" description="บันทึกเคสที่จบแล้วในรูปแบบ generalise เพื่อให้ AI สกัดบทเรียน">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/studio/cases">
            <ArrowLeft className="h-4 w-4" /> กลับ Case Insights
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="p-4 sm:p-6">
          <CaseForm privacyRules={rules} />
        </CardContent>
      </Card>
    </div>
  );
}
