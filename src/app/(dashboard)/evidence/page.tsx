import type { Metadata } from "next";
import Link from "next/link";
import { FolderLock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EvidenceGallery } from "@/components/evidence/evidence-gallery";
import { EmptyState } from "@/components/shared/empty-state";
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
        <div className="space-y-8">
          {Object.entries(groups).map(([caseNum, list]) => (
            <section key={caseNum}>
              {/* Case group header */}
              <div className="mb-4 flex items-center gap-3">
                <FolderLock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Link
                  href={`/cases/${list[0].case_id}`}
                  className="font-mono text-sm font-semibold text-primary hover:underline"
                >
                  {caseNum}
                </Link>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {list.length}
                </span>
                <div className="h-px flex-1 bg-border/50" />
              </div>

              {/* Gallery grid */}
              <EvidenceGallery items={list} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
