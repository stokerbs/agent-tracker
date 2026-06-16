import type { Metadata } from "next";
import Link from "next/link";
import { FolderLock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EvidencePreview } from "@/components/evidence/evidence-preview";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Evidence } from "@/lib/types";

export const metadata: Metadata = { title: "Evidence" };
export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  await requireProfile();
  const t = await getTranslations("evidence");
  const supabase = await createClient();

  const { data } = await supabase
    .from("evidence")
    .select("*, cases(case_number)")
    .order("uploaded_at", { ascending: false })
    .limit(200);

  const items = (data ?? []) as (Evidence & { cases: { case_number: string } | null })[];

  const groups = items.reduce<Record<string, typeof items>>((acc, e) => {
    const key = e.cases?.case_number ?? "Unassigned";
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {items.length === 0 ? (
        <EmptyState
          icon={<FolderLock className="h-6 w-6" />}
          title={t("noTitle")}
          description={t("noDescription")}
        />
      ) : (
        Object.entries(groups).map(([caseNum, list]) => (
          <Card key={caseNum}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderLock className="h-4 w-4" />
                <Link
                  href={`/cases/${list[0].case_id}`}
                  className="hover:underline"
                >
                  {caseNum}
                </Link>
                <span className="text-sm font-normal text-muted-foreground">
                  ({list.length === 1
                    ? t("itemCount", { count: list.length })
                    : t("itemCountPlural", { count: list.length })})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((e) => (
                <EvidencePreview key={e.id} item={e} />
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
