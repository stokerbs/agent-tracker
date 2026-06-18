import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FolderLock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { EvidenceGallery } from "@/components/evidence/evidence-gallery";
import { EvidenceFilters } from "@/components/evidence/evidence-filters";
import { EmptyState } from "@/components/shared/empty-state";
import type { Evidence, EvidenceType } from "@/lib/types";

export const metadata: Metadata = { title: "Evidence" };
export const dynamic = "force-dynamic";

type EvidenceWithCase = Evidence & { cases: { case_number: string } | null };

const VALID_TYPES = new Set<string>(["photo", "video", "pdf", "audio", "document"]);

interface Props {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function EvidencePage({ searchParams }: Props) {
  const profile = await requireProfile();
  const t = await getTranslations("evidence");
  const sp = await searchParams;
  const supabase = await createClient();

  // Fetch evidence joined with case number and uploader profile.
  const { data } = await supabase
    .from("evidence")
    .select("*, cases(case_number), profiles:uploaded_by(id, full_name)")
    .order("uploaded_at", { ascending: false })
    .limit(200);

  const items = (data ?? []) as (EvidenceWithCase & {
    profiles: { id: string; full_name: string | null } | null;
  })[];

  // Build uploader name map: profile_id → display name.
  const uploaderNames: Record<string, string> = {};
  for (const item of items) {
    if (item.uploaded_by && item.profiles) {
      uploaderNames[item.uploaded_by] = item.profiles.full_name ?? "Unknown";
    }
  }

  // Apply filters in-memory.
  const search = sp.q?.toLowerCase().trim() ?? "";
  const typeFilter = VALID_TYPES.has(sp.type ?? "") ? (sp.type as EvidenceType) : null;

  const filtered = items.filter((e) => {
    if (search && !(e.cases?.case_number ?? "").toLowerCase().includes(search)) return false;
    if (typeFilter && e.type !== typeFilter) return false;
    return true;
  });

  // Generate signed URLs only for filtered photo/video items.
  const visualPaths = filtered
    .filter((e) => e.type === "photo" || e.type === "video")
    .map((e) => e.storage_path);

  const thumbnailUrls: Record<string, string> = {};
  if (visualPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKETS.evidence)
      .createSignedUrls(visualPaths, 60 * 60); // 1-hour TTL
    if (signed) {
      for (const s of signed) {
        if (s.signedUrl && s.path) thumbnailUrls[s.path] = s.signedUrl;
      }
    }
  }

  // Group filtered items by case number.
  const groups = filtered.reduce<Record<string, typeof filtered>>((acc, e) => {
    const key = e.cases?.case_number ?? "Unassigned";
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Suspense>
        <EvidenceFilters count={filtered.length} />
      </Suspense>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderLock className="h-6 w-6" />}
          title={search || typeFilter ? t("filters.noResults") : t("noTitle")}
          description={search || typeFilter ? t("filters.noResultsDescription") : t("noDescription")}
        />
      ) : (
        <div className="space-y-10">
          {Object.entries(groups).map(([caseNum, list]) => (
            <section key={caseNum}>
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

              <EvidenceGallery
                items={list}
                thumbnailUrls={thumbnailUrls}
                uploaderNames={uploaderNames}
                isAdmin={isAdmin}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
