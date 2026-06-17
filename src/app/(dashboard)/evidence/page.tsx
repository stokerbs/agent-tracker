import type { Metadata } from "next";
import Link from "next/link";
import { FolderLock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { EvidenceGallery } from "@/components/evidence/evidence-gallery";
import { EmptyState } from "@/components/shared/empty-state";
import type { Evidence } from "@/lib/types";

export const metadata: Metadata = { title: "Evidence" };
export const dynamic = "force-dynamic";

type EvidenceWithCase = Evidence & { cases: { case_number: string } | null };

export default async function EvidencePage() {
  const profile = await requireProfile();
  const t = await getTranslations("evidence");
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

  // Batch-generate signed thumbnail URLs for photos/videos in one API call.
  const visualPaths = items
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

  // Group by case number.
  const groups = items.reduce<Record<string, typeof items>>((acc, e) => {
    const key = e.cases?.case_number ?? "Unassigned";
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  const isAdmin = profile.role === "admin";

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
